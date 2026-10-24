"""Respaldo y descarga de datasets y modelos en un repositorio PRIVADO de Hugging Face.

Git guarda el código, los bloqueos de hashes (`manifests/data_lock/`) y este puntero;
los archivos pesados viven en un repo de datasets privado (`BERRYVISION_HF_REPO`,
p. ej. `mi-org/berryvision-data`) con esta estructura:

    datasets/<id>/ACQUISITION.json, datasets/<id>/extracted/...   (copia exacta de data/external/<id>;
    las colecciones sin `extracted/`, p. ej. images/ + labels/, se copian enteras)
    models/<id>/model.pt, models/<id>/model_card.json

Reglas:
- solo se sube a un repo que exista y sea privado (crearlo es una acción explícita, `--create`);
- no se suben licencias incompatibles (sin derivadas, solo académicas o desconocidas);
- tras subir se comparan tamaños y SHA-256 remotos con el bloqueo; tras bajar se verifica
  todo antes de mover la copia a su sitio, y nunca se sobrescribe una copia local existente;
- el token solo se lee de la variable HF_TOKEN (o del login de `hf auth`), nunca de archivos del repo.
"""

from __future__ import annotations

import json
import os
import shutil
from pathlib import Path

from .datasources import read_lock, tree_rows, verify_tree, write_lock
from .acquisition import sha256_path
from .storage import VISION_ROOT, data_dir, model_dir

ENV_REPO = "BERRYVISION_HF_REPO"
REPO_TYPE = "dataset"
BLOCKED_LICENSE_MARKERS = ("nd", "noderiv", "sin derivadas", "academic", "académic", "desconocida", "unknown",
                           "verificar")


class HubError(RuntimeError):
    """El repositorio remoto no es seguro o la copia no coincide."""


def repo_id() -> str:
    rid = os.environ.get(ENV_REPO)
    if not rid or "/" not in rid:
        raise HubError(f"Defina {ENV_REPO}=<organización>/<repo> (repo de datasets privado de Hugging Face)")
    return rid


def get_api():
    from huggingface_hub import HfApi  # dependencia opcional (extra `hub`)
    return HfApi()


def license_allowed(text: str | None) -> bool:
    if not text:
        return False
    t = text.lower().replace("-", " ")
    tokens = set(t.replace("(", " ").replace(")", " ").replace(",", " ").split())
    return not any((m in tokens) if len(m) <= 2 else (m in t) for m in BLOCKED_LICENSE_MARKERS)


def ensure_private_repo(api, rid: str, create: bool = False) -> None:
    try:
        info = api.repo_info(rid, repo_type=REPO_TYPE)
    except Exception as exc:  # noqa: BLE001 — el cliente lanza varios tipos según la versión
        if not create:
            raise HubError(f"No se pudo acceder a {rid} ({type(exc).__name__}). Créelo con --create "
                           "o revise HF_TOKEN y permisos") from exc
        api.create_repo(rid, repo_type=REPO_TYPE, private=True, exist_ok=True)
        info = api.repo_info(rid, repo_type=REPO_TYPE)
    if not getattr(info, "private", False):
        raise HubError(f"{rid} es PÚBLICO: no se sube nada (los datos tienen licencias con condiciones)")


def _rel(p: Path) -> str:
    try:
        return p.relative_to(VISION_ROOT).as_posix()
    except ValueError:
        return str(p)


def _lock_file(dataset_id: str) -> Path:
    return VISION_ROOT / "manifests" / "data_lock" / f"{dataset_id}.csv"


def _payload(local: Path) -> tuple[Path, str, frozenset[str]]:
    """Raíz del contenido bloqueado: `extracted/` si existe; si no, la carpeta entera sin ACQUISITION.json."""
    if (local / "extracted").is_dir():
        return local / "extracted", "extracted/", frozenset()
    return local, "", frozenset({"ACQUISITION.json"})


def _remote_files(api, rid: str, prefix: str) -> dict[str, tuple[int, str | None]]:
    out = {}
    for f in api.list_repo_tree(rid, path_in_repo=prefix, recursive=True, expand=True, repo_type=REPO_TYPE):
        if hasattr(f, "size") and getattr(f, "type", "file") != "directory" and not hasattr(f, "tree_id"):
            lfs = getattr(f, "lfs", None)
            sha = getattr(lfs, "sha256", None) if lfs is not None else None
            out[f.path[len(prefix) + 1:]] = (f.size, sha)
    return out


def _check_remote(api, rid: str, prefix: str, expected: list[dict]) -> dict:
    remote = _remote_files(api, rid, prefix)
    exp = {r["path"]: r for r in expected}
    missing = sorted(set(exp) - set(remote))
    bad = [p for p in exp if p in remote and (remote[p][0] != exp[p]["bytes"]
                                              or (remote[p][1] and remote[p][1] != exp[p]["sha256"]))]
    sha_checked = sum(1 for p in exp if p in remote and remote[p][1])
    if missing or bad:
        raise HubError(f"La copia remota no coincide: faltan {len(missing)}, distintos {len(bad)} "
                       f"(p. ej. {(missing + bad)[:3]})")
    return {"files": len(exp), "sha256_checked_remote": sha_checked}


def push_dataset(dataset_id: str, api=None, create: bool = False, log=print) -> dict:
    api = api or get_api()
    rid = repo_id()
    local = data_dir(must_exist=True) / "external" / dataset_id
    acq = local / "ACQUISITION.json"
    if not acq.is_file():
        raise HubError(f"{local} no tiene ACQUISITION.json: sin procedencia no se respalda")
    lic = json.loads(acq.read_text(encoding="utf-8")).get("license")
    if not license_allowed(lic):
        raise HubError(f"Licencia no apta para copiar a un repo privado compartido: {lic!r}")
    root, sub, exclude = _payload(local)
    lf = _lock_file(dataset_id)
    if lf.exists():
        st = verify_tree(root, read_lock(lf), exclude=exclude)
        if not st.ok:
            raise HubError(f"La copia local de {dataset_id} no coincide con su bloqueo ({st.status}); no se sube")
    else:
        rows = tree_rows(root, exclude=exclude)
        if not rows:
            raise HubError(f"{local} no tiene archivos que respaldar")
        write_lock(rows, lf)
        log(f"bloqueo creado: {_rel(lf)} (versiónelo en Git)")
    expected = [{**r, "path": f"{sub}{r['path']}"} for r in read_lock(lf)]
    expected.append({"path": "ACQUISITION.json", "bytes": acq.stat().st_size, "sha256": sha256_path(acq)})
    ensure_private_repo(api, rid, create)
    prefix = f"datasets/{dataset_id}"
    api.upload_folder(folder_path=str(local), path_in_repo=prefix, repo_id=rid, repo_type=REPO_TYPE,
                      allow_patterns=["ACQUISITION.json", f"{sub}**"],
                      commit_message=f"datasets/{dataset_id}: {len(expected)} archivos ({lic})")
    res = _check_remote(api, rid, prefix, expected)
    log(f"{dataset_id}: {res['files']} archivos verificados en {rid} "
        f"({res['sha256_checked_remote']} con SHA-256 remoto, el resto por tamaño)")
    return res


def pull_dataset(dataset_id: str, api=None, log=print) -> dict:
    api = api or get_api()
    rid = repo_id()
    lf = _lock_file(dataset_id)
    if not lf.exists():
        raise HubError(f"Falta {_rel(lf)}: sin bloqueo no se puede verificar la descarga")
    dest = data_dir(must_exist=True) / "external" / dataset_id
    lock = read_lock(lf)
    root, _, exclude = _payload(dest)
    st = verify_tree(root, lock, exclude=exclude)
    if st.ok:
        log(f"{dataset_id}: la copia local ya está íntegra; no se descarga")
        return {"action": "none"}
    if st.status != "missing":
        raise HubError(f"{dest} existe con estado '{st.status}'; no se sobrescribe")
    staging = dest.parent / f".hub-staging-{dataset_id}-{os.getpid()}"
    try:
        api.snapshot_download(rid, repo_type=REPO_TYPE, allow_patterns=[f"datasets/{dataset_id}/*",
                                                                        f"datasets/{dataset_id}/**"],
                              local_dir=str(staging))
        got = staging / "datasets" / dataset_id
        shutil.rmtree(got / ".cache", ignore_errors=True)
        groot, _, gexclude = _payload(got)
        st2 = verify_tree(groot, lock, exclude=gexclude)
        if not st2.ok:
            raise HubError(f"La descarga no coincide con el bloqueo ({st2.status}: faltan {len(st2.missing)}, "
                           f"distintos {len(st2.changed)}, sobrantes {len(st2.extra)})")
        dest.parent.mkdir(parents=True, exist_ok=True)
        got.replace(dest)
    finally:
        shutil.rmtree(staging, ignore_errors=True)
    log(f"{dataset_id}: {st2.n_files} archivos descargados y verificados en {dest}")
    return {"action": "pulled", "n_files": st2.n_files}


def push_model(artifact_id: str, api=None, create: bool = False, log=print) -> dict:
    api = api or get_api()
    rid = repo_id()
    art = model_dir(must_exist=True) / artifact_id
    card = json.loads((art / "model_card.json").read_text(encoding="utf-8"))
    weights = art / card["weights_file"]
    if sha256_path(weights) != card["weights_sha256"]:
        raise HubError("Los pesos locales no coinciden con model_card.json; no se suben")
    ensure_private_repo(api, rid, create)
    prefix = f"models/{artifact_id}"
    api.upload_folder(folder_path=str(art), path_in_repo=prefix, repo_id=rid, repo_type=REPO_TYPE,
                      allow_patterns=["model_card.json", card["weights_file"]],
                      commit_message=f"models/{artifact_id}")
    expected = [{"path": card["weights_file"], "bytes": weights.stat().st_size, "sha256": card["weights_sha256"]}]
    res = _check_remote(api, rid, prefix, expected)
    log(f"modelo {artifact_id} verificado en {rid}")
    return res


def pull_model(artifact_id: str, api=None, log=print) -> dict:
    api = api or get_api()
    rid = repo_id()
    dest = model_dir() / artifact_id
    if dest.exists():
        raise HubError(f"{dest} ya existe; no se sobrescribe")
    staging = dest.parent / f".hub-staging-{artifact_id}-{os.getpid()}"
    try:
        api.snapshot_download(rid, repo_type=REPO_TYPE, allow_patterns=[f"models/{artifact_id}/*"],
                              local_dir=str(staging))
        got = staging / "models" / artifact_id
        card = json.loads((got / "model_card.json").read_text(encoding="utf-8"))
        if sha256_path(got / card["weights_file"]) != card["weights_sha256"]:
            raise HubError("Los pesos descargados no coinciden con su model_card.json")
        shutil.rmtree(got / ".cache", ignore_errors=True)
        dest.parent.mkdir(parents=True, exist_ok=True)
        got.replace(dest)
    finally:
        shutil.rmtree(staging, ignore_errors=True)
    log(f"modelo {artifact_id} descargado y verificado en {dest}")
    return {"action": "pulled"}
