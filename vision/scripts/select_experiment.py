"""Compara experimentos SOLO con validación y congela la selección antes de abrir test.

Uso: python scripts/select_experiment.py [prefijo=E4c_]
Escribe reports/experiments/selection.json (tabla comparativa + regla + elegido).
La regla está en src/berryvision/training/selection.py y se fijó antes de ver resultados.
"""

from __future__ import annotations

import csv
import json
import sys
from datetime import datetime, timezone
from pathlib import Path

VISION_ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(VISION_ROOT / "src"))

import numpy as np  # noqa: E402

from berryvision.training import selection  # noqa: E402
from berryvision.training.engine import save_json  # noqa: E402


def summarize(exp_dir: Path) -> dict | None:
    if not (exp_dir / "run_info.json").exists():
        return None
    info = json.loads((exp_dir / "run_info.json").read_text(encoding="utf-8"))
    vm = json.loads((exp_dir / "val_metrics.json").read_text(encoding="utf-8"))
    th = json.loads((exp_dir / "val_thresholds.json").read_text(encoding="utf-8"))
    npz = np.load(exp_dir / "val_predictions.npz")
    classes, healthy = vm["classes"], vm["healthy_class"]
    dc = selection.disease_conditional(npz["probs"], npz["labels"], classes, classes.index(healthy))
    chosen = th["rules"][th["rule"]]
    cfg = info["config"]
    with open(exp_dir / "history.csv", encoding="utf-8") as fh:
        hist = list(csv.DictReader(fh))
    best = hist[info["fit"]["best_epoch"] - 1]
    return {
        "id": info["id"], "model": cfg["model"]["name"], "freeze_backbone": cfg["model"].get("freeze_backbone", False),
        "imgsz": cfg["model"]["imgsz"], "include_augmented": cfg["data"].get("include_augmented", True),
        "loss": cfg["loss"]["name"], "optimizer": cfg["train"]["optimizer"], "lr": cfg["train"]["lr"],
        "freeze_bn": cfg["train"].get("freeze_bn", False), "n_train": info["data"]["n_train"],
        "best_epoch": info["fit"]["best_epoch"], "epochs_run": info["fit"]["epochs_run"],
        "train_min": round(info["fit"]["train_seconds"] / 60, 1),
        "gap_loss_best": round(float(best["val_loss"]) - float(best["train_loss"]), 3),
        "val_acc": round(vm["argmax"]["accuracy"], 4), "val_macro_recall": round(vm["argmax"]["macro_recall"], 4),
        "disease_cond_macro_recall": dc["macro_recall"], "disease_cond_min_recall": dc["min_recall"],
        "disease_cond_worst_class": min(dc["per_class"], key=lambda r: r["recall"])["class"],
        "alert_threshold": chosen.get("threshold"), "alert_fn": chosen.get("fn"), "alert_fp": chosen.get("fp"),
        "alerts_per_100": round(chosen.get("alerts_per_100_images", 0), 1),
        "val_ece": round(vm["argmax"]["calibration"]["ece"], 4),
        "latency_ms": info["latency_dev_machine"]["latency_ms_per_batch"],
        "params_trainable": info["model"]["params_trainable"],
        "test_evaluated": info.get("test_evaluated", False),
    }


def main() -> int:
    if hasattr(sys.stdout, "reconfigure"):
        sys.stdout.reconfigure(encoding="utf-8")
    prefix = sys.argv[1] if len(sys.argv) > 1 else "E4c_"
    root = VISION_ROOT / "reports" / "experiments"
    rows = [s for d in sorted(root.glob(prefix + "*")) if d.is_dir() and (s := summarize(d))]
    if not rows:
        print("No hay experimentos completos")
        return 1
    chosen = selection.select(rows)
    save_json({"decided_at": datetime.now(timezone.utc).isoformat(timespec="seconds"), "split_used": "val",
               "rule": selection.__doc__, "selected": chosen["id"], "table": rows}, root / "selection.json")
    keys = ["id", "disease_cond_macro_recall", "disease_cond_min_recall", "disease_cond_worst_class",
            "alert_fn", "alert_fp", "val_acc", "val_ece", "best_epoch", "train_min", "latency_ms"]
    for r in sorted(rows, key=selection.selection_key, reverse=True):
        print(" | ".join(f"{r[k]:.3f}" if isinstance(r[k], float) else str(r[k]) for k in keys))
    print("SELECCIONADO (solo validación):", chosen["id"])
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
