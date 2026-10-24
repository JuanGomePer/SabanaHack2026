"""Entrena un clasificador según configs/experiments/<id>.yaml. NUNCA usa el split de test.

Uso: python scripts/train_classifier.py configs/experiments/E4c_02_resnet18_adamw_ce.yaml

Salidas:
  runs/<id>/best.pt                        checkpoint (ignorado por Git)
  reports/experiments/<id>/run_info.json   configuración, versiones, hashes, GPU, tiempos
  reports/experiments/<id>/history.csv     métricas por época
  reports/experiments/<id>/val_metrics.json, val_thresholds.json, val_predictions.npz
"""

from __future__ import annotations

import hashlib
import json
import platform
import subprocess
import sys
from pathlib import Path

VISION_ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(VISION_ROOT / "src"))

import numpy as np  # noqa: E402
import torch  # noqa: E402
import yaml  # noqa: E402

from berryvision.manifest import read_manifest_csv  # noqa: E402
from berryvision.safety import assert_not_pc1  # noqa: E402
from berryvision.training.data import (ManifestDataset, build_transforms, make_loader, seed_everything,  # noqa: E402
                                       select_rows)
from berryvision.training.engine import (build_optimizer, build_scheduler, fit, predict, save_json)  # noqa: E402
from berryvision.training.losses import build_loss, class_weights  # noqa: E402
from berryvision.training.metrics import (alert_curves, alert_scores, choose_threshold,  # noqa: E402
                                          multiclass_summary, predict_with_alert_threshold, threshold_sweep)
from berryvision.training.models import (build_model, count_params, measure_latency, param_groups,  # noqa: E402
                                         set_bn_eval)

MANIFEST = VISION_ROOT / "data" / "processed" / "manifest_v1.csv"


def code_tree_sha256() -> str:
    h = hashlib.sha256()
    for p in sorted((VISION_ROOT / "src" / "berryvision").rglob("*.py")):
        h.update(p.relative_to(VISION_ROOT).as_posix().encode())
        h.update(p.read_bytes())
    return h.hexdigest()


def git_state() -> dict:
    def run(*a):
        try:
            return subprocess.run(["git", *a], cwd=VISION_ROOT, capture_output=True, text=True, timeout=20).stdout.strip()
        except Exception:
            return None
    return {"branch": run("branch", "--show-current"), "head": run("rev-parse", "--short", "HEAD"),
            "dirty": bool(run("status", "--porcelain", "--", "."))}


def load_cfg(path: Path) -> dict:
    cfg = yaml.safe_load(path.read_text(encoding="utf-8"))
    base = cfg.pop("extends", None)
    if base:
        parent = load_cfg((path.parent / base).resolve())
        for k, v in cfg.items():
            if isinstance(v, dict) and isinstance(parent.get(k), dict):
                parent[k].update(v)
            else:
                parent[k] = v
        cfg = parent
    return cfg


def main() -> int:
    if hasattr(sys.stdout, "reconfigure"):
        sys.stdout.reconfigure(encoding="utf-8")
    assert_not_pc1()
    cfg_path = Path(sys.argv[1]).resolve()
    cfg = load_cfg(cfg_path)
    exp_id = cfg["id"]
    out_dir = VISION_ROOT / "reports" / "experiments" / exp_id
    ckpt = VISION_ROOT / "runs" / exp_id / "best.pt"
    seed_everything(cfg["seed"])
    torch.backends.cudnn.benchmark = True
    device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
    if device.type != "cuda" and not cfg.get("allow_cpu"):
        print("No hay GPU CUDA: no se ejecuta un entrenamiento largo en CPU (use allow_cpu: true para pruebas).")
        return 2

    manifest = read_manifest_csv(MANIFEST)
    meta = json.loads((VISION_ROOT / "manifests" / "manifest_v1.meta.json").read_text(encoding="utf-8"))
    d = cfg["data"]
    classes = d["classes"]
    healthy = d["healthy_class"]
    healthy_idx = classes.index(healthy)
    tr_rows = select_rows(manifest, d["source_id"], "train", include_augmented=d.get("include_augmented", True))
    va_rows = select_rows(manifest, d["source_id"], "val", include_augmented=False)
    if d.get("max_train"):  # solo para pruebas rápidas
        tr_rows = tr_rows[: d["max_train"]]
    m = cfg["model"]
    tr_ds = ManifestDataset(tr_rows, classes, VISION_ROOT, build_transforms(m["imgsz"], True, cfg.get("augmentation")))
    va_ds = ManifestDataset(va_rows, classes, VISION_ROOT, build_transforms(m["imgsz"], False))
    t = cfg["train"]
    tr_dl = make_loader(tr_ds, t["batch_size"], True, t.get("num_workers", 4), cfg["seed"])
    va_dl = make_loader(va_ds, t["batch_size"], False, t.get("num_workers", 4), cfg["seed"])

    model = build_model(m["name"], len(classes), m.get("pretrained", True), m.get("freeze_backbone", False),
                        m.get("dropout", 0.0)).to(device)
    if t.get("freeze_bn"):
        set_bn_eval(model)
    counts = tr_ds.class_counts()
    weights = None
    lc = cfg["loss"]
    if lc["name"] in ("weighted_ce",) or (lc["name"] == "focal" and lc.get("alpha") == "class_weights"):
        weights = class_weights(counts, classes, lc.get("weight_power", 1.0), lc.get("w_min", 0.25),
                                lc.get("w_max", 4.0))
    criterion = build_loss(lc["name"], weights.to(device) if weights is not None else None, lc.get("gamma", 2.0))
    groups = param_groups(model, t["lr"], t.get("backbone_lr_mult", 1.0))
    opt = build_optimizer(t["optimizer"], groups, t["weight_decay"], t.get("momentum", 0.9))
    sched, mode = build_scheduler(t["scheduler"], opt, t["epochs"], len(tr_dl), t.get("warmup_epochs", 1))

    total_p, train_p = count_params(model)
    print(f"[{exp_id}] device={device} train={len(tr_ds)} val={len(va_ds)} params={total_p} entrenables={train_p}")
    print(f"[{exp_id}] muestras por clase (train): {counts}")
    fit_info = fit(model, tr_dl, va_dl, classes, healthy_idx,
                   {"id": exp_id, "epochs": t["epochs"], "patience": t["patience"], "amp": t.get("amp", True),
                    "grad_clip": t.get("grad_clip"), "freeze_bn": t.get("freeze_bn", False)},
                   device, out_dir, criterion, opt, sched, mode, ckpt)

    state = torch.load(ckpt, map_location=device)
    model.load_state_dict(state["model"])
    val = predict(model, va_dl, device)
    summ = multiclass_summary(val["probs"], val["labels"], classes)
    y_alert = (val["labels"] != healthy_idx).astype(int)
    score = alert_scores(val["probs"], healthy_idx)
    sweep = threshold_sweep(y_alert, score)
    rules = {"max_f2": choose_threshold(sweep),
             **{f"recall>={r}": choose_threshold(sweep, min_recall=r) for r in cfg.get("recall_targets", [0.95, 0.98])}}
    chosen_rule = cfg.get("threshold_rule", "max_f2")
    thr = rules[chosen_rule]["threshold"] if rules[chosen_rule].get("feasible") else 0.5
    pred_thr = predict_with_alert_threshold(val["probs"], healthy_idx, thr)
    summ_thr = multiclass_summary(val["probs"], val["labels"], classes, y_pred=pred_thr)

    save_json({"argmax": summ, "with_alert_threshold": summ_thr, "alert_curves": alert_curves(y_alert, score),
               "classes": classes, "healthy_class": healthy}, out_dir / "val_metrics.json")
    save_json({"frozen": True, "selected_on": "val", "rule": chosen_rule, "threshold": thr,
               "rules": rules, "sweep": sweep}, out_dir / "val_thresholds.json")
    np.savez_compressed(out_dir / "val_predictions.npz", probs=val["probs"], labels=val["labels"],
                        image_ids=np.array([va_rows[i]["image_id"] for i in val["idx"]]))
    lat = measure_latency(model, m["imgsz"], device, batch=1)
    save_json({
        "id": exp_id, "config_path": cfg_path.relative_to(VISION_ROOT).as_posix(), "config": cfg,
        "code_tree_sha256": code_tree_sha256(), "git": git_state(),
        "manifest_sha256": meta["manifest_sha256"], "manifest_splits_sha256": meta["manifest_splits_sha256"],
        "data": {"source_id": d["source_id"], "n_train": len(tr_ds), "n_val": len(va_ds), "train_counts": counts,
                 "class_weights": weights.tolist() if weights is not None else None},
        "model": {"name": m["name"], "params_total": total_p, "params_trainable": train_p,
                  "init": "ImageNet" if m.get("pretrained", True) and m["name"] != "smallcnn" else "aleatoria"},
        "env": {"python": platform.python_version(), "torch": torch.__version__,
                "cuda": torch.version.cuda, "gpu": torch.cuda.get_device_name(0) if device.type == "cuda" else None},
        "fit": fit_info, "best_checkpoint": ckpt.relative_to(VISION_ROOT).as_posix(),
        "latency_dev_machine": lat, "test_evaluated": False,
    }, out_dir / "run_info.json")
    print(f"[{exp_id}] mejor época {fit_info['best_epoch']} | val macro-recall enfermedad "
          f"{fit_info['best_val_disease_macro_recall']:.3f} | umbral ({chosen_rule}) {thr:.2f} | "
          f"FN alerta {rules[chosen_rule].get('fn')} FP alerta {rules[chosen_rule].get('fp')}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
