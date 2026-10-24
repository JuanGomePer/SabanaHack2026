"""Descarga y extrae de forma segura un dataset distribuido como archivo único.

  afzaal_strawberry
      Strawberry Disease Detection (Afzaal et al., 2021), export de Dataset Ninja
      en formato Supervisely (~344 MB). URL tomada del registro oficial del paquete
      dataset-tools 0.2.6 (data/download_urls/released_datasets.json). CC BY 4.0.

  strawberry_hybrid
      Strawberry Disease Detection Dataset with Hybrid Data Augmentation v1
      (Mendeley k2ptxmfjhj, ~545 MB zip con las variantes 'hybrid' y 'traditional').
      CC BY-NC 4.0: uso académico/no comercial.

Uso: python scripts/acquire/fetch_archive.py {afzaal_strawberry|strawberry_hybrid}
         [--keep-archive] [--archive RUTA_ZIP_YA_DESCARGADO]
"""

from __future__ import annotations

import shutil
import sys
from pathlib import Path

VISION_ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(VISION_ROOT / "src"))

from berryvision.acquisition import DownloadError, download, safe_extract, sha256_path, write_manifest  # noqa: E402

SOURCES = {
    "afzaal_strawberry": {
        "url": ("https://www.dropbox.com/scl/fi/obs4cf3zm5jac8ggc1vx1/"
                "strawberry-disease-detection-DatasetNinja.tar?rlkey=j1ho5xhk3alh3fu3mce5d8bxl&dl=1"),
        "filename": "strawberry-disease-detection-DatasetNinja.tar",
        "url_source": "dataset-tools 0.2.6, dataset_tools/data/download_urls/released_datasets.json",
        "license": "CC BY 4.0 (Dataset Ninja / artículo MDPI); ~20 % de imágenes de fuentes en línea",
        "citation": "Afzaal, U., Bhattarai, B., Pandeya, Y. R., & Lee, J. (2021). Sensors 21(19), 6565. doi:10.3390/s21196565",
    },
    "strawberry_hybrid": {
        "url": "https://data.mendeley.com/public-api/zip/k2ptxmfjhj/download/1",
        "filename": "k2ptxmfjhj-1.zip",
        "url_source": "API pública de Mendeley Data (redirección firmada a S3, expira en 300 s)",
        "license": "CC BY-NC 4.0 (no comercial). Bases de Afzaal 2021 y Pérez-Borrero 2020",
        "citation": "Galarza-Falfan, J. et al. (2025). Strawberry Disease Detection Dataset with Hybrid Data Augmentation. Mendeley Data, v1. doi:10.17632/k2ptxmfjhj.1",
    },
}


def main() -> int:
    if hasattr(sys.stdout, "reconfigure"):
        sys.stdout.reconfigure(encoding="utf-8")
    args = sys.argv[1:]
    if not args or args[0] not in SOURCES:
        print(f"Uso: {Path(__file__).name} {{{'|'.join(SOURCES)}}} [--keep-archive]")
        return 2
    sid, cfg = args[0], SOURCES[args[0]]
    dest = VISION_ROOT / "data" / "external" / sid
    if dest.exists() and any(dest.iterdir()):
        print(f"{dest} ya existe y no está vacío; no se sobrescribe")
        return 1
    free_gb = shutil.disk_usage(VISION_ROOT).free / 1e9
    if free_gb < 5:
        print(f"Espacio libre insuficiente: {free_gb:.1f} GB")
        return 1
    archive = VISION_ROOT / "data" / "raw" / "_downloads" / cfg["filename"]
    local = args[args.index("--archive") + 1] if "--archive" in args else None
    if local:
        archive = Path(local)
        print(f"Usando archivo ya descargado: {archive}")
    else:
        print(f"Descargando {sid} → {archive}")
        try:
            download(cfg["url"], archive, timeout=1200)
        except DownloadError as exc:
            print(f"NO DISPONIBLE: {exc}.")
            return 4
    digest = sha256_path(archive)
    n = safe_extract(archive, dest / "extracted")
    write_manifest(dest, dataset_id=sid, url=cfg["url"], url_source=cfg["url_source"],
                   license=cfg["license"], citation=cfg["citation"], archive_name=cfg["filename"],
                   archive_bytes=archive.stat().st_size, archive_sha256=digest, n_files_extracted=n)
    if "--keep-archive" not in args and not local:
        archive.unlink()
    print(f"{n} archivos extraídos en {dest / 'extracted'}; sha256 {digest[:16]}…")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
