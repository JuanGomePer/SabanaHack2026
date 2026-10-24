"""Respalda o recupera datasets y modelos en el repo PRIVADO de Hugging Face del equipo.

Requisitos (una sola vez, en la sesión de cada integrante; nunca en archivos del repo):
    BERRYVISION_HF_REPO=<organización>/<repo>   # repo de datasets privado
    HF_TOKEN=<token con permiso de escritura>     # o `hf auth login`
    pip install -e ".[hub]"

Uso:
    python scripts/sync_hub.py status
    python scripts/sync_hub.py push-data  ID [--create]   # data/external/ID → datasets/ID (y verifica)
    python scripts/sync_hub.py pull-data  ID              # datasets/ID → data/external/ID (verificado)
    python scripts/sync_hub.py push-model ID [--create]   # artifacts/models/ID → models/ID
    python scripts/sync_hub.py pull-model ID
Códigos de salida: 0 bien · 1 copia no coincide o repo inseguro · 3 falta configuración.
"""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

VISION_ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(VISION_ROOT / "src"))

from berryvision import hub  # noqa: E402
from berryvision.datasources import read_lock, verify_tree  # noqa: E402
from berryvision.storage import StorageError, data_dir  # noqa: E402


def status() -> int:
    ext = data_dir() / "external"
    print(f"{'dataset':34s} {'licencia':28s} {'apta':5s} {'bloqueo':8s} estado local")
    for d in sorted(p for p in ext.iterdir() if p.is_dir()) if ext.is_dir() else []:
        acq = d / "ACQUISITION.json"
        lic = json.loads(acq.read_text(encoding="utf-8")).get("license") if acq.is_file() else None
        lf = VISION_ROOT / "manifests" / "data_lock" / f"{d.name}.csv"
        root, _, exclude = hub._payload(d)
        st = (verify_tree(root, read_lock(lf), full_hash=False, exclude=exclude).status if lf.exists()
              else "sin bloqueo")
        print(f"{d.name:34s} {str(lic)[:28]:28s} {'sí' if hub.license_allowed(lic) else 'NO':5s} "
              f"{'sí' if lf.exists() else 'no':8s} {st}")
    try:
        print(f"\nrepo remoto: {hub.repo_id()}")
    except hub.HubError as exc:
        print(f"\nrepo remoto: sin configurar ({exc})")
        return 3
    return 0


def main() -> int:
    if hasattr(sys.stdout, "reconfigure"):
        sys.stdout.reconfigure(encoding="utf-8")
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("command", choices=["status", "push-data", "pull-data", "push-model", "pull-model"])
    ap.add_argument("id", nargs="?")
    ap.add_argument("--create", action="store_true", help="crear el repo PRIVADO si no existe")
    a = ap.parse_args()
    if a.command == "status":
        return status()
    if not a.id:
        print(f"{a.command} requiere un ID")
        return 2
    try:
        fn = {"push-data": lambda: hub.push_dataset(a.id, create=a.create),
              "pull-data": lambda: hub.pull_dataset(a.id),
              "push-model": lambda: hub.push_model(a.id, create=a.create),
              "pull-model": lambda: hub.pull_model(a.id)}[a.command]
        fn()
    except ModuleNotFoundError:
        print('Falta huggingface_hub: pip install -e ".[hub]"')
        return 3
    except (hub.HubError, StorageError) as exc:
        print(f"ERROR: {exc}")
        return 3 if hub.ENV_REPO in str(exc) or "HF_TOKEN" in str(exc) else 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
