"""Auditoría de solo lectura de datasets de imágenes descargados localmente.

El módulo nunca modifica los archivos que inspecciona. Detecta imágenes,
formatos de anotación conocidos (YOLO, COCO, LabelMe, Supervisely, Pascal VOC
y CSV de cajas) y genera un resumen que distingue lo verificado de lo que no
se pudo comprobar. Además:

- casi-duplicados por hash perceptual (dHash de 64 bits) y fugas entre splits;
- conteo de imágenes por clase y tamaño relativo de las cajas (¿lesión u hoja/imagen completa?);
- indicios (heurísticos) de imágenes sintéticas o variantes aumentadas;
- muestras visuales con las cajas dibujadas, solo para inspección local.
"""

from __future__ import annotations

import csv
import hashlib
import json
import re
import statistics
import xml.etree.ElementTree as ET
from collections import Counter, defaultdict
from dataclasses import asdict, dataclass, field
from pathlib import Path
from typing import Iterable

try:
    from PIL import Image, ImageDraw
except ImportError:  # pragma: no cover - Pillow es dependencia declarada
    Image = ImageDraw = None

try:
    import yaml
except ImportError:  # pragma: no cover - PyYAML es opcional
    yaml = None

IMAGE_EXTS = {".jpg", ".jpeg", ".png", ".bmp", ".tif", ".tiff", ".webp"}
YOLO_NAME_FILES = ("data.yaml", "dataset.yaml", "data.yml")
MAX_JSON_BYTES = 512 * 1024 * 1024
SPLIT_ALIASES = {"train": "train", "training": "train", "valid": "val", "val": "val",
                 "validation": "val", "test": "test", "testing": "test"}
SYNTHETIC_HINT = re.compile(r"synth|dall[-_ ]?e|generated|diffusion|stable[-_]?diff|\bgan\b", re.I)
NEAR_DUP_MAX_IMAGES = 8000
LARGE_BOX_FRACTION = 0.5  # una caja que ocupa ≥50 % de la imagen probablemente no delimita una lesión


@dataclass
class ImageRecord:
    rel_path: str
    ext: str
    size_bytes: int
    width: int | None = None
    height: int | None = None
    mode: str | None = None
    sha256: str | None = None
    dhash: str | None = None
    split: str | None = None
    synthetic_hint: bool = False
    error: str | None = None


@dataclass
class AnnotationSummary:
    format: str
    files: list[str] = field(default_factory=list)
    class_counts: Counter = field(default_factory=Counter)
    image_refs: set[str] = field(default_factory=set)
    class_image_refs: dict[str, set] = field(default_factory=lambda: defaultdict(set))
    # ref -> [(clase, x1, y1, x2, y2)] en coordenadas normalizadas [0,1]
    boxes: dict[str, list] = field(default_factory=lambda: defaultdict(list))
    warnings: list[str] = field(default_factory=list)

    def add(self, ref: str, cls: str, box_norm: tuple[float, float, float, float] | None = None) -> None:
        self.class_counts[cls] += 1
        self.class_image_refs[cls].add(ref)
        if box_norm is not None:
            self.boxes[ref].append((cls, *box_norm))

    def box_stats(self) -> dict:
        areas: dict[str, list[float]] = defaultdict(list)
        for items in self.boxes.values():
            for cls, x1, y1, x2, y2 in items:
                areas[cls].append(max(0.0, x2 - x1) * max(0.0, y2 - y1))
        out = {}
        for cls, vals in sorted(areas.items()):
            vals.sort()
            q = lambda p: vals[min(len(vals) - 1, int(p * len(vals)))]  # noqa: E731
            out[cls] = {
                "n_boxes": len(vals),
                "rel_area_median": round(statistics.median(vals), 4),
                "rel_area_p10": round(q(0.10), 4),
                "rel_area_p90": round(q(0.90), 4),
                "frac_boxes_ge_50pct_image": round(sum(v >= LARGE_BOX_FRACTION for v in vals) / len(vals), 3),
            }
        return out

    def to_dict(self) -> dict:
        return {
            "format": self.format,
            "n_files": len(self.files),
            "class_counts": dict(sorted(self.class_counts.items())),
            "class_image_counts": {k: len(v) for k, v in sorted(self.class_image_refs.items())},
            "n_instances": sum(self.class_counts.values()),
            "n_image_refs": len(self.image_refs),
            "box_stats": self.box_stats(),
            "warnings": self.warnings[:50],
            "n_warnings": len(self.warnings),
        }


def _stem_key(name: str) -> str:
    """Clave para emparejar imagen y anotación: nombre base sin extensiones de imagen."""
    base = Path(name.replace("\\", "/")).name
    stem = Path(base).stem
    # Supervisely guarda "foto.jpg.json"; tras quitar .json queda "foto.jpg".
    if Path(stem).suffix.lower() in IMAGE_EXTS:
        stem = Path(stem).stem
    return stem.lower()


def _split_of(rel_path: str) -> str | None:
    for part in Path(rel_path).parts[:-1]:
        if part.lower() in SPLIT_ALIASES:
            return SPLIT_ALIASES[part.lower()]
    return None


def _bbox_norm(xs: list[float], ys: list[float], w: float, h: float) -> tuple[float, float, float, float] | None:
    if not xs or not ys or not w or not h:
        return None
    return (min(xs) / w, min(ys) / h, max(xs) / w, max(ys) / h)


def sha256_file(path: Path, chunk: int = 1 << 20) -> str:
    h = hashlib.sha256()
    with open(path, "rb") as fh:
        for block in iter(lambda: fh.read(chunk), b""):
            h.update(block)
    return h.hexdigest()


def dhash(im, size: int = 8) -> str:
    """Hash de diferencias de 64 bits: robusto a reescalado y recompresión leves."""
    g = im.convert("L").resize((size + 1, size), Image.BILINEAR)
    px = g.tobytes()  # modo L: un byte por píxel
    bits = 0
    for row in range(size):
        for col in range(size):
            left = px[row * (size + 1) + col]
            right = px[row * (size + 1) + col + 1]
            bits = (bits << 1) | (left > right)
    return f"{bits:016x}"


def hamming(a: str, b: str) -> int:
    return (int(a, 16) ^ int(b, 16)).bit_count()


def inspect_image(path: Path, root: Path, compute_hash: bool = True) -> ImageRecord:
    rel = path.relative_to(root).as_posix()
    rec = ImageRecord(rel_path=rel, ext=path.suffix.lower(), size_bytes=path.stat().st_size,
                      split=_split_of(rel), synthetic_hint=bool(SYNTHETIC_HINT.search(rel)))
    try:
        if compute_hash:
            rec.sha256 = sha256_file(path)
        if Image is None:
            rec.error = "Pillow no disponible"
            return rec
        with Image.open(path) as im:
            rec.width, rec.height = im.size
            rec.mode = im.mode
            im.load()  # fuerza la decodificación completa para detectar archivos truncados
            if compute_hash:
                rec.dhash = dhash(im)
    except Exception as exc:  # se registra y la auditoría continúa
        rec.error = f"{type(exc).__name__}: {exc}"
    return rec


# ---------------------------------------------------------------- adaptadores


def _load_yolo_names(root: Path) -> dict[int, str]:
    for candidate in root.rglob("*"):
        if candidate.name in YOLO_NAME_FILES and yaml is not None:
            try:
                data = yaml.safe_load(candidate.read_text(encoding="utf-8")) or {}
            except Exception:
                continue
            names = data.get("names")
            if isinstance(names, list):
                return dict(enumerate(map(str, names)))
            if isinstance(names, dict):
                return {int(k): str(v) for k, v in names.items()}
        if candidate.name == "classes.txt":
            lines = [l.strip() for l in candidate.read_text(encoding="utf-8").splitlines()]
            return {i: n for i, n in enumerate(l for l in lines if l)}
    return {}


def parse_yolo(txt_files: Iterable[Path], root: Path) -> AnnotationSummary | None:
    summary = AnnotationSummary(format="yolo")
    names = _load_yolo_names(root)
    for path in txt_files:
        if path.name == "classes.txt":
            continue
        try:
            lines = path.read_text(encoding="utf-8").splitlines()
        except Exception as exc:
            summary.warnings.append(f"{path.name}: ilegible ({exc})")
            continue
        rows = [l.split() for l in lines if l.strip()]
        # Un .txt vacío es válido en YOLO (imagen sin objetos), pero solo cuenta
        # como YOLO si vive en una carpeta de etiquetas.
        if not rows and "labels" not in path.parts:
            continue
        parsed = []
        ok = True
        for parts in rows:
            try:
                cls = int(parts[0])
                coords = [float(v) for v in parts[1:]]
            except (ValueError, IndexError):
                ok = False
                break
            if len(coords) < 4 or (len(coords) > 4 and len(coords) % 2):
                ok = False
                break
            parsed.append((cls, coords))
        if not ok:
            continue
        ref = _stem_key(path.name)
        for cls, coords in parsed:
            if any(c < 0 or c > 1 for c in coords):
                summary.warnings.append(f"{path.name}: coordenadas fuera de [0,1]")
            if len(coords) == 4:
                cx, cy, w, h = coords
                box = (cx - w / 2, cy - h / 2, cx + w / 2, cy + h / 2)
            else:  # polígono YOLO-seg: x1 y1 x2 y2 ...
                box = _bbox_norm(coords[0::2], coords[1::2], 1.0, 1.0)
            summary.add(ref, names.get(cls, f"id_{cls}"), box)
        summary.files.append(path.relative_to(root).as_posix())
        summary.image_refs.add(ref)
    if not summary.files:
        return None
    if not names:
        summary.warnings.append("No se encontró data.yaml/classes.txt: clases reportadas como id_N")
    return summary


def _classify_json(data) -> str | None:
    if isinstance(data, dict):
        if {"images", "annotations", "categories"} <= data.keys():
            return "coco"
        if "shapes" in data and "imagePath" in data:
            return "labelme"
        if "objects" in data and "size" in data:
            return "supervisely"
    return None


def parse_json_annotations(json_files: Iterable[Path], root: Path) -> list[AnnotationSummary]:
    found: dict[str, AnnotationSummary] = {}
    for path in json_files:
        if path.stat().st_size > MAX_JSON_BYTES:
            continue
        try:
            data = json.loads(path.read_text(encoding="utf-8"))
        except Exception:
            continue
        kind = _classify_json(data)
        if kind is None:
            continue
        s = found.setdefault(kind, AnnotationSummary(format=kind))
        s.files.append(path.relative_to(root).as_posix())
        if kind == "coco":
            cats = {c["id"]: c.get("name", str(c["id"])) for c in data["categories"]}
            images = {img["id"]: img for img in data["images"]}
            for img in data["images"]:
                s.image_refs.add(_stem_key(img.get("file_name", "")))
            missing = 0
            for ann in data["annotations"]:
                img = images.get(ann.get("image_id"))
                if img is None:
                    missing += 1
                    s.class_counts[cats.get(ann.get("category_id"), f"id_{ann.get('category_id')}")] += 1
                    continue
                box = None
                if ann.get("bbox") and img.get("width") and img.get("height"):
                    x, y, w, h = ann["bbox"]
                    box = (x / img["width"], y / img["height"], (x + w) / img["width"], (y + h) / img["height"])
                s.add(_stem_key(img.get("file_name", "")),
                      cats.get(ann.get("category_id"), f"id_{ann.get('category_id')}"), box)
            if missing:
                s.warnings.append(f"{path.name}: {missing} anotaciones apuntan a image_id inexistente")
        elif kind == "labelme":
            ref = _stem_key(data.get("imagePath") or path.name)
            s.image_refs.add(ref)
            w, h = data.get("imageWidth"), data.get("imageHeight")
            for shape in data["shapes"]:
                pts = shape.get("points") or []
                box = _bbox_norm([p[0] for p in pts], [p[1] for p in pts], w, h) if w and h else None
                s.add(ref, str(shape.get("label")), box)
        elif kind == "supervisely":
            ref = _stem_key(path.name[: -len(".json")])
            s.image_refs.add(ref)
            w, h = data["size"].get("width"), data["size"].get("height")
            for obj in data["objects"]:
                pts = (obj.get("points") or {}).get("exterior") or []
                box = _bbox_norm([p[0] for p in pts], [p[1] for p in pts], w, h) if pts else None
                s.add(ref, str(obj.get("classTitle")), box)
    return list(found.values())


def parse_voc(xml_files: Iterable[Path], root: Path) -> AnnotationSummary | None:
    s = AnnotationSummary(format="pascal_voc")
    for path in xml_files:
        try:
            tree = ET.parse(path)
        except ET.ParseError:
            continue
        node = tree.getroot()
        if node.tag != "annotation":
            continue
        s.files.append(path.relative_to(root).as_posix())
        ref = _stem_key(node.findtext("filename") or path.name)
        s.image_refs.add(ref)
        w = float(node.findtext("size/width") or 0)
        h = float(node.findtext("size/height") or 0)
        for obj in node.iter("object"):
            bb = obj.find("bndbox")
            box = None
            if bb is not None and w and h:
                vals = [float(bb.findtext(k) or 0) for k in ("xmin", "ymin", "xmax", "ymax")]
                box = (vals[0] / w, vals[1] / h, vals[2] / w, vals[3] / h)
            s.add(ref, (obj.findtext("name") or "").strip(), box)
    return s if s.files else None


def parse_csv_boxes(csv_files: Iterable[Path], root: Path) -> AnnotationSummary | None:
    """CSV con una caja por fila (p. ej. PlantDoc: filename,width,height,class,xmin,...)."""
    s = AnnotationSummary(format="csv_boxes")
    for path in csv_files:
        try:
            with open(path, newline="", encoding="utf-8") as fh:
                reader = csv.DictReader(fh)
                header = [h.strip().lstrip("#").lower() for h in (reader.fieldnames or [])]
                label_col = next((h for h in ("class", "label") if h in header), None)
                if label_col is None:
                    continue
                file_col = next((h for h in ("local_filename", "filename", "file_name", "image") if h in header), None)
                raw = {h.strip().lstrip("#").lower(): h for h in reader.fieldnames or []}
                rows = list(reader)
        except Exception:
            continue
        s.files.append(path.relative_to(root).as_posix())
        has_xyxy = all(k in raw for k in ("xmin", "ymin", "xmax", "ymax", "width", "height"))
        for row in rows:
            # Formato "un CSV por imagen" (p. ej. Plant_Village_Blueberry) si no hay columna de archivo.
            ref = _stem_key(row.get(raw[file_col]) or "") if file_col else _stem_key(path.name)
            box = None
            if has_xyxy:
                try:
                    w, h = float(row[raw["width"]]), float(row[raw["height"]])
                    box = _bbox_norm([float(row[raw["xmin"]]), float(row[raw["xmax"]])],
                                     [float(row[raw["ymin"]]), float(row[raw["ymax"]])], w, h)
                except (TypeError, ValueError):
                    s.warnings.append(f"{path.name}: caja no numérica")
            s.add(ref, (row.get(raw[label_col]) or "").strip(), box)
            s.image_refs.add(ref)
    return s if s.files else None


# ---------------------------------------------------------------- duplicados


def near_duplicate_pairs(records: list[ImageRecord], threshold: int = 4) -> list[tuple[str, str, int]]:
    """Pares de imágenes con dHash a distancia de Hamming ≤ threshold (excluye idénticas por SHA)."""
    items = [(r.rel_path, int(r.dhash, 16), r.sha256) for r in records if r.dhash]
    pairs = []
    for i in range(len(items)):
        pi, hi, si = items[i]
        for j in range(i + 1, len(items)):
            pj, hj, sj = items[j]
            d = (hi ^ hj).bit_count()
            if d <= threshold and si != sj:
                pairs.append((pi, pj, d))
    return pairs


def cross_dataset_duplicates(a: list[dict], b: list[dict], threshold: int = 4) -> list[dict]:
    """Imágenes de dos datasets distintos con hash idéntico o casi idéntico (riesgo de fuga)."""
    out = []
    hb = [(r["rel_path"], int(r["dhash"], 16), r.get("sha256")) for r in b if r.get("dhash")]
    for ra in a:
        if not ra.get("dhash"):
            continue
        ha = int(ra["dhash"], 16)
        for pb, hbv, sb in hb:
            d = (ha ^ hbv).bit_count()
            if d <= threshold:
                out.append({"a": ra["rel_path"], "b": pb, "hamming": d, "exact": ra.get("sha256") == sb})
    return out


def _augmentation_variants(records: list[ImageRecord]) -> dict[str, int]:
    """Exports de Roboflow nombran 'base_jpg.rf.<hash>.jpg'; varias variantes de una base = aumentación."""
    bases = Counter()
    for r in records:
        name = Path(r.rel_path).name
        if ".rf." in name:
            bases[name.split(".rf.")[0]] += 1
    return {k: v for k, v in bases.items() if v > 1}


# ---------------------------------------------------------------- auditoría


def audit_directory(root: str | Path, compute_hash: bool = True, max_images: int | None = None,
                    near_dup_threshold: int = 4) -> dict:
    root = Path(root).resolve()
    if not root.is_dir():
        raise NotADirectoryError(root)

    images: list[ImageRecord] = []
    by_ext: dict[str, list[Path]] = defaultdict(list)
    errors: list[str] = []

    for path in sorted(root.rglob("*")):
        if not path.is_file():
            continue
        ext = path.suffix.lower()
        if ext in IMAGE_EXTS:
            if max_images is None or len(images) < max_images:
                images.append(inspect_image(path, root, compute_hash))
        else:
            by_ext[ext].append(path)

    annotations: list[AnnotationSummary] = []
    for parser, ext in ((parse_yolo, ".txt"), (parse_voc, ".xml"), (parse_csv_boxes, ".csv")):
        try:
            result = parser(by_ext.get(ext, []), root)
        except Exception as exc:
            errors.append(f"{parser.__name__}: {type(exc).__name__}: {exc}")
            continue
        if result:
            annotations.append(result)
    try:
        annotations.extend(parse_json_annotations(by_ext.get(".json", []), root))
    except Exception as exc:
        errors.append(f"parse_json_annotations: {exc}")

    readable = [r for r in images if r.error is None]
    image_keys = {_stem_key(r.rel_path) for r in images}
    split_of_key = {_stem_key(r.rel_path): r.split for r in images}

    dup_groups: dict[str, list[str]] = defaultdict(list)
    for r in images:
        if r.sha256:
            dup_groups[r.sha256].append(r.rel_path)
    duplicates = [paths for paths in dup_groups.values() if len(paths) > 1]

    near_pairs: list[tuple[str, str, int]] = []
    near_note = None
    if compute_hash:
        if len(readable) <= NEAR_DUP_MAX_IMAGES:
            near_pairs = near_duplicate_pairs(readable, near_dup_threshold)
        else:
            near_note = f"Casi-duplicados omitidos: más de {NEAR_DUP_MAX_IMAGES} imágenes"

    split_by_path = {r.rel_path: r.split for r in images}
    cross_split_exact = [g for g in duplicates if len({split_by_path[p] for p in g} - {None}) > 1]
    cross_split_near = [p for p in near_pairs
                        if split_by_path[p[0]] and split_by_path[p[1]] and split_by_path[p[0]] != split_by_path[p[1]]]

    folder_counts = Counter(Path(r.rel_path).parent.as_posix() for r in images)

    ann_dicts = []
    for a in annotations:
        d = a.to_dict()
        refs = {ref for ref in a.image_refs if ref}
        d["images_without_annotation"] = len(image_keys - refs)
        d["annotations_without_image"] = len(refs - image_keys)
        per_split = defaultdict(Counter)
        for cls, crefs in a.class_image_refs.items():
            for ref in crefs:
                per_split[split_of_key.get(ref) or "sin_split"][cls] += 1
        d["class_image_counts_by_split"] = {k: dict(sorted(v.items())) for k, v in sorted(per_split.items())}
        ann_dicts.append(d)

    sizes = Counter((r.width, r.height) for r in readable)
    aug = _augmentation_variants(images)

    return {
        "root": str(root),
        "read_only": True,
        "n_images": len(images),
        "n_readable_images": len(readable),
        "truncated_by_max_images": max_images is not None and len(images) >= max_images,
        "extensions": dict(Counter(r.ext for r in images)),
        "modes": dict(Counter(r.mode for r in readable)),
        "n_distinct_resolutions": len(sizes),
        "resolutions_top": [[f"{w}x{h}", n] for (w, h), n in sizes.most_common(10)],
        "aspect_ratios_top": Counter(round(r.width / r.height, 2) for r in readable if r.height).most_common(5),
        "images_per_split": dict(Counter(r.split or "sin_split" for r in images)),
        "images_per_folder": dict(sorted(folder_counts.items())),
        "unreadable": [{"path": r.rel_path, "error": r.error} for r in images if r.error],
        "hashing": compute_hash,
        "duplicate_groups": duplicates,
        "n_duplicate_files": sum(len(g) - 1 for g in duplicates),
        "near_duplicate_threshold": near_dup_threshold,
        "near_duplicate_pairs": [list(p) for p in near_pairs[:500]],
        "n_near_duplicate_pairs": len(near_pairs),
        "near_duplicate_note": near_note,
        "cross_split_exact_duplicates": cross_split_exact,
        "cross_split_near_duplicates": [list(p) for p in cross_split_near[:200]],
        "n_cross_split_near_duplicates": len(cross_split_near),
        "synthetic_name_hints": [r.rel_path for r in images if r.synthetic_hint][:200],
        "roboflow_augmentation_bases": len(aug),
        "roboflow_augmentation_max_variants": max(aug.values()) if aug else 0,
        "annotations": ann_dicts,
        "annotation_formats_detected": [a.format for a in annotations],
        "non_image_extensions": {k or "<sin extensión>": len(v) for k, v in sorted(by_ext.items())},
        "errors": errors,
        "notes": [
            "Duplicados exactos por SHA-256; casi-duplicados por dHash de 64 bits (Hamming <= umbral).",
            "Los indicios de imágenes sintéticas se basan solo en nombres de archivo; la ausencia no prueba nada.",
            "box_stats: área relativa de las cajas; una mediana alta sugiere que se etiquetó la hoja o la imagen, no la lesión.",
            "images_per_folder no implica que la carpeta sea una etiqueta.",
            "Un formato no detectado no implica ausencia de anotaciones.",
        ],
        "_records": [asdict(r) for r in images],
        "_boxes": {a.format: dict(a.boxes) for a in annotations},
    }


def draw_samples(report: dict, out_dir: str | Path, n: int = 12, max_side: int = 768) -> list[Path]:
    """Dibuja las cajas sobre n imágenes anotadas, solo para revisión local (no republicar)."""
    root = Path(report["root"])
    out_dir = Path(out_dir)
    out_dir.mkdir(parents=True, exist_ok=True)
    path_by_key = {_stem_key(r["rel_path"]): root / r["rel_path"] for r in report["_records"] if not r["error"]}
    saved: list[Path] = []
    for fmt, boxes in report.get("_boxes", {}).items():
        refs = sorted(k for k in boxes if k in path_by_key)
        step = max(1, len(refs) // n) if refs else 1
        for ref in refs[::step][:n]:
            with Image.open(path_by_key[ref]) as im:
                im = im.convert("RGB")
                draw = ImageDraw.Draw(im)
                w, h = im.size
                for cls, x1, y1, x2, y2 in boxes[ref]:
                    draw.rectangle([x1 * w, y1 * h, x2 * w, y2 * h], outline=(255, 0, 80), width=max(2, w // 300))
                    draw.text((x1 * w + 4, y1 * h + 4), cls, fill=(255, 255, 0))
                im.thumbnail((max_side, max_side))
                dest = out_dir / f"{fmt}__{ref}.jpg"
                im.save(dest, quality=85)
                saved.append(dest)
    return saved


def write_reports(report: dict, out_dir: str | Path, name: str) -> tuple[Path, Path]:
    out_dir = Path(out_dir)
    out_dir.mkdir(parents=True, exist_ok=True)
    records = report.pop("_records", [])
    boxes = report.pop("_boxes", {})
    json_path = out_dir / f"{name}.json"
    csv_path = out_dir / f"{name}_images.csv"
    json_path.write_text(json.dumps(report, indent=2, ensure_ascii=False), encoding="utf-8")
    fields = list(ImageRecord.__dataclass_fields__)
    with open(csv_path, "w", newline="", encoding="utf-8") as fh:
        writer = csv.DictWriter(fh, fieldnames=fields)
        writer.writeheader()
        writer.writerows(records)
    report["_records"] = records
    report["_boxes"] = boxes
    return json_path, csv_path
