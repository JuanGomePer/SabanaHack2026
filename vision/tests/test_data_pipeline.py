"""Pruebas de adquisición segura, auditoría ampliada y particiones por grupo.

Todo se genera en directorios temporales; no hay red ni datos de terceros.
"""

import io
import json
import shutil
import tarfile
import zipfile

import pytest
from PIL import Image, ImageDraw

from berryvision.acquisition import local_name, safe_extract, write_manifest
from berryvision.audit import audit_directory, cross_dataset_duplicates, draw_samples, write_reports
from berryvision.splits import assign_splits, build_groups, leakage


def _scene(path, seed: int, size=(320, 240)):
    """Imagen sintética con estructura (dHash distinto entre semillas)."""
    path.parent.mkdir(parents=True, exist_ok=True)
    im = Image.new("RGB", size, (20 + seed * 7 % 200, 90, 40))
    d = ImageDraw.Draw(im)
    for k in range(6):
        x = (seed * 37 + k * 53) % size[0]
        y = (seed * 91 + k * 29) % size[1]
        d.ellipse([x, y, x + 40 + k * 5, y + 30], fill=((seed * 13 + k * 40) % 255, 200, (k * 60) % 255))
    im.save(path, quality=95)


# ---------------------------------------------------------------- adquisición

def test_local_name_is_unique_and_windows_safe():
    a = local_name("blueberry-leaf.jpg", 0)
    b = local_name("Blueberry-leaf.jpg", 1)
    assert a.lower() != b.lower()
    assert local_name("IMG_0002_original.JPG?1500100269.jpg", 3) == "00003__IMG_0002_original.JPG_1500100269.jpg"
    assert not set('<>:"/\\|?*') & set(local_name('a<b>c:d"e/f\\g|h?i*j.jpg', 9))


def test_safe_extract_rejects_path_traversal_tar(tmp_path):
    evil = tmp_path / "evil.tar"
    with tarfile.open(evil, "w") as tf:
        data = b"x"
        info = tarfile.TarInfo("../escape.txt")
        info.size = len(data)
        tf.addfile(info, io.BytesIO(data))
    with pytest.raises(ValueError):
        safe_extract(evil, tmp_path / "out")
    assert not (tmp_path / "escape.txt").exists()


def test_safe_extract_rejects_symlink_and_accepts_normal_zip(tmp_path):
    link_tar = tmp_path / "link.tar"
    with tarfile.open(link_tar, "w") as tf:
        info = tarfile.TarInfo("ok/link")
        info.type = tarfile.SYMTYPE
        info.linkname = "/etc/passwd"
        tf.addfile(info)
    with pytest.raises(ValueError):
        safe_extract(link_tar, tmp_path / "o1")
    good = tmp_path / "good.zip"
    with zipfile.ZipFile(good, "w") as zf:
        zf.writestr("ds/img/a.txt", "hola")
    assert safe_extract(good, tmp_path / "o2") == 1
    assert (tmp_path / "o2/ds/img/a.txt").read_text() == "hola"


def test_manifest_refuses_credentials(tmp_path):
    write_manifest(tmp_path, dataset_id="x", license="CC BY 4.0")
    assert json.loads((tmp_path / "ACQUISITION.json").read_text(encoding="utf-8"))["dataset_id"] == "x"
    with pytest.raises(ValueError):
        write_manifest(tmp_path, dataset_id="x", api_key="no-debe-guardarse")


# ---------------------------------------------------------------- auditoría ampliada

def test_cross_split_leak_box_stats_and_polygons(tmp_path):
    ds = tmp_path / "rf_export"
    _scene(ds / "train/images/a.jpg", 1)
    _scene(ds / "train/images/b.jpg", 2)
    (ds / "test/images").mkdir(parents=True)
    shutil.copy(ds / "train/images/a.jpg", ds / "test/images/a_copy.jpg")   # misma imagen en train y test
    (ds / "train/labels").mkdir(parents=True)
    (ds / "test/labels").mkdir(parents=True)
    # caja casi de imagen completa (hoja entera) y una pequeña (lesión)
    (ds / "train/labels/a.txt").write_text("0 0.5 0.5 0.9 0.9\n1 0.2 0.2 0.05 0.05\n")
    # polígono YOLO-seg (6 coordenadas)
    (ds / "train/labels/b.txt").write_text("1 0.1 0.1 0.3 0.1 0.2 0.3\n")
    (ds / "test/labels/a_copy.txt").write_text("0 0.5 0.5 0.9 0.9\n")
    (ds / "data.yaml").write_text("names: ['Alternaria', 'Sana']\n")

    rep = audit_directory(ds)
    assert rep["images_per_split"] == {"train": 2, "test": 1}
    assert len(rep["cross_split_exact_duplicates"]) == 1
    yolo = rep["annotations"][0]
    assert yolo["class_image_counts"] == {"Alternaria": 2, "Sana": 2}
    assert yolo["class_image_counts_by_split"]["test"] == {"Alternaria": 1}
    assert yolo["box_stats"]["Alternaria"]["frac_boxes_ge_50pct_image"] == 1.0
    assert yolo["box_stats"]["Sana"]["rel_area_median"] < 0.05


def test_near_duplicates_detected_after_recompression(tmp_path):
    ds = tmp_path / "nd"
    _scene(ds / "x.jpg", 5)
    with Image.open(ds / "x.jpg") as im:
        im.resize((300, 225)).save(ds / "x_small.jpg", quality=70)   # reescalada y recomprimida
    _scene(ds / "y.jpg", 40)
    rep = audit_directory(ds, near_dup_threshold=4)
    pairs = {tuple(sorted(p[:2])) for p in rep["near_duplicate_pairs"]}
    assert ("x.jpg", "x_small.jpg") in pairs
    assert rep["n_duplicate_files"] == 0


def test_synthetic_hint_and_roboflow_variants(tmp_path):
    ds = tmp_path / "syn"
    _scene(ds / "train/images/dalle3_leaf_01.jpg", 3)
    _scene(ds / "train/images/leaf7_jpg.rf.aaa.jpg", 4)
    _scene(ds / "train/images/leaf7_jpg.rf.bbb.jpg", 6)
    rep = audit_directory(ds)
    assert rep["synthetic_name_hints"] == ["train/images/dalle3_leaf_01.jpg"]
    assert rep["roboflow_augmentation_bases"] == 1 and rep["roboflow_augmentation_max_variants"] == 2


def test_samples_and_cross_dataset(tmp_path):
    a = tmp_path / "a"
    _scene(a / "img1.jpg", 8)
    (a / "labels.csv").write_text("filename,width,height,class,xmin,ymin,xmax,ymax\nimg1.jpg,320,240,Blueberry leaf,10,10,100,90\n")
    b = tmp_path / "b"
    shutil.copytree(a, b)
    ra, rb = audit_directory(a), audit_directory(b)
    saved = draw_samples(ra, tmp_path / "samples", n=3)
    assert len(saved) == 1 and saved[0].exists()
    cross = cross_dataset_duplicates(ra["_records"], rb["_records"])
    assert cross and cross[0]["exact"]
    write_reports(ra, tmp_path / "out", "a")   # no debe fallar con las claves internas
    assert "_boxes" in ra


# ---------------------------------------------------------------- particiones por grupo

def _rec(path, sha, dh):
    return {"rel_path": path, "sha256": sha, "dhash": dh, "error": None}


def test_group_splits_keep_duplicates_together_and_are_deterministic():
    recs = [_rec("a.jpg", "s1", "ffff000000000000"),
            _rec("a_dup.jpg", "s1", "ffff000000000000"),          # duplicado exacto
            _rec("a_near.jpg", "s9", "ffff000000000001"),         # casi-duplicado (1 bit)
            _rec("b.jpg", "s2", "0000ffff00000000"),
            _rec("c.jpg", "s3", "00000000ffff0000")]
    groups = build_groups(recs, near_threshold=2)
    assert groups["a.jpg"] == groups["a_dup.jpg"] == groups["a_near.jpg"]
    assert len(set(groups.values())) == 3
    s1 = assign_splits(groups, seed=7)
    assert s1 == assign_splits(groups, seed=7)
    assert leakage(s1, groups) == []


def test_group_key_joins_same_plant_and_leakage_is_reported():
    recs = [_rec("p1_a.jpg", "s1", "1" * 16), _rec("p1_b.jpg", "s2", "8" * 16)]
    groups = build_groups(recs, near_threshold=0, group_key=lambda r: r["rel_path"].split("_")[0])
    assert len(set(groups.values())) == 1
    assert leakage({"p1_a.jpg": "train", "p1_b.jpg": "test"}, groups)
