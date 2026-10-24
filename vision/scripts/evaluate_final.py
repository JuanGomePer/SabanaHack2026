"""Evaluación FINAL en test de un experimento ya seleccionado con validación.

Uso: python scripts/evaluate_final.py <experiment_id> --selected-because "<criterio>"

- Usa el checkpoint y el umbral CONGELADOS en validación (val_thresholds.json).
- Se ejecuta una sola vez por experimento: si run_info.json marca test_evaluated, se niega
  (salvo --force, que queda registrado como desviación del protocolo).
- Añade una comprobación fuera de dominio (OOD): el modelo de fresa aplicado a hojas de
  arándano (PlantVillage y PlantDoc) para medir su exceso de confianza ante imágenes ajenas.
"""

from __future__ import annotations

import argparse
import json
import sys
from datetime import datetime, timezone
from pathlib import Path

VISION_ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(VISION_ROOT / "src"))

import numpy as np  # noqa: E402
import torch  # noqa: E402

from berryvision.manifest import read_manifest_csv  # noqa: E402
from berryvision.safety import assert_not_pc1  # noqa: E402
from berryvision.training.data import ManifestDataset, build_transforms, make_loader, select_rows  # noqa: E402
from berryvision.training.engine import predict, save_json  # noqa: E402
from berryvision.training.metrics import (alert_curves, alert_scores, multiclass_summary,  # noqa: E402
                                          predict_with_alert_threshold, threshold_sweep)
from berryvision.training.models import build_model  # noqa: E402


def main() -> int:
    if hasattr(sys.stdout, "reconfigure"):
        sys.stdout.reconfigure(encoding="utf-8")
    assert_not_pc1()
    ap = argparse.ArgumentParser()
    ap.add_argument("exp_id")
    ap.add_argument("--selected-because", required=True)
    ap.add_argument("--force", action="store_true")
    args = ap.parse_args()
    exp_dir = VISION_ROOT / "reports" / "experiments" / args.exp_id
    info = json.loads((exp_dir / "run_info.json").read_text(encoding="utf-8"))
    if info.get("test_evaluated") and not args.force:
        print("Este experimento ya se evaluó en test; no se repite (protocolo).")
        return 1
    thr = json.loads((exp_dir / "val_thresholds.json").read_text(encoding="utf-8"))
    cfg = info["config"]
    d, m = cfg["data"], cfg["model"]
    classes, healthy_idx = d["classes"], d["classes"].index(d["healthy_class"])
    device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
    model = build_model(m["name"], len(classes), pretrained=False, dropout=m.get("dropout", 0.0)).to(device)
    state = torch.load(VISION_ROOT / info["best_checkpoint"], map_location=device)
    model.load_state_dict(state["model"])

    manifest = read_manifest_csv(VISION_ROOT / "data" / "processed" / "manifest_v1.csv")
    te_rows = select_rows(manifest, d["source_id"], "test", include_augmented=False)
    te_ds = ManifestDataset(te_rows, classes, VISION_ROOT, build_transforms(m["imgsz"], False))
    te = predict(model, make_loader(te_ds, 64, False, 2), device)
    y_alert = (te["labels"] != healthy_idx).astype(int)
    score = alert_scores(te["probs"], healthy_idx)
    pred_thr = predict_with_alert_threshold(te["probs"], healthy_idx, thr["threshold"])
    out = {
        "experiment": args.exp_id, "opened_at": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        "selected_because": args.selected_because, "forced": args.force,
        "frozen_threshold": thr["threshold"], "threshold_rule": thr["rule"],
        "argmax": multiclass_summary(te["probs"], te["labels"], classes),
        "with_alert_threshold": multiclass_summary(te["probs"], te["labels"], classes, y_pred=pred_thr),
        "alert_at_frozen_threshold": threshold_sweep(y_alert, score, thresholds=[thr["threshold"]])[0],
        "alert_curves": alert_curves(y_alert, score), "classes": classes,
    }
    save_json(out, exp_dir / "test_metrics.json")
    np.savez_compressed(exp_dir / "test_predictions.npz", probs=te["probs"], labels=te["labels"],
                        image_ids=np.array([te_rows[i]["image_id"] for i in te["idx"]]))

    # --- Comprobación fuera de dominio (arándano): ninguna de estas imágenes es una clase del modelo
    ood = {}
    for src in ("plantvillage_blueberry_healthy", "plantdoc_blueberry"):
        rows = [r for r in manifest if r["source_id"] == src]
        # Etiqueta irrelevante: se asigna una clase ficticia solo para reutilizar el Dataset.
        ds =ManifestDataset([{**r, "canonical_label": classes[0]} for r in rows], classes, VISION_ROOT,
                             build_transforms(m["imgsz"], False))
        p = predict(model, make_loader(ds, 64, False, 2), device)["probs"]
        conf = p.max(1)
        ood[src] = {"n": int(len(p)), "mean_max_prob": float(conf.mean()),
                    "frac_max_prob_ge_0.9": float((conf >= 0.9).mean()),
                    "frac_alert_at_threshold": float((alert_scores(p, healthy_idx) >= thr["threshold"]).mean()),
                    "predicted_class_counts": {classes[k]: int(v) for k, v in
                                               zip(*np.unique(p.argmax(1), return_counts=True))}}
    save_json(ood, exp_dir / "ood_blueberry_check.json")
    info["test_evaluated"] = True
    info["test_opened_at"] = out["opened_at"]
    save_json(info, exp_dir / "run_info.json")
    a = out["alert_at_frozen_threshold"]
    print(f"[{args.exp_id}] TEST acc {out['argmax']['accuracy']:.3f} | macro-recall {out['argmax']['macro_recall']:.3f} | "
          f"alerta@{thr['threshold']:.2f}: recall {a['recall']:.3f} FN {a['fn']} FP {a['fp']}")
    print("OOD arándano:", {k: (v["mean_max_prob"], v["frac_max_prob_ge_0.9"]) for k, v in ood.items()})
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
