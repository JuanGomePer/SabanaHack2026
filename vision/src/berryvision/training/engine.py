"""Bucle de entrenamiento con AMP, scheduler, early stopping y registro por época.

La selección del checkpoint usa SOLO validación. El criterio por defecto es el
recall macro de las clases de enfermedad (no la exactitud), con la pérdida de
validación como desempate.
"""

from __future__ import annotations

import csv
import json
import math
import time
from pathlib import Path

import numpy as np
import torch
from torch import nn

from .metrics import alert_scores, multiclass_summary, threshold_sweep
from .models import set_bn_eval


@torch.no_grad()
def predict(model: nn.Module, loader, device, criterion=None) -> dict:
    model.eval()
    probs, labels, idx, loss_sum, n = [], [], [], 0.0, 0
    for x, y, i in loader:
        x, y = x.to(device, non_blocking=True), y.to(device, non_blocking=True)
        with torch.autocast(device_type=device.type, enabled=device.type == "cuda"):
            logits = model(x)
        if criterion is not None:
            loss_sum += float(criterion(logits.float(), y)) * len(y)
        n += len(y)
        probs.append(torch.softmax(logits.float(), 1).cpu())
        labels.append(y.cpu())
        idx.append(i)
    return {"probs": torch.cat(probs).numpy(), "labels": torch.cat(labels).numpy(),
            "idx": torch.cat(idx).numpy(), "loss": loss_sum / max(n, 1)}


def build_optimizer(name: str, groups, weight_decay: float, momentum: float = 0.9):
    if name == "adamw":
        return torch.optim.AdamW(groups, weight_decay=weight_decay)
    if name == "sgd":
        return torch.optim.SGD(groups, momentum=momentum, nesterov=True, weight_decay=weight_decay)
    raise ValueError(name)


def build_scheduler(name: str, opt, epochs: int, steps_per_epoch: int, warmup_epochs: float = 1.0):
    total = epochs * steps_per_epoch
    warm = int(warmup_epochs * steps_per_epoch)
    if name == "cosine":
        def f(step):
            if step < warm:
                return (step + 1) / max(warm, 1)
            prog = (step - warm) / max(total - warm, 1)
            return 0.5 * (1 + math.cos(math.pi * min(prog, 1.0)))
        return torch.optim.lr_scheduler.LambdaLR(opt, f), "step"
    if name == "onecycle":
        return torch.optim.lr_scheduler.OneCycleLR(opt, max_lr=[g["lr"] for g in opt.param_groups],
                                                   total_steps=total), "step"
    if name == "none":
        return None, None
    raise ValueError(name)


def fit(model, train_loader, val_loader, classes, healthy_idx, cfg: dict, device, out_dir: Path,
        criterion, optimizer, scheduler, sched_mode, ckpt_path: Path) -> dict:
    out_dir.mkdir(parents=True, exist_ok=True)
    ckpt_path.parent.mkdir(parents=True, exist_ok=True)
    use_amp = device.type == "cuda" and cfg.get("amp", True)
    scaler = torch.amp.GradScaler("cuda", enabled=use_amp)
    disease_idx = [i for i in range(len(classes)) if i != healthy_idx]
    best, best_epoch, patience_left, history = None, -1, cfg["patience"], []
    eval_criterion = nn.CrossEntropyLoss()  # pérdida de validación comparable entre experimentos
    t_start = time.time()
    for epoch in range(cfg["epochs"]):
        t0 = time.time()
        model.train()
        if cfg.get("freeze_bn"):
            set_bn_eval(model)
        loss_sum, n, correct = 0.0, 0, 0
        for x, y, _ in train_loader:
            x, y = x.to(device, non_blocking=True), y.to(device, non_blocking=True)
            optimizer.zero_grad(set_to_none=True)
            with torch.autocast(device_type=device.type, enabled=use_amp):
                logits = model(x)
                loss = criterion(logits.float(), y)
            scaler.scale(loss).backward()
            if cfg.get("grad_clip"):
                scaler.unscale_(optimizer)
                nn.utils.clip_grad_norm_(model.parameters(), cfg["grad_clip"])
            scaler.step(optimizer)
            scaler.update()
            if scheduler is not None and sched_mode == "step":
                scheduler.step()
            loss_sum += float(loss.detach()) * len(y); n += len(y)
            correct += int((logits.argmax(1) == y).sum())
        tr_loss, tr_acc = loss_sum / n, correct / n
        # Exactitud de train medida con la red en modo train (dropout/BN de train): indicativa
        val = predict(model, val_loader, device, eval_criterion)
        summ = multiclass_summary(val["probs"], val["labels"], classes)
        rec = {r["class"]: r["recall"] for r in summ["per_class"]}
        fn = {r["class"]: r["fn"] for r in summ["per_class"]}
        disease_recall = float(np.mean([rec[classes[i]] for i in disease_idx]))
        y_alert = (val["labels"] != healthy_idx).astype(int)
        sw = threshold_sweep(y_alert, alert_scores(val["probs"], healthy_idx), thresholds=[0.5])[0]
        row = {"epoch": epoch + 1, "lr": optimizer.param_groups[0]["lr"], "train_loss": tr_loss,
               "train_acc_trainmode": tr_acc, "val_loss": val["loss"], "val_acc": summ["accuracy"],
               "val_macro_recall": summ["macro_recall"], "val_disease_macro_recall": disease_recall,
               "val_alert_fn@0.5": sw["fn"], "val_alert_recall@0.5": sw["recall"],
               "val_ece": summ["calibration"]["ece"], "epoch_s": time.time() - t0,
               "gpu_peak_mib": torch.cuda.max_memory_allocated() / 2**20 if device.type == "cuda" else None,
               **{f"val_recall__{c}": rec[c] for c in classes}, **{f"val_fn__{c}": fn[c] for c in classes}}
        history.append(row)
        score = (disease_recall, -val["loss"])
        if best is None or score > best:
            best, best_epoch, patience_left = score, epoch + 1, cfg["patience"]
            torch.save({"model": model.state_dict(), "epoch": epoch + 1, "classes": classes, "cfg": cfg}, ckpt_path)
        else:
            patience_left -= 1
        print(f"[{cfg['id']}] ep {epoch + 1:02d} tr_loss {tr_loss:.3f} val_loss {val['loss']:.3f} "
              f"val_acc {summ['accuracy']:.3f} dis_rec {disease_recall:.3f} alertFN@.5 {sw['fn']} "
              f"({row['epoch_s']:.0f}s)", flush=True)
        if patience_left <= 0:
            print(f"[{cfg['id']}] early stopping en la época {epoch + 1} (mejor {best_epoch})", flush=True)
            break
    with open(out_dir / "history.csv", "w", newline="", encoding="utf-8") as fh:
        w = csv.DictWriter(fh, fieldnames=list(history[0]))
        w.writeheader()
        w.writerows(history)
    return {"best_epoch": best_epoch, "best_val_disease_macro_recall": best[0], "best_val_loss": -best[1],
            "epochs_run": len(history), "train_seconds": time.time() - t_start}


def save_json(obj, path: Path) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(obj, indent=2, ensure_ascii=False, default=float), encoding="utf-8")
