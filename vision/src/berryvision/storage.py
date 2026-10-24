"""Ubicaciones de datos y modelos, configurables por variables de entorno.

Separa cuatro cosas que no deben mezclarse (ver docs/14):
- código (Git);
- datasets (fuera de Git y de la imagen Docker): `BERRYVISION_DATA_DIR`, por defecto `vision/data`;
- artefactos de modelo (pesos + ficha): `BERRYVISION_MODEL_DIR`, por defecto `vision/artifacts/models`;
- la inferencia solo necesita el artefacto de modelo, nunca el dataset de entrenamiento.

Si una variable apunta a un directorio que no existe, se falla con un mensaje claro
en lugar de crear en silencio un directorio vacío (que es como "desaparecen" los datos).
"""

from __future__ import annotations

import os
from pathlib import Path

ENV_DATA = "BERRYVISION_DATA_DIR"
ENV_MODEL = "BERRYVISION_MODEL_DIR"

VISION_ROOT = Path(__file__).resolve().parents[2]


class StorageError(RuntimeError):
    """Una ubicación configurada no existe o no contiene lo esperado."""


def _resolve(env: str, default: Path, must_exist: bool) -> Path:
    raw = os.environ.get(env)
    path = Path(raw).expanduser() if raw else default
    if must_exist and not path.is_dir():
        origin = f"la variable {env}" if raw else "la ubicación por defecto"
        raise StorageError(f"{origin} apunta a {path}, que no existe o no es un directorio")
    return path


def data_dir(must_exist: bool = False) -> Path:
    return _resolve(ENV_DATA, VISION_ROOT / "data", must_exist)


def model_dir(must_exist: bool = False) -> Path:
    return _resolve(ENV_MODEL, VISION_ROOT / "artifacts" / "models", must_exist)
