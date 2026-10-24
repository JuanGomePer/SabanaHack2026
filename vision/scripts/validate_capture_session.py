"""Valida una sesión de captura de AGRAR antes de usarla (solo lectura).

Uso: python scripts/validate_capture_session.py data/raw/agrar/<farm_id>/<session_id>

Comprueba, sobre captures.jsonl (una línea por imagen, esquema agrar_capture_metadata):
- reglas de metadatos (berryvision.capture_metadata.validate_capture);
- que cada archivo exista y que su SHA-256 coincida si viene declarado;
- balance de comparabilidad: por cada condición positiva, cuántas imágenes `no_visible_symptoms`
  hay con la MISMA cámara y sesión (lección D-033: clase confundida con la fuente);
- distribución de niveles de evidencia (cuántas confirmadas frente a sospechadas).
No modifica archivos.
"""

from __future__ import annotations

import json
import sys
from collections import Counter
from pathlib import Path

VISION_ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(VISION_ROOT / "src"))

from berryvision.audit import sha256_file  # noqa: E402
from berryvision.capture_metadata import validate_capture  # noqa: E402


def main() -> int:
    if hasattr(sys.stdout, "reconfigure"):
        sys.stdout.reconfigure(encoding="utf-8")
    if len(sys.argv) != 2:
        print(__doc__)
        return 2
    sess = Path(sys.argv[1])
    lines = [l for l in (sess / "captures.jsonl").read_text(encoding="utf-8").splitlines() if l.strip()]
    problems, evidence, by_cam = [], Counter(), Counter()
    for k, line in enumerate(lines, 1):
        rec = json.loads(line)
        for p in validate_capture(rec):
            problems.append(f"línea {k} ({rec.get('image_id')}): {p}")
        f = rec.get("file") or {}
        if f.get("rel_path"):
            path = sess / f["rel_path"]
            if not path.exists():
                problems.append(f"línea {k}: no existe {f['rel_path']}")
            elif f.get("sha256") and sha256_file(path) != f["sha256"]:
                problems.append(f"línea {k}: SHA-256 distinto en {f['rel_path']}")
        cam = rec.get("camera", {}).get("camera_id")
        for a in rec.get("annotations", []):
            evidence[(a.get("label"), a.get("evidence_level"))] += 1
            by_cam[(cam, rec.get("session_id"), a.get("label"))] += 1
    print(f"{len(lines)} imágenes · {len(problems)} problemas")
    for p in problems[:50]:
        print("  -", p)
    print("Etiquetas por nivel de evidencia:")
    for (lab, ev), n in sorted(evidence.items()):
        print(f"  {lab:32s} {ev:20s} {n}")
    print("Comparabilidad (misma cámara y sesión):")
    for (cam, s, lab), n in sorted(by_cam.items()):
        if lab != "no_visible_symptoms":
            neg = by_cam.get((cam, s, "no_visible_symptoms"), 0)
            flag = "" if neg >= n else "  ← faltan negativos pareados"
            print(f"  {cam} / {s}: {lab} {n} vs no_visible_symptoms {neg}{flag}")
    return 1 if problems else 0


if __name__ == "__main__":
    raise SystemExit(main())
