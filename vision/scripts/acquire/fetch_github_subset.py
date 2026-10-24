"""Descarga un SUBCONJUNTO de imágenes de un repositorio de GitHub, fijando el commit.

Fuentes soportadas (elegidas en docs/12_data_acquisition_and_audit.md):

  plantvillage_blueberry_healthy
      spMohanty/PlantVillage-Dataset, carpeta raw/color/Blueberry___healthy
      (1.502 JPG, ~26.5 MB). Licencia: CC BY-SA 3.0 según la ficha de Hugging Face
      del mismo autor; el repositorio de GitHub no tiene archivo de licencia.
  plantdoc_blueberry
      pratikkayal/PlantDoc-Object-Detection-Dataset: solo las imágenes que los CSV
      etiquetan como 'Blueberry leaf' (+ sus filas de cajas). CC BY 4.0 declarada;
      las fotos se obtuvieron de internet (derechos originales inciertos).

Uso:
    python scripts/acquire/fetch_github_subset.py plantvillage_blueberry_healthy
    python scripts/acquire/fetch_github_subset.py plantdoc_blueberry
Opcional: GITHUB_TOKEN en el entorno para evitar el límite de la API (no se guarda).
"""

from __future__ import annotations

import csv
import io
import json
import os
import sys
import urllib.parse
import urllib.request
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

VISION_ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(VISION_ROOT / "src"))

from berryvision.acquisition import USER_AGENT, download, local_name, sha256_path, write_manifest  # noqa: E402

SOURCES = {
    "plantvillage_blueberry_healthy": {
        "repo": "spMohanty/PlantVillage-Dataset", "branch": "master",
        "folder": "raw/color/Blueberry___healthy",
        "license": "CC BY-SA 3.0 (ficha de Hugging Face mohanty/PlantVillage; sin LICENSE en GitHub)",
        "citation": "Hughes, D. P., & Salathé, M. (2015). arXiv:1511.08060",
    },
    "plantdoc_blueberry": {
        "repo": "pratikkayal/PlantDoc-Object-Detection-Dataset", "branch": "master",
        "csv": {"TRAIN": "train_labels.csv", "TEST": "test_labels.csv"}, "label": "Blueberry leaf",
        "license": "CC BY 4.0 (LICENSE.txt del repositorio); imágenes recopiladas de internet",
        "citation": "Singh, D. et al. (2020). PlantDoc. CoDS-COMAD. arXiv:1911.10317",
    },
}


def _api(url: str):
    headers = {"User-Agent": USER_AGENT, "Accept": "application/vnd.github+json"}
    if os.environ.get("GITHUB_TOKEN"):
        headers["Authorization"] = f"Bearer {os.environ['GITHUB_TOKEN']}"
    with urllib.request.urlopen(urllib.request.Request(url, headers=headers), timeout=60) as r:
        return json.load(r)


def _raw(repo: str, commit: str, path: str) -> str:
    return f"https://raw.githubusercontent.com/{repo}/{commit}/{urllib.parse.quote(path)}"


def _resolve_commit(repo: str, branch: str) -> str:
    return _api(f"https://api.github.com/repos/{repo}/commits/{branch}")["sha"]


def _plan_folder(cfg: dict, commit: str) -> list[tuple[str, str]]:
    parent, name = cfg["folder"].rsplit("/", 1)
    listing = _api(f"https://api.github.com/repos/{cfg['repo']}/contents/{parent}?ref={commit}")
    sha = next(x["sha"] for x in listing if x["name"] == name)
    tree = _api(f"https://api.github.com/repos/{cfg['repo']}/git/trees/{sha}")
    if tree.get("truncated"):
        raise RuntimeError("Listado truncado por la API de GitHub")
    return [(f"{cfg['folder']}/{t['path']}", f"images/{t['path']}") for t in tree["tree"] if t["type"] == "blob"]


def _plan_plantdoc(cfg: dict, commit: str, dest: Path) -> list[tuple[str, str]]:
    plan = []
    for split, csv_name in cfg["csv"].items():
        req = urllib.request.Request(_raw(cfg["repo"], commit, csv_name), headers={"User-Agent": USER_AGENT})
        text = urllib.request.urlopen(req, timeout=60).read().decode("utf-8")
        rows = [r for r in csv.DictReader(io.StringIO(text)) if r["class"] == cfg["label"]]
        local = {}
        for fname in sorted({r["filename"] for r in rows}):
            local[fname] = local_name(fname, len(plan))
            plan.append((f"{split}/{fname}", f"images/{split.lower()}/{local[fname]}"))
        for r in rows:
            r["local_filename"] = local[r["filename"]]
        out = dest / "labels" / f"{split.lower()}_blueberry_labels.csv"
        out.parent.mkdir(parents=True, exist_ok=True)
        with open(out, "w", newline="", encoding="utf-8") as fh:
            w = csv.DictWriter(fh, fieldnames=list(rows[0].keys()))
            w.writeheader()
            w.writerows(rows)
    return plan


def main() -> int:
    if hasattr(sys.stdout, "reconfigure"):
        sys.stdout.reconfigure(encoding="utf-8")
    if len(sys.argv) != 2 or sys.argv[1] not in SOURCES:
        print(f"Uso: {Path(__file__).name} {{{'|'.join(SOURCES)}}}")
        return 2
    sid = sys.argv[1]
    cfg = SOURCES[sid]
    dest = VISION_ROOT / "data" / "external" / sid
    if dest.exists() and any(dest.iterdir()):
        print(f"{dest} ya existe y no está vacío; no se sobrescribe")
        return 1
    commit = _resolve_commit(cfg["repo"], cfg["branch"])
    plan = _plan_folder(cfg, commit) if "folder" in cfg else _plan_plantdoc(cfg, commit, dest)
    print(f"{sid}: {len(plan)} archivos desde {cfg['repo']}@{commit[:10]}")

    failures: list[str] = []

    def fetch(item):
        src, rel = item
        try:
            download(_raw(cfg["repo"], commit, src), dest / rel)
        except Exception as exc:  # se registra y se continúa
            failures.append(f"{src}: {exc}")

    with ThreadPoolExecutor(max_workers=8) as pool:
        list(pool.map(fetch, plan))

    files = sorted(p for p in (dest / "images").rglob("*") if p.is_file())
    # Mapeo nombre original (ruta en el repo de origen) -> archivo local
    with open(dest / "file_map.csv", "w", newline="", encoding="utf-8") as fh:
        w = csv.writer(fh)
        w.writerow(["source_path", "local_path"])
        w.writerows(plan)
    write_manifest(
        dest, dataset_id=sid, source_repo=f"https://github.com/{cfg['repo']}", commit=commit,
        subset=cfg.get("folder") or f"label == '{cfg['label']}'", license=cfg["license"],
        citation=cfg["citation"], n_planned=len(plan), n_downloaded=len(files), failures=failures,
        sha256={p.relative_to(dest).as_posix(): sha256_path(p) for p in files},
    )
    print(f"descargados {len(files)}/{len(plan)}; fallos {len(failures)}; manifiesto en {dest / 'ACQUISITION.json'}")
    return 0 if not failures else 1


if __name__ == "__main__":
    raise SystemExit(main())
