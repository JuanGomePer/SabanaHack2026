"""Genera tablas desde knowledge/datasets/blueberry_image_sources.yaml (fuente única de verdad).

Salidas (versionables, solo metadatos):
  reports/blueberry_image_repository_matrix.csv   matriz completa por fuente
  manifests/public_image_sources.csv              fuentes con su estado de adquisición local

Para las fuentes con data/external/<id>/ACQUISITION.json añade fecha, sha256 del archivo
descargado y nº de archivos extraídos, y el nº de imágenes de la última auditoría local.
"""

from __future__ import annotations

import csv
import json
import sys
from pathlib import Path

import yaml

VISION_ROOT = Path(__file__).resolve().parents[1]
FIELDS = ["id", "title", "url", "authors", "published", "crop", "organ", "target", "n_images", "n_instances",
          "classes", "annotation", "resolution", "capture", "data_kind", "license", "access", "status", "role",
          "duplicates", "relevance", "limitations", "next"]
# Alias de carpeta local cuando el id del catálogo difiere del de la descarga
LOCAL_DIR = {"strawberry_hybrid_traditional": "strawberry_hybrid"}


def flat(v) -> str:
    if isinstance(v, list):
        return "; ".join(flat(x) for x in v)
    return "" if v is None else str(v)


def main() -> int:
    if hasattr(sys.stdout, "reconfigure"):
        sys.stdout.reconfigure(encoding="utf-8")
    data = yaml.safe_load((VISION_ROOT / "knowledge/datasets/blueberry_image_sources.yaml").read_text(encoding="utf-8"))
    rows = data["sources"]
    ids = [r["id"] for r in rows]
    if len(ids) != len(set(ids)):
        raise SystemExit("ids duplicados en el catálogo")
    out = VISION_ROOT / "reports" / "blueberry_image_repository_matrix.csv"
    with open(out, "w", newline="", encoding="utf-8") as fh:
        w = csv.writer(fh)
        w.writerow(FIELDS)
        for r in rows:
            w.writerow([flat(r.get(f)) for f in FIELDS])
    man = VISION_ROOT / "manifests" / "public_image_sources.csv"
    with open(man, "w", newline="", encoding="utf-8") as fh:
        w = csv.writer(fh)
        w.writerow(["id", "status", "role", "license", "local_dir", "acquired_at", "archive_sha256",
                     "n_files_extracted", "audited_images", "audited_instances"])
        for r in rows:
            d = VISION_ROOT / "data" / "external" / LOCAL_DIR.get(r["id"], r["id"])
            acq = json.loads((d / "ACQUISITION.json").read_text(encoding="utf-8")) if (d / "ACQUISITION.json").exists() else {}
            aud_path = VISION_ROOT / "reports" / "audits" / f"{d.name}.json"
            aud = json.loads(aud_path.read_text(encoding="utf-8")) if aud_path.exists() else {}
            inst = max((a["n_instances"] for a in aud.get("annotations", [])), default="")
            w.writerow([r["id"], r["status"], r["role"], flat(r.get("license")),
                        f"data/external/{d.name}" if acq else "", acq.get("acquired_at", ""),
                        acq.get("archive_sha256", "") or ("por archivo (ver ACQUISITION.json)" if acq.get("sha256") else ""),
                        acq.get("n_files_extracted", acq.get("n_downloaded", "")), aud.get("n_images", ""), inst])
    print(f"{len(rows)} fuentes → {out.relative_to(VISION_ROOT)} y {man.relative_to(VISION_ROOT)}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
