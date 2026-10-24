"""Inferencia informativa sobre imágenes sueltas con un artefacto de modelo.

Uso: python scripts/predict.py --artifact E4c_04_originals_ce img1.jpg [img2.jpg ...]
     (o --artifact /ruta/al/artefacto). Imprime una línea JSON por imagen.

Solo necesita el artefacto (BERRYVISION_MODEL_DIR); no lee el dataset de
entrenamiento ni descarga pesos. La salida nunca es un diagnóstico.
Códigos de salida: 0 bien · 3 falta el artefacto o una imagen · 1 artefacto dañado.
"""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

VISION_ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(VISION_ROOT / "src"))

from PIL import Image  # noqa: E402

from berryvision.inference import ArtifactError, Predictor  # noqa: E402


def main() -> int:
    if hasattr(sys.stdout, "reconfigure"):
        sys.stdout.reconfigure(encoding="utf-8")
    ap = argparse.ArgumentParser()
    ap.add_argument("--artifact", required=True)
    ap.add_argument("--device", default="cpu")
    ap.add_argument("images", nargs="+", type=Path)
    a = ap.parse_args()
    try:
        pred = Predictor.load(a.artifact, a.device)
    except ArtifactError as exc:
        print(f"ERROR: {exc}", file=sys.stderr)
        return 1 if "SHA-256" in str(exc) else 3
    missing = [str(p) for p in a.images if not p.is_file()]
    if missing:
        print(f"ERROR: no existen: {missing}", file=sys.stderr)
        return 3
    for p in a.images:
        with Image.open(p) as im:
            res = pred.predict([im])[0]
        print(json.dumps({"image": str(p), **res}, ensure_ascii=False))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
