"""Descarga una versión concreta de un dataset de Roboflow Universe (p. ej. DrBerry).

Requiere una API key personal en la variable de entorno ROBOFLOW_API_KEY
(cuenta gratuita de Roboflow). La key NUNCA se escribe en archivos, logs ni en
el manifiesto. Usa la API REST pública sin instalar el SDK de Roboflow.

Uso (cuando exista la variable de entorno):
    python scripts/acquire/fetch_roboflow.py drberry drberry-original-data 1 yolov8
    python scripts/acquire/fetch_roboflow.py drberry drberry-gen-3-20 1 yolov8

Formato recomendado: 'yolov8' (TXT + data.yaml), o 'coco' para conservar polígonos
si los hubiera. Importante: la versión 1 de drberry-original-data se exportó con
"Resize: Stretch to 1024x1024" (verificado en la ficha); las imágenes vendrán
estiradas. Ver docs/11_dataset_strategy.md.
"""

from __future__ import annotations

import json
import os
import sys
import urllib.parse
import urllib.request
from pathlib import Path

VISION_ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(VISION_ROOT / "src"))

from berryvision.acquisition import USER_AGENT, download, safe_extract, sha256_path, write_manifest  # noqa: E402

LICENSES = {"drberry": "CC BY 4.0 (declarada en Roboflow Universe)"}
CITATIONS = {"drberry": "Morales, C., Cavero, E., & Ugarte, W. (2023). DrBerry. KDIR 2023. doi:10.5220/0012207100003598"}


def main() -> int:
    if hasattr(sys.stdout, "reconfigure"):
        sys.stdout.reconfigure(encoding="utf-8")
    if len(sys.argv) != 5:
        print(__doc__)
        return 2
    workspace, project, version, fmt = sys.argv[1:]
    key = os.environ.get("ROBOFLOW_API_KEY")
    if not key:
        print("ROBOFLOW_API_KEY no está definida. Defínala en su sesión (no en archivos del repo) y reintente.")
        return 3
    dest = VISION_ROOT / "data" / "external" / f"{project}_v{version}_{fmt}"
    if dest.exists() and any(dest.iterdir()):
        print(f"{dest} ya existe y no está vacío; no se sobrescribe")
        return 1
    meta_url = f"https://api.roboflow.com/{workspace}/{project}/{version}/{fmt}?" + urllib.parse.urlencode({"api_key": key})
    req = urllib.request.Request(meta_url, headers={"User-Agent": USER_AGENT})
    with urllib.request.urlopen(req, timeout=120) as r:
        meta = json.load(r)
    link = meta.get("export", {}).get("link")
    if not link:
        print("La API no devolvió un enlace de exportación (puede estar generándose; reintente en unos minutos).")
        return 1
    archive = VISION_ROOT / "data" / "raw" / "_downloads" / f"{project}_v{version}_{fmt}.zip"
    download(link, archive, timeout=600)
    n = safe_extract(archive, dest / "extracted")
    version_meta = meta.get("version", {})
    write_manifest(
        dest, dataset_id=f"{workspace}/{project}", version=version, export_format=fmt,
        universe_url=f"https://universe.roboflow.com/{workspace}/{project}/dataset/{version}",
        license=LICENSES.get(workspace, "verificar en la ficha"), citation=CITATIONS.get(workspace),
        roboflow_version_info={k: version_meta.get(k) for k in ("id", "name", "created", "images", "splits",
                                                                 "preprocessing", "augmentation", "classes")},
        archive_sha256=sha256_path(archive), n_files_extracted=n,
    )
    archive.unlink()
    print(f"{n} archivos en {dest / 'extracted'}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
