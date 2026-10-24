"""Pruebas de la auditoría con datos sintéticos generados en el propio test.

No se usa ninguna imagen de terceros ni con restricciones de licencia.
"""

import json
import shutil
import subprocess
import sys
from pathlib import Path

from PIL import Image

from berryvision.audit import audit_directory, write_reports

VISION_ROOT = Path(__file__).resolve().parents[1]


def _img(path: Path, size=(64, 48), color=(10, 120, 30), mode="RGB"):
    path.parent.mkdir(parents=True, exist_ok=True)
    Image.new(mode, size, color).save(path)


def _snapshot(root: Path) -> dict:
    return {p.relative_to(root).as_posix(): p.read_bytes() for p in root.rglob("*") if p.is_file()}


def test_yolo_dataset_counts_classes_mismatches_and_duplicates(tmp_path):
    ds = tmp_path / "yolo_ds"
    _img(ds / "train/images/a.jpg")
    _img(ds / "train/images/b.jpg", color=(90, 60, 30))
    shutil.copy(ds / "train/images/a.jpg", ds / "train/images/a_copy.jpg")  # duplicado exacto
    _img(ds / "train/images/c.png", color=(200, 10, 10))  # sin etiqueta
    (ds / "train/labels").mkdir(parents=True)
    (ds / "train/labels/a.txt").write_text("0 0.5 0.5 0.2 0.2\n1 0.3 0.3 0.1 0.1\n")
    (ds / "train/labels/b.txt").write_text("0 0.4 0.4 0.2 0.2\n")
    (ds / "train/labels/huerfana.txt").write_text("1 0.5 0.5 0.1 0.1\n")  # sin imagen
    (ds / "train/labels/a_copy.txt").write_text("")  # imagen sin objetos: válido en YOLO
    (ds / "data.yaml").write_text("names: ['Alternaria', 'Sana']\n")
    (ds / "README.txt").write_text("Texto libre que no es una etiqueta\n")

    rep = audit_directory(ds)

    assert rep["n_images"] == 4
    assert rep["n_readable_images"] == 4
    assert rep["n_duplicate_files"] == 1
    yolo = next(a for a in rep["annotations"] if a["format"] == "yolo")
    assert yolo["class_counts"] == {"Alternaria": 2, "Sana": 2}
    assert yolo["images_without_annotation"] == 1  # c.png
    assert yolo["annotations_without_image"] == 1  # huerfana.txt
    assert rep["extensions"] == {".jpg": 3, ".png": 1}


def test_corrupt_image_is_reported_without_stopping(tmp_path):
    ds = tmp_path / "ds"
    _img(ds / "ok.jpg")
    (ds / "roto.jpg").write_bytes(b"\xff\xd8\xff esto no es un jpeg completo")
    rep = audit_directory(ds)
    assert rep["n_images"] == 2
    assert rep["n_readable_images"] == 1
    assert rep["unreadable"][0]["path"] == "roto.jpg"


def test_coco_with_dangling_annotation(tmp_path):
    ds = tmp_path / "coco"
    _img(ds / "images/x.jpg")
    _img(ds / "images/y.jpg", mode="L", color=128)
    coco = {
        "images": [{"id": 1, "file_name": "x.jpg"}, {"id": 2, "file_name": "y.jpg"}],
        "categories": [{"id": 7, "name": "gray_mold"}],
        "annotations": [
            {"id": 1, "image_id": 1, "category_id": 7},
            {"id": 2, "image_id": 99, "category_id": 7},
        ],
    }
    (ds / "annotations.json").write_text(json.dumps(coco))
    rep = audit_directory(ds)
    ann = next(a for a in rep["annotations"] if a["format"] == "coco")
    assert ann["class_counts"] == {"gray_mold": 2}
    assert ann["n_warnings"] == 1
    assert rep["modes"] == {"RGB": 1, "L": 1}


def test_supervisely_labelme_voc_and_csv(tmp_path):
    ds = tmp_path / "mix"
    _img(ds / "sly/img/s1.jpg")
    (ds / "sly/ann").mkdir(parents=True)
    (ds / "sly/ann/s1.jpg.json").write_text(json.dumps(
        {"size": {"width": 64, "height": 48}, "objects": [{"classTitle": "gray_mold"}, {"classTitle": "leaf_spot"}]}))
    _img(ds / "lm/l1.jpg")
    (ds / "lm/l1.json").write_text(json.dumps({"imagePath": "l1.jpg", "shapes": [{"label": "thrips"}]}))
    _img(ds / "voc/v1.jpg")
    (ds / "voc/v1.xml").write_text(
        "<annotation><filename>v1.jpg</filename><object><name>Blueberry leaf</name></object></annotation>")
    _img(ds / "csv/p1.jpg")
    (ds / "csv/train_labels.csv").write_text(
        "filename,width,height,class,xmin,ymin,xmax,ymax\np1.jpg,64,48,Blueberry leaf,1,1,10,10\n")

    rep = audit_directory(ds)
    by_fmt = {a["format"]: a for a in rep["annotations"]}
    assert by_fmt["supervisely"]["class_counts"] == {"gray_mold": 1, "leaf_spot": 1}
    assert by_fmt["labelme"]["class_counts"] == {"thrips": 1}
    assert by_fmt["pascal_voc"]["class_counts"] == {"Blueberry leaf": 1}
    assert by_fmt["csv_boxes"]["class_counts"] == {"Blueberry leaf": 1}
    assert by_fmt["supervisely"]["annotations_without_image"] == 0


def test_audit_is_read_only_and_reports_are_written(tmp_path):
    ds = tmp_path / "ds"
    _img(ds / "a.jpg")
    (ds / "labels").mkdir()
    (ds / "labels/a.txt").write_text("0 0.5 0.5 0.1 0.1\n")
    before = _snapshot(ds)
    rep = audit_directory(ds)
    json_path, csv_path = write_reports(rep, tmp_path / "out", "ds")
    assert _snapshot(ds) == before
    assert json.loads(json_path.read_text(encoding="utf-8"))["n_images"] == 1
    assert csv_path.read_text(encoding="utf-8").startswith("rel_path,")


def test_cli_refuses_to_write_inside_dataset(tmp_path):
    ds = tmp_path / "ds"
    _img(ds / "a.jpg")
    cmd = [sys.executable, str(VISION_ROOT / "scripts/audit_local_datasets.py"), "--root", str(ds), "--out", str(ds / "reports")]
    res = subprocess.run(cmd, capture_output=True, text=True, encoding="utf-8")
    assert res.returncode == 1
    assert not (ds / "reports").exists()

    ok = subprocess.run(cmd[:-1] + [str(tmp_path / "out")], capture_output=True, text=True, encoding="utf-8")
    assert ok.returncode == 0, ok.stderr
    assert (tmp_path / "out/ds.json").exists()
