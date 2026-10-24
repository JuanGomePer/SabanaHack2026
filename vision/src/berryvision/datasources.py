"""Fuentes de datos autorizadas: manifiesto, bloqueo por hashes y preparación idempotente.

`configs/data_sources.yaml` declara las fuentes autorizadas (DrBerry como principal
y Blueberry YOLO de Zhang como complementaria). Cada fuente preparada se congela en
un archivo de bloqueo versionado (`manifests/data_lock/<id>.csv`: ruta, bytes y
SHA-256 de cada archivo). Con él se sabe si la copia local está completa, modificada
o ausente sin versionar ninguna imagen.

Reglas de la preparación:
- si la copia ya coincide con el bloqueo, no se descarga nada;
- nunca se sobrescribe un directorio existente que no coincide (se informa y se para);
- se descarga a `.part`, se verifica tamaño y MD5, se extrae a un directorio de
  preparación y solo se mueve al destino definitivo tras validar etiquetas y hashes;
- una preparación parcial nunca termina con éxito.
"""

from __future__ import annotations

import csv
import json
import os
import shutil
import urllib.parse
import urllib.request
from dataclasses import dataclass, field
from pathlib import Path

import yaml

from .acquisition import USER_AGENT, download, md5_path, safe_extract, sha256_path, write_manifest
from .storage import VISION_ROOT, data_dir

SOURCES_PATH = VISION_ROOT / "configs" / "data_sources.yaml"
IMAGE_EXT = {".jpg", ".jpeg", ".png", ".bmp", ".webp"}


class PreparationError(RuntimeError):
    """La preparación no puede completarse de forma íntegra."""


def load_sources(path: Path = SOURCES_PATH) -> dict:
    return yaml.safe_load(Path(path).read_text(encoding="utf-8"))["sources"]


def source_dir(cfg: dict, root: Path | None = None) -> Path:
    """Directorio de los archivos de la fuente (`<data>/<location>/extracted`)."""
    return (root or data_dir()) / cfg["location"] / "extracted"


def lock_path(cfg: dict) -> Path:
    return VISION_ROOT / cfg["lock"]


# ── Bloqueo por hashes ───────────────────────────────────────────────────────

def tree_rows(root: Path, exclude: frozenset[str] = frozenset()) -> list[dict]:
    rows = []
    for p in sorted(root.rglob("*")):
        if p.is_file() and p.relative_to(root).as_posix() not in exclude:
            rows.append({"path": p.relative_to(root).as_posix(), "bytes": p.stat().st_size,
                         "sha256": sha256_path(p)})
    return rows


def write_lock(rows: list[dict], path: Path) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with open(path, "w", newline="", encoding="utf-8") as fh:
        w = csv.DictWriter(fh, fieldnames=["path", "bytes", "sha256"], lineterminator="\n")
        w.writeheader()
        w.writerows(rows)


def read_lock(path: Path) -> list[dict]:
    with open(path, newline="", encoding="utf-8") as fh:
        return [{**r, "bytes": int(r["bytes"])} for r in csv.DictReader(fh)]


@dataclass
class TreeStatus:
    status: str                      # complete | missing | incomplete | modified | unlocked
    missing: list[str] = field(default_factory=list)
    changed: list[str] = field(default_factory=list)
    extra: list[str] = field(default_factory=list)
    n_files: int = 0

    @property
    def ok(self) -> bool:
        return self.status == "complete"


def verify_tree(root: Path, lock: list[dict] | None, full_hash: bool = True,
                exclude: frozenset[str] = frozenset()) -> TreeStatus:
    """Compara el árbol local con el bloqueo. `full_hash=False` solo compara tamaños (rápido)."""
    if not root.is_dir() or not any(root.iterdir()):
        return TreeStatus("missing")
    present = {p.relative_to(root).as_posix(): p for p in root.rglob("*")
               if p.is_file() and p.relative_to(root).as_posix() not in exclude}
    if lock is None:
        return TreeStatus("unlocked", n_files=len(present))
    expected = {r["path"]: r for r in lock}
    missing = sorted(set(expected) - set(present))
    extra = sorted(set(present) - set(expected))
    changed = []
    for rel in sorted(set(expected) & set(present)):
        p, r = present[rel], expected[rel]
        if p.stat().st_size != r["bytes"] or (full_hash and sha256_path(p) != r["sha256"]):
            changed.append(rel)
    status = "complete"
    if changed or extra:
        status = "modified"
    elif missing:
        status = "incomplete"
    return TreeStatus(status, missing, changed, extra, len(present))


# ── Validación de etiquetas ──────────────────────────────────────────────────

def validate_yolo(root: Path, n_classes: int) -> dict:
    """Valida un export YOLO (split/images + split/labels). Devuelve conteos reales y problemas."""
    problems, per_split, class_counts = [], {}, [0] * n_classes
    for img_dir in sorted(root.glob("*/images")):
        split = img_dir.parent.name
        lab_dir = img_dir.parent / "labels"
        images = {p.stem: p for p in img_dir.iterdir() if p.suffix.lower() in IMAGE_EXT}
        labels = {p.stem: p for p in lab_dir.glob("*.txt")} if lab_dir.is_dir() else {}
        for stem in sorted(set(images) - set(labels)):
            problems.append(f"{split}: imagen sin archivo de etiquetas: {stem}")
        for stem in sorted(set(labels) - set(images)):
            problems.append(f"{split}: etiquetas sin imagen: {stem}")
        n_boxes = 0
        for stem, lp in labels.items():
            for k, line in enumerate(lp.read_text(encoding="utf-8").splitlines(), 1):
                if not line.strip():
                    continue
                parts = line.split()
                try:
                    cls, xc, yc, w, h = int(parts[0]), *map(float, parts[1:5])
                except (ValueError, IndexError):
                    problems.append(f"{split}/{stem}:{k}: línea no válida")
                    continue
                if len(parts) != 5:
                    problems.append(f"{split}/{stem}:{k}: se esperaban 5 campos (caja), hay {len(parts)}")
                if not 0 <= cls < n_classes:
                    problems.append(f"{split}/{stem}:{k}: clase {cls} fuera de [0,{n_classes})")
                    continue
                if not all(0.0 <= v <= 1.0 for v in (xc, yc, w, h)) or w <= 0 or h <= 0:
                    problems.append(f"{split}/{stem}:{k}: coordenadas fuera de [0,1]")
                class_counts[cls] += 1
                n_boxes += 1
        per_split[split] = {"images": len(images), "label_files": len(labels), "boxes": n_boxes}
    if not per_split:
        problems.append("no se encontró ningún directorio <split>/images")
    return {"per_split": per_split, "class_box_counts": class_counts,
            "images": sum(s["images"] for s in per_split.values()),
            "boxes": sum(s["boxes"] for s in per_split.values()), "problems": problems}


def validate_coco(root: Path) -> dict:
    """Valida exports COCO de Roboflow (<split>/_annotations.coco.json)."""
    problems, per_split, cats = [], {}, {}
    for ann in sorted(root.glob("*/_annotations.coco.json")):
        split = ann.parent.name
        data = json.loads(ann.read_text(encoding="utf-8"))
        cats.update({c["id"]: c["name"] for c in data.get("categories", [])})
        imgs = {i["id"]: i for i in data.get("images", [])}
        for i in imgs.values():
            if not (ann.parent / i["file_name"]).is_file():
                problems.append(f"{split}: falta la imagen {i['file_name']}")
        n_boxes = 0
        for a in data.get("annotations", []):
            im = imgs.get(a.get("image_id"))
            if im is None:
                problems.append(f"{split}: anotación {a.get('id')} sin imagen")
                continue
            if a.get("category_id") not in cats:
                problems.append(f"{split}: anotación {a.get('id')} con categoría desconocida")
            x, y, w, h = a.get("bbox", [0, 0, 0, 0])
            if w <= 0 or h <= 0 or x < -1 or y < -1 or x + w > im["width"] + 1 or y + h > im["height"] + 1:
                problems.append(f"{split}: anotación {a.get('id')} con caja fuera de la imagen")
            n_boxes += 1
        per_split[split] = {"images": len(imgs), "boxes": n_boxes}
    if not per_split:
        problems.append("no se encontró ningún <split>/_annotations.coco.json")
    return {"per_split": per_split, "categories": cats,
            "images": sum(s["images"] for s in per_split.values()),
            "boxes": sum(s["boxes"] for s in per_split.values()), "problems": problems}


def validate_labels(cfg: dict, root: Path) -> dict:
    schema = cfg["annotation"]["format"]
    if schema == "yolo":
        return validate_yolo(root, len(cfg["annotation"]["classes"]))
    if schema == "coco":
        return validate_coco(root)
    raise ValueError(f"formato de anotación no soportado: {schema}")


# ── Partición por procedencia ────────────────────────────────────────────────

def origin_groups(cfg: dict, root: Path) -> list[dict]:
    """Una fila por imagen con su foto de origen (según `origin_pattern`) y la partición del autor."""
    import re
    pat = re.compile(cfg["origin_pattern"])
    rows = []
    for p in sorted(root.glob("*/images/*")):
        if p.suffix.lower() not in IMAGE_EXT:
            continue
        m = pat.match(p.name)
        if not m:
            raise PreparationError(f"{p.name} no sigue origin_pattern; no se puede agrupar por procedencia")
        rows.append({"rel_path": p.relative_to(root).as_posix(), "origin": m.group(1),
                     "author_split": p.parent.parent.name})
    return rows


def group_split_rows(cfg: dict, root: Path, seed: int = 0, ratios=(0.7, 0.15, 0.15)) -> list[dict]:
    """Asigna cada foto de origen completa a un único split (hash estable de seed y origen)."""
    from .splits import assign_splits, leakage
    rows = origin_groups(cfg, root)
    groups = {r["rel_path"]: r["origin"] for r in rows}
    split_of = assign_splits(groups, ratios=ratios, seed=seed)
    if leakage(split_of, groups):
        raise PreparationError("la partición por grupos tiene fugas")
    return [{**r, "group_split": split_of[r["rel_path"]]} for r in rows]


# ── Preparación ──────────────────────────────────────────────────────────────

def _roboflow_export(cfg: dict, key: str) -> tuple[str, dict]:
    rf = cfg["roboflow"]
    base = f"https://api.roboflow.com/{rf['workspace']}/{rf['project']}"
    q = urllib.parse.urlencode({"api_key": key})
    version = rf.get("version")
    if version is None:  # la versión más reciente publicada, registrada después en el manifiesto
        with urllib.request.urlopen(urllib.request.Request(f"{base}?{q}", headers={"User-Agent": USER_AGENT}),
                                    timeout=120) as r:
            versions = json.load(r).get("versions", [])
        if not versions:
            raise PreparationError("Roboflow no devolvió versiones para el proyecto")
        version = max(int(str(v["id"]).rsplit("/", 1)[-1]) for v in versions)
    url = f"{base}/{version}/{rf['format']}?{q}"
    with urllib.request.urlopen(urllib.request.Request(url, headers={"User-Agent": USER_AGENT}), timeout=120) as r:
        meta = json.load(r)
    link = meta.get("export", {}).get("link")
    if not link:
        raise PreparationError("Roboflow no devolvió enlace de exportación (puede estar generándose; reintente)")
    info = meta.get("version", {})
    return link, {"version": version, **{k: info.get(k) for k in ("id", "name", "created", "images", "splits",
                                                                   "preprocessing", "augmentation", "classes")}}


def prepare(source_id: str, cfg: dict, root: Path | None = None, archive: Path | None = None,
            keep_archive: bool = True, log=print) -> dict:
    """Deja la fuente íntegra en `<data>/<location>/extracted`. Idempotente.

    Devuelve un resumen; lanza PreparationError si no puede garantizar una copia íntegra.
    """
    root = root or data_dir()
    dest = source_dir(cfg, root)
    lp = lock_path(cfg)
    lock = read_lock(lp) if lp.exists() else None

    st = verify_tree(dest, lock)
    if st.ok:
        log(f"[{source_id}] ya está íntegra ({st.n_files} archivos coinciden con el bloqueo); no se descarga")
        return {"action": "none", "status": st.status, "n_files": st.n_files}
    if st.status != "missing":
        raise PreparationError(
            f"[{source_id}] {dest} existe y su estado es '{st.status}' "
            f"(faltan {len(st.missing)}, cambiados {len(st.changed)}, sobrantes {len(st.extra)}). "
            "No se sobrescribe: muévalo a otra ubicación o revise el bloqueo antes de reintentar.")

    downloads = root / "raw" / "_downloads"
    meta: dict = {}
    if cfg["kind"] == "archive":
        a = cfg["archive"]
        archive = archive or downloads / a["filename"]
        if archive.exists() and archive.stat().st_size == a["size"] and md5_path(archive) == a["md5"]:
            log(f"[{source_id}] archivo ya descargado y verificado: {archive.name}")
        else:
            if archive.exists():
                raise PreparationError(f"[{source_id}] {archive} existe pero no coincide en tamaño/MD5; no se usa")
            log(f"[{source_id}] descargando {a['filename']} ({a['size'] / 1e6:.1f} MB)")
            download(a["url"], archive, timeout=600, expected_size=a["size"], expected_md5=a["md5"])
        if a.get("sha256") and sha256_path(archive) != a["sha256"]:
            raise PreparationError(f"[{source_id}] SHA-256 del archivo distinto del registrado")
    elif cfg["kind"] == "roboflow":
        key = os.environ.get("ROBOFLOW_API_KEY")
        if not key:
            raise PreparationError(f"[{source_id}] requiere ROBOFLOW_API_KEY en el entorno (no en archivos)")
        link, meta = _roboflow_export(cfg, key)
        archive = archive or downloads / f"{source_id}_v{meta['version']}.zip"
        if not archive.exists():
            download(link, archive, timeout=600)
    else:
        raise ValueError(f"tipo de fuente desconocido: {cfg['kind']}")

    staging = dest.parent / f".staging-{os.getpid()}"
    if staging.exists():
        shutil.rmtree(staging)
    try:
        n = safe_extract(archive, staging)
        labels = validate_labels(cfg, staging)
        if labels["problems"]:
            raise PreparationError(f"[{source_id}] etiquetas no válidas ({len(labels['problems'])}): "
                                   + "; ".join(labels["problems"][:5]))
        st_new = verify_tree(staging, lock)
        if lock is not None and not st_new.ok:
            raise PreparationError(f"[{source_id}] la extracción no coincide con el bloqueo ({st_new.status}: "
                                   f"faltan {len(st_new.missing)}, cambiados {len(st_new.changed)}, "
                                   f"sobrantes {len(st_new.extra)})")
        dest.parent.mkdir(parents=True, exist_ok=True)
        staging.replace(dest)                       # solo ahora aparece el destino definitivo
    except BaseException:
        shutil.rmtree(staging, ignore_errors=True)
        raise
    write_manifest(dest.parent, dataset_id=source_id, license=cfg["license"], attribution=cfg["attribution"],
                   archive_name=archive.name, archive_bytes=archive.stat().st_size,
                   archive_sha256=sha256_path(archive), n_files_extracted=n,
                   **({"roboflow": meta} if meta else {}), **({"url": cfg["archive"]["url"]}
                                                             if cfg["kind"] == "archive" else {}))
    if not keep_archive:
        archive.unlink()
    log(f"[{source_id}] preparada: {n} archivos, {labels['images']} imágenes, {labels['boxes']} cajas"
        + ("" if lock else " — SIN BLOQUEO: revise y congele con `prepare_data.py lock`"))
    return {"action": "prepared", "status": "complete" if lock else "unlocked", "n_files": n,
            "images": labels["images"], "boxes": labels["boxes"]}
