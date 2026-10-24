"""Exporta un experimento entrenado a un artefacto de inferencia autocontenido.

Uso: python scripts/export_model_artifact.py E4c_04_originals_ce [--out DIR]

Lee `runs/<id>/best.pt` (checkpoint de entrenamiento), la configuración de
`reports/experiments/<id>/run_info.json` y el umbral CONGELADO en validación de
`val_thresholds.json`; escribe `<BERRYVISION_MODEL_DIR>/<id>/{model.pt, model_card.json}`.
No sobrescribe un artefacto existente. El artefacto no se versiona en Git ni se
incluye en la imagen Docker: se monta en tiempo de ejecución.
"""

from __future__ import annotations

import argparse
import json
import sys
from datetime import datetime, timezone
from pathlib import Path

VISION_ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(VISION_ROOT / "src"))

import torch  # noqa: E402

from berryvision.acquisition import sha256_path  # noqa: E402
from berryvision.storage import model_dir  # noqa: E402

TAXONOMY_BY_SOURCE = {
    "strawberry_traditional": "strawberry_aux/afzaal+perez_borrero",
}
INTENDED_USE_BY_SOURCE = {
    "strawberry_traditional": ("AUXILIAR: valida el pipeline con enfermedades de FRESA. "
                               "No detecta enfermedades de arándano; su alerta sobre arándano no es interpretable."),
}


def main() -> int:
    if hasattr(sys.stdout, "reconfigure"):
        sys.stdout.reconfigure(encoding="utf-8")
    ap = argparse.ArgumentParser()
    ap.add_argument("experiment")
    ap.add_argument("--out", type=Path, help="directorio de modelos (por defecto BERRYVISION_MODEL_DIR)")
    a = ap.parse_args()
    exp = a.experiment
    ckpt_path = VISION_ROOT / "runs" / exp / "best.pt"
    rep = VISION_ROOT / "reports" / "experiments" / exp
    for p in (ckpt_path, rep / "run_info.json", rep / "val_thresholds.json"):
        if not p.is_file():
            print(f"ERROR: falta {p}")
            return 3
    info = json.loads((rep / "run_info.json").read_text(encoding="utf-8"))
    thr = json.loads((rep / "val_thresholds.json").read_text(encoding="utf-8"))
    if not thr.get("frozen") or thr.get("selected_on") != "val":
        print("ERROR: el umbral no está congelado en validación; no se exporta")
        return 1
    cfg = info["config"]
    dest = (a.out or model_dir()) / exp
    if dest.exists():
        print(f"{dest} ya existe; no se sobrescribe")
        return 1
    ckpt = torch.load(ckpt_path, map_location="cpu", weights_only=False)  # checkpoint propio de runs/
    if ckpt["classes"] != cfg["data"]["classes"]:
        print("ERROR: las clases del checkpoint no coinciden con la configuración")
        return 1
    dest.mkdir(parents=True)
    weights = dest / "model.pt"
    torch.save(ckpt["model"], weights)
    src = cfg["data"]["source_id"]
    card = {
        "artifact_id": exp, "created_at": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        "arch": cfg["model"]["name"], "dropout": cfg["model"].get("dropout", 0.0),
        "imgsz": cfg["model"]["imgsz"], "preprocess": "letterbox (sin estirar) + normalización ImageNet",
        "classes": ckpt["classes"], "healthy_class": cfg["data"]["healthy_class"],
        "alert_threshold": thr["threshold"], "alert_rule": thr.get("rule"), "threshold_selected_on": "val",
        "best_epoch": ckpt.get("epoch"), "training_source": src,
        "taxonomy": TAXONOMY_BY_SOURCE.get(src, src),
        "intended_use": INTENDED_USE_BY_SOURCE.get(src, "ver reports/experiments"),
        "weights_file": weights.name, "weights_sha256": sha256_path(weights),
        "source_checkpoint_sha256": sha256_path(ckpt_path),
        "code": info.get("git"), "is_diagnosis": False,
    }
    (dest / "model_card.json").write_text(json.dumps(card, indent=2, ensure_ascii=False), encoding="utf-8")
    print(f"{dest}: {weights.stat().st_size / 1e6:.1f} MB, sha256 {card['weights_sha256'][:12]}…")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
