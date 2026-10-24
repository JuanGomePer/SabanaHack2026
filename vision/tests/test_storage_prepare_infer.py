"""Almacenamiento configurable, preparación idempotente de fuentes, inferencia sin dataset y contexto Docker."""

import json
import re
import shutil
import subprocess
import sys
import zipfile
from pathlib import Path

import pytest

from berryvision import datasources as ds
from berryvision.acquisition import DownloadError, md5_path, sha256_path
from berryvision.storage import ENV_DATA, ENV_MODEL, StorageError, data_dir, model_dir

VISION_ROOT = Path(__file__).resolve().parents[1]


# ── almacenamiento ───────────────────────────────────────────────────────────

def test_storage_paths_from_env_and_clear_error(tmp_path, monkeypatch):
    monkeypatch.delenv(ENV_DATA, raising=False)
    assert data_dir() == VISION_ROOT / "data"
    monkeypatch.setenv(ENV_DATA, str(tmp_path))
    monkeypatch.setenv(ENV_MODEL, str(tmp_path / "m"))
    assert data_dir(must_exist=True) == tmp_path
    with pytest.raises(StorageError, match=ENV_MODEL):
        model_dir(must_exist=True)               # no se crea en silencio un directorio vacío


# ── fuentes de prueba ────────────────────────────────────────────────────────

def _yolo_zip(path: Path, bad_label: str | None = None) -> Path:
    from PIL import Image
    src = path.parent / "zsrc"
    for split in ("train", "valid"):
        (src / split / "images").mkdir(parents=True)
        (src / split / "labels").mkdir(parents=True)
        for i in range(2):
            Image.new("RGB", (16, 12), (40 * i, 90, 30)).save(src / split / "images" / f"{split}{i}.jpg")
            (src / split / "labels" / f"{split}{i}.txt").write_text("0 0.5 0.5 0.2 0.2\n1 0.3 0.3 0.1 0.1\n")
    if bad_label:
        (src / "train" / "labels" / "train0.txt").write_text(bad_label)
    (src / "data.yaml").write_text("nc: 2\nnames: [a, b]\n")
    with zipfile.ZipFile(path, "w") as z:
        for p in src.rglob("*"):
            if p.is_file():
                z.write(p, p.relative_to(src).as_posix())
    shutil.rmtree(src)
    return path


def _cfg(tmp_path, archive: Path) -> dict:
    return {"kind": "archive", "location": "external/demo", "lock": str(tmp_path / "lock" / "demo.csv"),
            "license": "CC BY 4.0", "attribution": "prueba",
            "annotation": {"format": "yolo", "classes": ["a", "b"]},
            "archive": {"url": "https://example.invalid/demo.zip", "filename": "demo.zip",
                        "size": archive.stat().st_size, "md5": md5_path(archive)}}


@pytest.fixture
def fake_download(monkeypatch):
    calls = []

    def _install(source: Path, fail: Exception | None = None):
        def fake(url, dest, **kw):
            calls.append(url)
            if fail:
                raise fail
            dest.parent.mkdir(parents=True, exist_ok=True)
            shutil.copy(source, dest)
            return dest
        monkeypatch.setattr(ds, "download", fake)
        return calls
    return _install


def test_prepare_is_idempotent_and_never_overwrites(tmp_path, fake_download):
    pub = _yolo_zip(tmp_path / "pub.zip")
    cfg, root = _cfg(tmp_path, pub), tmp_path / "data"
    calls = fake_download(pub)
    r1 = ds.prepare("demo", cfg, root=root, log=lambda *_: None)
    assert r1["action"] == "prepared" and r1["status"] == "unlocked" and r1["images"] == 4 and r1["boxes"] == 8
    dest = ds.source_dir(cfg, root)
    ds.write_lock(ds.tree_rows(dest), Path(cfg["lock"]))
    assert ds.verify_tree(dest, ds.read_lock(Path(cfg["lock"]))).ok

    r2 = ds.prepare("demo", cfg, root=root, log=lambda *_: None)          # repetida: no descarga ni duplica
    assert r2["action"] == "none" and len(calls) == 1
    assert ds.verify_tree(dest, ds.read_lock(Path(cfg["lock"]))).n_files == r1["n_files"]
    assert not list(dest.parent.glob(".staging-*"))

    victim = dest / "train" / "labels" / "train0.txt"
    victim.write_text("0 0.1 0.1 0.1 0.1\n")                               # copia local modificada
    with pytest.raises(ds.PreparationError, match="modified"):
        ds.prepare("demo", cfg, root=root, log=lambda *_: None)
    assert victim.read_text() == "0 0.1 0.1 0.1 0.1\n"                    # no se sobrescribió
    victim.unlink()
    assert ds.verify_tree(dest, ds.read_lock(Path(cfg["lock"]))).status == "incomplete"


def test_prepare_rejects_truncated_download_and_bad_archive(tmp_path, fake_download):
    pub = _yolo_zip(tmp_path / "pub.zip")
    cfg, root = _cfg(tmp_path, pub), tmp_path / "data"
    fake_download(pub, fail=DownloadError("Descarga truncada: 10 de 20 bytes"))
    with pytest.raises(DownloadError):
        ds.prepare("demo", cfg, root=root, log=lambda *_: None)
    assert not ds.source_dir(cfg, root).exists()

    dl = root / "raw" / "_downloads" / "demo.zip"                       # archivo previo con MD5 distinto
    dl.parent.mkdir(parents=True, exist_ok=True)
    dl.write_bytes(b"x" * cfg["archive"]["size"])
    with pytest.raises(ds.PreparationError, match="MD5"):
        ds.prepare("demo", cfg, root=root, log=lambda *_: None)
    assert dl.read_bytes() == b"x" * cfg["archive"]["size"]              # no se borra lo existente
    assert not ds.source_dir(cfg, root).exists()

    cfg["archive"]["sha256"] = "0" * 64                                    # hash registrado distinto
    dl.unlink()
    fake_download(pub)
    with pytest.raises(ds.PreparationError, match="SHA-256"):
        ds.prepare("demo", cfg, root=root, log=lambda *_: None)
    assert not ds.source_dir(cfg, root).exists()


@pytest.mark.parametrize("bad, frag", [("7 0.5 0.5 0.1 0.1\n", "fuera de"), ("0 1.5 0.5 0.1 0.1\n", "coordenadas"),
                                       ("0 0.5\n", "no válida")])
def test_invalid_labels_block_preparation(tmp_path, fake_download, bad, frag):
    pub = _yolo_zip(tmp_path / "pub.zip", bad_label=bad)
    cfg, root = _cfg(tmp_path, pub), tmp_path / "data"
    fake_download(pub)
    with pytest.raises(ds.PreparationError, match=frag):
        ds.prepare("demo", cfg, root=root, log=lambda *_: None)
    assert not ds.source_dir(cfg, root).exists()
    assert not list((root / "external").glob(".staging-*"))


def test_lock_mismatch_after_extraction_is_rejected(tmp_path, fake_download):
    pub = _yolo_zip(tmp_path / "pub.zip")
    cfg, root = _cfg(tmp_path, pub), tmp_path / "data"
    ds.write_lock([{"path": "train/images/train0.jpg", "bytes": 1, "sha256": "0" * 64}], Path(cfg["lock"]))
    fake_download(pub)
    with pytest.raises(ds.PreparationError, match="bloqueo"):
        ds.prepare("demo", cfg, root=root, log=lambda *_: None)
    assert not ds.source_dir(cfg, root).exists()


def test_roboflow_source_requires_env_key(tmp_path, monkeypatch):
    monkeypatch.delenv("ROBOFLOW_API_KEY", raising=False)
    cfg = ds.load_sources()["drberry_pry20220204"]
    with pytest.raises(ds.PreparationError, match="ROBOFLOW_API_KEY"):
        ds.prepare("drberry_pry20220204", cfg, root=tmp_path, log=lambda *_: None)


def test_authorized_sources_and_lock_files():
    src = ds.load_sources()
    assert set(src) == {"drberry_pry20220204", "blueberry_yolo_zhang"}
    assert src["drberry_pry20220204"]["role"] == "primary_training"
    z = src["blueberry_yolo_zhang"]
    assert z["role"] == "complementary_evaluation" and "train" not in z["allowed_use"]
    assert any("sanas" in f for f in z["forbidden_use"])
    lock = ds.read_lock(ds.lock_path(z))
    assert len(lock) == z["expected"]["files"]
    assert sum(r["path"].endswith(".jpg") for r in lock) == z["expected"]["images"]
    assert all(re.fullmatch(r"[0-9a-f]{64}", r["sha256"]) for r in lock)


def test_prepare_script_reports_missing_storage(tmp_path):
    env = {**__import__("os").environ, ENV_DATA: str(tmp_path / "no_existe")}
    r = subprocess.run([sys.executable, str(VISION_ROOT / "scripts/prepare_data.py"), "verify"],
                       capture_output=True, text=True, encoding="utf-8", env=env)
    assert r.returncode == 3 and ENV_DATA in r.stdout


# ── inferencia sin dataset ───────────────────────────────────────────────────

def _artifact(tmp_path) -> Path:
    import torch
    from berryvision.training.models import build_model
    art = tmp_path / "models" / "tiny"
    art.mkdir(parents=True)
    torch.manual_seed(0)
    torch.save(build_model("smallcnn", 3, pretrained=False, dropout=0.0).state_dict(), art / "model.pt")
    card = {"artifact_id": "tiny", "arch": "smallcnn", "dropout": 0.0, "classes": ["ok", "x", "y"],
            "healthy_class": "ok", "imgsz": 64, "alert_threshold": 0.5, "weights_file": "model.pt",
            "weights_sha256": sha256_path(art / "model.pt"), "taxonomy": "test/tiny", "intended_use": "pruebas"}
    (art / "model_card.json").write_text(json.dumps(card), encoding="utf-8")
    return art


def test_inference_works_with_training_storage_disconnected(tmp_path, monkeypatch):
    from PIL import Image
    from berryvision.inference import ArtifactError, Predictor
    art = _artifact(tmp_path)
    monkeypatch.setenv(ENV_DATA, str(tmp_path / "dataset_desconectado"))
    monkeypatch.setenv(ENV_MODEL, str(art.parent))
    out = Predictor.load("tiny").predict([Image.new("RGB", (80, 50), (20, 120, 40))])[0]
    assert out["is_diagnosis"] is False and abs(sum(out["probs"].values()) - 1) < 1e-5
    assert out["alert"] == (out["alert_score"] >= 0.5) and out["taxonomy"] == "test/tiny"
    with pytest.raises(ArtifactError, match="No existe"):
        Predictor.load("otro")
    with open(art / "model.pt", "ab") as fh:
        fh.write(b"0")                                                   # peso dañado
    with pytest.raises(ArtifactError, match="SHA-256"):
        Predictor.load("tiny")


def test_predict_script_exit_codes(tmp_path):
    from PIL import Image
    art = _artifact(tmp_path)
    img = tmp_path / "a.jpg"
    Image.new("RGB", (30, 30)).save(img)
    env = {**__import__("os").environ, ENV_MODEL: str(art.parent), ENV_DATA: str(tmp_path / "nada")}
    script = str(VISION_ROOT / "scripts/predict.py")
    ok = subprocess.run([sys.executable, script, "--artifact", "tiny", str(img)], capture_output=True, text=True,
                        encoding="utf-8", env=env)
    assert ok.returncode == 0 and json.loads(ok.stdout)["model_version"] == "tiny"
    missing = subprocess.run([sys.executable, script, "--artifact", "falta", str(img)], capture_output=True,
                             text=True, encoding="utf-8", env=env)
    assert missing.returncode == 3 and "No existe" in missing.stderr


# ── contexto Docker ──────────────────────────────────────────────────────────

def test_docker_context_is_whitelist_without_data_or_secrets():
    ignore = [l.strip() for l in (VISION_ROOT / ".dockerignore").read_text(encoding="utf-8").splitlines()
              if l.strip() and not l.startswith("#")]
    assert ignore[0] == "*"                                               # todo excluido por defecto
    allowed = {l[1:].rstrip("/") for l in ignore if l.startswith("!")}
    assert allowed == {"requirements-infer.txt", "src", "scripts/predict.py"}
    docker = (VISION_ROOT / "Dockerfile").read_text(encoding="utf-8")
    copies = re.findall(r"^COPY\s+(\S+)", docker, flags=re.M)
    assert copies and all(any(c.rstrip("/").startswith(a) for a in allowed) for c in copies)
    assert not re.search(r"^(ENV|ARG)\s+.*(KEY|TOKEN|SECRET|PASSWORD)", docker, flags=re.M | re.I)
    assert not re.search(r"prepare_data|fetch_|curl|wget", docker)       # nunca descarga datasets en el build
    assert not any(p.suffix in {".pt", ".pth", ".onnx", ".jpg", ".png"} for p in (VISION_ROOT / "src").rglob("*"))


def test_origin_group_split_keeps_crops_of_one_photo_together(tmp_path):
    from PIL import Image
    cfg = {"origin_pattern": r"^(.+?)-(?:JPG|jpg|JPEG|jpeg|PNG|png)_\d+_"}
    for split, names in {"train": ["IMG_1-JPG_1_png.rf.a.jpg", "IMG_2-JPG_1_png.rf.b.jpg"],
                         "test": ["IMG_1-JPG_2_png.rf.c.jpg"]}.items():
        (tmp_path / split / "images").mkdir(parents=True)
        for n in names:
            Image.new("RGB", (4, 4)).save(tmp_path / split / "images" / n)
    rows = ds.group_split_rows(cfg, tmp_path)
    by = {r["rel_path"].split("/")[-1]: r for r in rows}
    assert by["IMG_1-JPG_1_png.rf.a.jpg"]["group_split"] == by["IMG_1-JPG_2_png.rf.c.jpg"]["group_split"]
    assert {r["origin"] for r in rows} == {"IMG_1", "IMG_2"}
    (tmp_path / "test" / "images" / "suelta.jpg").write_bytes(b"x")
    with pytest.raises(ds.PreparationError, match="origin_pattern"):
        ds.group_split_rows(cfg, tmp_path)
