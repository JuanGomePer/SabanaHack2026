"""Respaldo en Hugging Face (con un cliente falso, sin red)."""

import hashlib
import json
import shutil
from pathlib import Path
from types import SimpleNamespace

import pytest

from berryvision import hub
from berryvision.datasources import read_lock, tree_rows, write_lock
from berryvision.storage import ENV_DATA, ENV_MODEL

# ── Hugging Face (cliente falso) ─────────────────────────────────────────────

class FakeHub:
    """Imita las llamadas de HfApi que usa berryvision.hub, sobre un directorio local."""

    def __init__(self, root: Path, private=True, exists=True):
        self.root, self.private, self.exists, self.uploads = root, private, exists, 0

    def repo_info(self, rid, repo_type=None):
        if not self.exists:
            raise FileNotFoundError(rid)
        return SimpleNamespace(private=self.private)

    def create_repo(self, rid, repo_type=None, private=False, exist_ok=False):
        self.exists, self.private = True, private

    def upload_folder(self, folder_path, path_in_repo, repo_id, repo_type, allow_patterns, commit_message):
        self.uploads += 1
        src = Path(folder_path)
        for f in src.rglob("*"):
            rel = f.relative_to(src).as_posix()
            if f.is_file() and (rel in allow_patterns or any(rel.startswith(p.rstrip("*")) for p in allow_patterns)):
                dst = self.root / path_in_repo / rel
                dst.parent.mkdir(parents=True, exist_ok=True)
                shutil.copy(f, dst)

    def list_repo_tree(self, rid, path_in_repo, recursive, expand, repo_type):
        for f in (self.root / path_in_repo).rglob("*"):
            if f.is_file():
                sha = hashlib.sha256(f.read_bytes()).hexdigest()
                yield SimpleNamespace(path=f.relative_to(self.root).as_posix(), size=f.stat().st_size,
                                      lfs=SimpleNamespace(sha256=sha))

    def snapshot_download(self, rid, repo_type, allow_patterns, local_dir):
        prefix = allow_patterns[0].rstrip("/*")
        shutil.copytree(self.root / prefix, Path(local_dir) / prefix)


@pytest.fixture
def hub_env(tmp_path, monkeypatch):
    data = tmp_path / "data"
    ds = data / "external" / "demo"
    (ds / "extracted" / "imgs").mkdir(parents=True)
    for i in range(3):
        (ds / "extracted" / "imgs" / f"{i}.jpg").write_bytes(bytes([i]) * (100 + i))
    (ds / "ACQUISITION.json").write_text(json.dumps({"license": "CC BY 4.0"}), encoding="utf-8")
    locks = tmp_path / "locks"
    monkeypatch.setattr(hub, "_lock_file", lambda i: locks / f"{i}.csv")
    monkeypatch.setenv(ENV_DATA, str(data))
    monkeypatch.setenv(hub.ENV_REPO, "equipo/berryvision-data")
    return SimpleNamespace(data=data, ds=ds, locks=locks, remote=tmp_path / "remote")


def test_license_policy():
    assert hub.license_allowed("CC BY 4.0") and hub.license_allowed("CC BY-NC 4.0 (no comercial)")
    assert hub.license_allowed("CC BY-SA 3.0")
    for bad in ("CC BY-NC-ND 4.0", "uso académico únicamente", None, "verificar en la ficha"):
        assert not hub.license_allowed(bad), bad


def test_push_requires_private_repo_and_verifies(hub_env):
    with pytest.raises(hub.HubError, match="PÚBLICO"):
        hub.push_dataset("demo", api=FakeHub(hub_env.remote, private=False), log=lambda *_: None)
    with pytest.raises(hub.HubError, match="--create"):
        hub.push_dataset("demo", api=FakeHub(hub_env.remote, exists=False), log=lambda *_: None)
    api = FakeHub(hub_env.remote, exists=False)
    res = hub.push_dataset("demo", api=api, create=True, log=lambda *_: None)
    assert api.private and res["files"] == 4 and res["sha256_checked_remote"] == 4
    assert len(read_lock(hub_env.locks / "demo.csv")) == 3


def test_push_refuses_blocked_license_and_modified_copy(hub_env):
    acq = hub_env.ds / "ACQUISITION.json"
    acq.write_text(json.dumps({"license": "CC BY-NC-ND 4.0"}), encoding="utf-8")
    with pytest.raises(hub.HubError, match="Licencia"):
        hub.push_dataset("demo", api=FakeHub(hub_env.remote), log=lambda *_: None)
    acq.write_text(json.dumps({"license": "CC BY 4.0"}), encoding="utf-8")
    write_lock(tree_rows(hub_env.ds / "extracted"), hub_env.locks / "demo.csv")
    (hub_env.ds / "extracted" / "imgs" / "0.jpg").write_bytes(b"cambiado")
    with pytest.raises(hub.HubError, match="no coincide"):
        hub.push_dataset("demo", api=FakeHub(hub_env.remote), log=lambda *_: None)


def test_remote_corruption_is_detected(hub_env, monkeypatch):
    api = FakeHub(hub_env.remote)
    real_upload = api.upload_folder

    def corrupt(**kw):
        real_upload(**kw)
        (hub_env.remote / "datasets/demo/extracted/imgs/1.jpg").write_bytes(b"x")
    api.upload_folder = corrupt
    with pytest.raises(hub.HubError, match="distintos 1"):
        hub.push_dataset("demo", api=api, log=lambda *_: None)


def test_pull_restores_verified_copy_and_never_overwrites(hub_env):
    api = FakeHub(hub_env.remote)
    hub.push_dataset("demo", api=api, log=lambda *_: None)
    original = {p.name: p.read_bytes() for p in (hub_env.ds / "extracted" / "imgs").iterdir()}
    assert hub.pull_dataset("demo", api=api, log=lambda *_: None)["action"] == "none"
    shutil.rmtree(hub_env.ds)                                               # se "pierde" la copia local
    assert hub.pull_dataset("demo", api=api, log=lambda *_: None)["action"] == "pulled"
    assert {p.name: p.read_bytes() for p in (hub_env.ds / "extracted" / "imgs").iterdir()} == original
    assert not list(hub_env.ds.parent.glob(".hub-staging-*"))
    (hub_env.ds / "extracted" / "imgs" / "0.jpg").write_bytes(b"local distinto")
    with pytest.raises(hub.HubError, match="no se sobrescribe"):
        hub.pull_dataset("demo", api=api, log=lambda *_: None)
    assert (hub_env.ds / "extracted" / "imgs" / "0.jpg").read_bytes() == b"local distinto"


def test_flat_layout_without_extracted_roundtrip(hub_env):
    flat = hub_env.data / "external" / "flat"
    (flat / "images").mkdir(parents=True)
    (flat / "labels").mkdir()
    (flat / "images" / "a.jpg").write_bytes(b"img" * 50)
    (flat / "labels" / "a.txt").write_text("0 0.5 0.5 0.1 0.1\n", encoding="utf-8")
    (flat / "ACQUISITION.json").write_text(json.dumps({"license": "CC BY 4.0"}), encoding="utf-8")
    api = FakeHub(hub_env.remote)
    res = hub.push_dataset("flat", api=api, log=lambda *_: None)
    assert res["files"] == 3                                                 # 2 de datos + ACQUISITION.json
    assert {r["path"] for r in read_lock(hub_env.locks / "flat.csv")} == {"images/a.jpg", "labels/a.txt"}
    shutil.rmtree(flat)
    assert hub.pull_dataset("flat", api=api, log=lambda *_: None)["action"] == "pulled"
    assert (flat / "images" / "a.jpg").read_bytes() == b"img" * 50 and (flat / "ACQUISITION.json").is_file()


def test_empty_dataset_is_not_locked(hub_env):
    empty = hub_env.data / "external" / "empty"
    (empty / "images").mkdir(parents=True)
    (empty / "ACQUISITION.json").write_text(json.dumps({"license": "CC BY 4.0"}), encoding="utf-8")
    with pytest.raises(hub.HubError, match="no tiene archivos"):
        hub.push_dataset("empty", api=FakeHub(hub_env.remote), log=lambda *_: None)
    assert not (hub_env.locks / "empty.csv").exists()


def test_pull_rejects_tampered_remote(hub_env):
    api = FakeHub(hub_env.remote)
    hub.push_dataset("demo", api=api, log=lambda *_: None)
    (hub_env.remote / "datasets/demo/extracted/imgs/2.jpg").write_bytes(b"alterado")
    shutil.rmtree(hub_env.ds)
    with pytest.raises(hub.HubError, match="bloqueo"):
        hub.pull_dataset("demo", api=api, log=lambda *_: None)
    assert not hub_env.ds.exists()


def test_model_roundtrip(tmp_path, monkeypatch, hub_env):
    models = tmp_path / "models"
    art = models / "m1"
    art.mkdir(parents=True)
    (art / "model.pt").write_bytes(b"pesos")
    sha = hashlib.sha256(b"pesos").hexdigest()
    (art / "model_card.json").write_text(json.dumps({"weights_file": "model.pt", "weights_sha256": sha}))
    monkeypatch.setenv(ENV_MODEL, str(models))
    api = FakeHub(hub_env.remote)
    hub.push_model("m1", api=api, log=lambda *_: None)
    with pytest.raises(hub.HubError, match="ya existe"):
        hub.pull_model("m1", api=api, log=lambda *_: None)
    shutil.rmtree(art)
    hub.pull_model("m1", api=api, log=lambda *_: None)
    assert (art / "model.pt").read_bytes() == b"pesos"


def test_repo_id_required(monkeypatch):
    monkeypatch.delenv(hub.ENV_REPO, raising=False)
    with pytest.raises(hub.HubError, match=hub.ENV_REPO):
        hub.repo_id()
