"""Manifiesto unificado (no destructivo) de las fuentes locales.

Una fila por imagen con su procedencia, etiquetas original y canónica, tipo de
anotación, grupo anti-fuga, partición, licencia y motivo de exclusión. Las
imágenes originales no se tocan: el manifiesto solo apunta a ellas.

Las etiquetas canónicas siguen knowledge/datasets/taxonomy.yaml: nunca se
fusionan cultivos, órganos ni niveles de anotación distintos.
"""

from __future__ import annotations

import csv
import hashlib
import json
import re
from dataclasses import asdict, dataclass, field
from pathlib import Path

from .audit import IMAGE_EXTS, dhash, sha256_file

try:
    from PIL import Image
except ImportError:  # pragma: no cover
    Image = None

MANIFEST_VERSION = "1.0.0"

STRAWBERRY_CANONICAL = {
    "Angular Leafspot": "strawberry_leaf_angular_leafspot",
    "Anthracnose Fruit Rot": "strawberry_fruit_anthracnose_rot",
    "Asymptomatic Strawberry": "strawberry_asymptomatic",
    "Healthy Strawberry": "strawberry_asymptomatic",  # misma clase con otro nombre en la variante hybrid
    "Blossom Blight": "strawberry_flower_blossom_blight",
    "Gray Mold": "strawberry_gray_mold",               # NO equivale a Botrytis en arándano
    "Leaf Spot": "strawberry_leaf_spot",
    "Powderly Mildew Fruit": "strawberry_fruit_powdery_mildew",  # errata 'Powderly' del origen
    "Powdery Mildew Fruit": "strawberry_fruit_powdery_mildew",
    "Powderly Mildew Leaf": "strawberry_leaf_powdery_mildew",
    "Powdery Mildew Leaf": "strawberry_leaf_powdery_mildew",
}
STRAWBERRY_ORGAN = {
    "strawberry_leaf_angular_leafspot": "hoja", "strawberry_leaf_spot": "hoja",
    "strawberry_leaf_powdery_mildew": "hoja", "strawberry_fruit_anthracnose_rot": "fruto",
    "strawberry_fruit_powdery_mildew": "fruto", "strawberry_gray_mold": "fruto/flor",
    "strawberry_flower_blossom_blight": "flor", "strawberry_asymptomatic": "fruto/hoja/planta",
}
ROBOFLOW_SUFFIX = re.compile(r"_(?:jpe?g|png)\.rf\.[0-9a-f]+\.(?:jpe?g|png)$", re.I)
AUG_PREFIX = re.compile(r"^aug_\d+_", re.I)


@dataclass
class ManifestRow:
    image_id: str
    source_id: str
    source_version: str
    rel_path: str                 # relativo a vision/
    sha256: str | None
    dhash: str | None
    width: int | None
    height: int | None
    crop: str
    organ: str
    original_label: str
    canonical_label: str
    task: str                     # image_classification | leaf_detection | metadata_only
    annotation_type: str          # image_label | boxes_leaf | polygons_lesion_or_organ | none
    n_instances: int
    annotations: str              # JSON compacto (cajas normalizadas) o referencia al archivo COCO
    original_split: str | None
    base_id: str                  # identificador de la imagen base (agrupa aumentaciones)
    group_id: str = ""
    split: str = ""
    is_augmented: bool = False
    is_synthetic: bool = False
    review_status: str = "auto"   # auto | needs_manual_review | confirmed
    license: str = ""
    usable_for: str = ""          # experimento o uso permitido
    exclusion_reason: str = ""
    notes: str = field(default="")


def roboflow_base_id(file_name: str) -> str:
    """'aug_127_anthracnose_fruit_rot43_jpg.rf.<hash>.jpg' -> 'anthracnose_fruit_rot43'."""
    name = Path(file_name).name
    name = AUG_PREFIX.sub("", name)
    name = ROBOFLOW_SUFFIX.sub("", name)
    return Path(name).stem.lower() if "." in name else name.lower()


def _variant_key(file_name: str) -> str:
    return roboflow_base_id(file_name) + ("#aug" if Path(file_name).name.startswith("aug_") else "")


def _image_info(path: Path) -> tuple[str | None, str | None, int | None, int | None]:
    try:
        sha = sha256_file(path)
        with Image.open(path) as im:
            w, h = im.size
            im.load()
            return sha, dhash(im), w, h
    except Exception:
        return None, None, None, None


def _image_id(source_id: str, rel: str) -> str:
    return f"{source_id}:" + hashlib.sha1(rel.encode("utf-8")).hexdigest()[:12]


def rows_plantvillage(vision_root: Path) -> list[ManifestRow]:
    root = vision_root / "data/external/plantvillage_blueberry_healthy"
    acq = json.loads((root / "ACQUISITION.json").read_text(encoding="utf-8"))
    rows = []
    for p in sorted((root / "images").glob("*")):
        if p.suffix.lower() not in IMAGE_EXTS:
            continue
        rel = p.relative_to(vision_root).as_posix()
        sha, dh, w, h = _image_info(p)
        rows.append(ManifestRow(
            image_id=_image_id("plantvillage_blueberry_healthy", rel), source_id="plantvillage_blueberry_healthy",
            source_version=f"spMohanty@{acq['commit'][:10]}", rel_path=rel, sha256=sha, dhash=dh, width=w, height=h,
            crop="arándano", organ="hoja desprendida", original_label="Blueberry___healthy",
            canonical_label="blueberry_leaf_healthy_lab", task="image_classification",
            annotation_type="image_label", n_instances=1, annotations="", original_split=None,
            base_id=p.stem.lower(), license=acq["license"], usable_for="control_de_dominio",
            notes="laboratorio, fondo uniforme"))
    return rows


def rows_plantdoc(vision_root: Path) -> list[ManifestRow]:
    root = vision_root / "data/external/plantdoc_blueberry"
    acq = json.loads((root / "ACQUISITION.json").read_text(encoding="utf-8"))
    boxes: dict[str, list] = {}
    for split in ("train", "test"):
        with open(root / "labels" / f"{split}_blueberry_labels.csv", newline="", encoding="utf-8") as fh:
            for r in csv.DictReader(fh):
                w, h = float(r["width"]), float(r["height"])
                boxes.setdefault(r["local_filename"], []).append(
                    [round(float(r["xmin"]) / w, 4), round(float(r["ymin"]) / h, 4),
                     round(float(r["xmax"]) / w, 4), round(float(r["ymax"]) / h, 4)])
    rows = []
    for p in sorted((root / "images").rglob("*")):
        if p.suffix.lower() not in IMAGE_EXTS:
            continue
        rel = p.relative_to(vision_root).as_posix()
        sha, dh, w, h = _image_info(p)
        b = boxes.get(p.name, [])
        rows.append(ManifestRow(
            image_id=_image_id("plantdoc_blueberry", rel), source_id="plantdoc_blueberry",
            source_version=f"PlantDoc-OD@{acq['commit'][:10]}", rel_path=rel, sha256=sha, dhash=dh, width=w, height=h,
            crop="arándano", organ="hoja (ramas y hojas)", original_label="Blueberry leaf",
            canonical_label="blueberry_leaf_unspecified_condition", task="leaf_detection",
            annotation_type="boxes_leaf", n_instances=len(b), annotations=json.dumps({"boxes_xyxy_norm": b}),
            original_split=p.parent.name, base_id=p.stem.lower(), review_status="needs_manual_review",
            license=acq["license"], usable_for="auxiliar_tras_revision",
            notes="'Blueberry leaf' no implica sana; anotación incompleta"))
    return rows


def rows_strawberry(vision_root: Path) -> list[ManifestRow]:
    root = vision_root / "data/external/strawberry_hybrid"
    acq = json.loads((root / "ACQUISITION.json").read_text(encoding="utf-8"))
    base_dir = next((root / "extracted").glob("Strawberry Disease Detection Dataset*"))
    trad = base_dir / "Strawberry-segmentation-traditional-augmentation"
    hyb = base_dir / "Strawberry-segmentation-hybrid-augmentation"
    rows = []
    trad_train_names = set()
    for split in ("train", "valid", "test"):
        coco = json.loads((trad / split / "_annotations.coco.json").read_text(encoding="utf-8"))
        cats = {c["id"]: c["name"] for c in coco["categories"]}
        per_img: dict[int, list] = {}
        for a in coco["annotations"]:
            per_img.setdefault(a["image_id"], []).append(a)
        for img in coco["images"]:
            fname = img["file_name"]
            if split == "train":
                trad_train_names.add(_variant_key(fname))
            p = trad / split / fname
            rel = p.relative_to(vision_root).as_posix()
            anns = per_img.get(img["id"], [])
            labels = sorted({cats[a["category_id"]] for a in anns} - {"fruit"})
            sha, dh, w, h = _image_info(p)
            excl = ""
            if not anns:
                excl = "sin anotaciones"
            elif len(labels) != 1:
                excl = f"imagen multiclase {labels}: ambigua para clasificación de imagen completa"
            label = labels[0] if len(labels) == 1 else "|".join(labels)
            canon = STRAWBERRY_CANONICAL.get(label, "") if len(labels) == 1 else ""
            boxes = [[round(a["bbox"][0] / img["width"], 4), round(a["bbox"][1] / img["height"], 4),
                      round((a["bbox"][0] + a["bbox"][2]) / img["width"], 4),
                      round((a["bbox"][1] + a["bbox"][3]) / img["height"], 4)] for a in anns]
            rows.append(ManifestRow(
                image_id=_image_id("strawberry_traditional", rel), source_id="strawberry_traditional",
                source_version="k2ptxmfjhj v1 / traditional-augmentation", rel_path=rel, sha256=sha, dhash=dh,
                width=w, height=h, crop="fresa", organ=STRAWBERRY_ORGAN.get(canon, "desconocido"),
                original_label=label, canonical_label=canon, task="image_classification",
                annotation_type="polygons_lesion_or_organ", n_instances=len(anns),
                annotations=json.dumps({"coco": f"{split}/_annotations.coco.json", "image_id": img["id"],
                                        "boxes_xyxy_norm": boxes}),
                original_split=split, base_id=roboflow_base_id(fname), is_augmented=fname.startswith("aug_"),
                license=acq["license"], usable_for="E4c_aux_fresa" if not excl else "",
                exclusion_reason=excl, notes="640x640 reescaladas por el autor; bases de Afzaal 2021 y Pérez-Borrero 2020"))
    # Imágenes sintéticas de la variante hybrid: solo metadatos, nunca entrenamiento ni evaluación aquí.
    coco = json.loads((hyb / "train" / "_annotations.coco.json").read_text(encoding="utf-8"))
    cats = {c["id"]: c["name"] for c in coco["categories"]}
    labels_by_img: dict[int, set] = {}
    for a in coco["annotations"]:
        labels_by_img.setdefault(a["image_id"], set()).add(cats[a["category_id"]])
    for img in coco["images"]:
        # Roboflow cambia el hash '.rf.' entre exportaciones: se compara por imagen base.
        if _variant_key(img["file_name"]) in trad_train_names:
            continue
        p = hyb / "train" / img["file_name"]
        rel = p.relative_to(vision_root).as_posix()
        labels = sorted(labels_by_img.get(img["id"], set()) - {"fruit"})
        rows.append(ManifestRow(
            image_id=_image_id("strawberry_hybrid_synthetic", rel), source_id="strawberry_hybrid_synthetic",
            source_version="k2ptxmfjhj v1 / hybrid-augmentation (solo sintéticas)", rel_path=rel, sha256=None,
            dhash=None, width=img.get("width"), height=img.get("height"), crop="fresa (sintética)",
            organ="desconocido", original_label="|".join(labels), canonical_label="", task="metadata_only",
            annotation_type="polygons_lesion_or_organ", n_instances=0, annotations="", original_split="train",
            base_id=roboflow_base_id(img["file_name"]), is_synthetic=True, license=acq["license"],
            exclusion_reason="sintética (DALL·E 3): excluida por política del proyecto",
            notes="base presente en hybrid/train y ausente en traditional/train; nombre contiene '_synthetic_'"
                  if "_synthetic_" in img["file_name"] else "base ausente en traditional/train (revisar)"))
    return rows


def write_manifest_csv(rows: list[ManifestRow], path: Path) -> str:
    path.parent.mkdir(parents=True, exist_ok=True)
    fields = list(ManifestRow.__dataclass_fields__)
    with open(path, "w", newline="", encoding="utf-8") as fh:
        w = csv.DictWriter(fh, fieldnames=fields)
        w.writeheader()
        for r in rows:
            w.writerow(asdict(r))
    return sha256_file(path)


def read_manifest_csv(path: Path) -> list[dict]:
    with open(path, newline="", encoding="utf-8") as fh:
        rows = list(csv.DictReader(fh))
    for r in rows:
        for k in ("is_augmented", "is_synthetic"):
            r[k] = r[k] == "True"
        for k in ("width", "height", "n_instances"):
            r[k] = int(r[k]) if r[k] not in ("", "None") else None
    return rows
