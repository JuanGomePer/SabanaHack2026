"""Evaluación complementaria en el dominio de campo con Blueberry YOLO (Zhang).

Uso: python scripts/eval_field_domain.py --artifact ID [--source blueberry_yolo_zhang] [--out JSON]

Pasa cada imagen COMPLETA (letterbox) por el modelo y resume la TASA DE ALERTA, la
distribución de clases predichas y la confianza. Las imágenes no tienen etiquetas
fitosanitarias: esto mide el comportamiento ante un dominio distinto, NO una tasa de
falsos positivos de enfermedad. No modifica umbrales ni toca el conjunto de prueba
del modelo. Verifica la fuente contra su bloqueo antes de evaluar.
"""

from __future__ import annotations

import argparse
import json
import sys
import time
from collections import Counter
from datetime import datetime, timezone
from pathlib import Path

VISION_ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(VISION_ROOT / "src"))

import numpy as np  # noqa: E402
from PIL import Image  # noqa: E402

from berryvision.datasources import IMAGE_EXT, load_sources, lock_path, read_lock, source_dir, verify_tree  # noqa: E402
from berryvision.inference import ArtifactError, Predictor  # noqa: E402
from berryvision.training.metrics import wilson_ci  # noqa: E402

CAVEAT = ("Imágenes de campo sin estado fitosanitario verificado (solo cajas de fruto verde/maduro). "
          "La tasa de alerta NO es una tasa de falsos positivos de enfermedad.")


def main() -> int:
    if hasattr(sys.stdout, "reconfigure"):
        sys.stdout.reconfigure(encoding="utf-8")
    ap = argparse.ArgumentParser()
    ap.add_argument("--artifact", required=True)
    ap.add_argument("--source", default="blueberry_yolo_zhang")
    ap.add_argument("--device", default="cpu")
    ap.add_argument("--batch", type=int, default=16)
    ap.add_argument("--out", type=Path)
    a = ap.parse_args()
    cfg = load_sources()[a.source]
    if "field_domain_evaluation" not in cfg.get("allowed_use", []):
        print(f"ERROR: {a.source} no está autorizada para evaluación de dominio")
        return 2
    root = source_dir(cfg)
    st = verify_tree(root, read_lock(lock_path(cfg)), full_hash=False)
    if not st.ok:
        print(f"ERROR: {a.source} no está íntegra ({st.status}); ejecute scripts/prepare_data.py prepare")
        return 3
    try:
        pred = Predictor.load(a.artifact, a.device)
    except ArtifactError as exc:
        print(f"ERROR: {exc}")
        return 3
    paths = sorted(p for p in root.glob("*/images/*") if p.suffix.lower() in IMAGE_EXT)
    results, t0 = [], time.perf_counter()
    for i in range(0, len(paths), a.batch):
        ims = [Image.open(p) for p in paths[i:i + a.batch]]
        results += pred.predict(ims)
        for im in ims:
            im.close()
    secs = time.perf_counter() - t0
    n, k = len(results), sum(r["alert"] for r in results)
    lo, hi = wilson_ci(k, n)
    by_split = Counter(p.parent.parent.name for p in paths)
    summary = {
        "artifact": pred.card["artifact_id"], "taxonomy": pred.card["taxonomy"],
        "intended_use": pred.card["intended_use"], "source": a.source, "license": cfg["license"],
        "evaluated_at": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        "n_images": n, "images_per_split": dict(by_split), "alert_threshold": pred.card["alert_threshold"],
        "alerts": k, "alert_rate": k / n if n else None, "alert_rate_wilson95": [lo, hi],
        "mean_confidence": float(np.mean([r["confidence"] for r in results])) if n else None,
        "frac_confidence_ge_0.9": float(np.mean([r["confidence"] >= 0.9 for r in results])) if n else None,
        "predicted_class_counts": dict(Counter(r["top_class"] for r in results)),
        "device": a.device, "seconds_total": secs, "ms_per_image_incl_io": 1000 * secs / n if n else None,
        "caveat": CAVEAT,
    }
    out = a.out or VISION_ROOT / "reports" / "experiments" / pred.card["artifact_id"] / f"field_domain_{a.source}.json"
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(json.dumps(summary, indent=2, ensure_ascii=False), encoding="utf-8")
    print(json.dumps({k: v for k, v in summary.items() if k not in ("intended_use",)}, indent=2, ensure_ascii=False))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
