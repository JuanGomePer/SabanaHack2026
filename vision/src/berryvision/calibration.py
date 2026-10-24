"""Lectura de SOLO LECTURA de la calibración de fábrica del AgiBot X2.

Archivo oficial en PC2:
    /agibot/data/param/protected/factory_calib/factory_calibration_params.yml

Reglas: nunca se modifica ni se copia al repositorio, no se sustituyen sus
valores por estimaciones y se comprueba que la resolución de calibración
coincide con la de la imagen usada.
"""

from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path

import yaml

FACTORY_CALIB_PATH = "/agibot/data/param/protected/factory_calib/factory_calibration_params.yml"
CAMERA_FIELDS = ("model_type", "image_width", "image_height", "K", "D")
MODEL_TYPES = ("PINHOLE", "KANNALA_BRANDT")


class CalibrationError(ValueError):
    pass


@dataclass(frozen=True)
class CameraCalibration:
    section: str
    model_type: str
    image_width: int
    image_height: int
    K: tuple[float, ...]
    D: tuple[float, ...]
    R_baselink_sensor: tuple[float, ...] | None
    t_baselink_sensor: tuple[float, ...] | None

    @property
    def fx(self) -> float:
        return self.K[0]

    @property
    def fy(self) -> float:
        return self.K[4]

    @property
    def cx(self) -> float:
        return self.K[2]

    @property
    def cy(self) -> float:
        return self.K[5]


def _flat(value) -> tuple[float, ...]:
    if isinstance(value, dict) and "data" in value:  # formato OpenCV/ROS {rows, cols, data}
        value = value["data"]
    out: list[float] = []
    for v in value:
        out.extend(_flat(v) if isinstance(v, (list, tuple)) else [float(v)])
    return tuple(out)


def load_camera_section(path: str | Path, section: str = "head_rgbd_rgb") -> CameraCalibration:
    path = Path(path)
    # Abrir en modo lectura; este módulo no tiene ninguna ruta de escritura.
    with open(path, "r", encoding="utf-8") as fh:
        text = fh.read()
    if text.startswith("%YAML"):  # cabecera de OpenCV FileStorage que PyYAML no acepta
        text = text.split("\n", 1)[1]
    data = yaml.safe_load(text) or {}
    if section not in data:
        raise CalibrationError(f"Sección '{section}' no encontrada; secciones: {sorted(data)}")
    sec = data[section]
    missing = [f for f in CAMERA_FIELDS if f not in sec]
    if missing:
        raise CalibrationError(f"Faltan campos en '{section}': {missing}")
    if sec["model_type"] not in MODEL_TYPES:
        raise CalibrationError(f"model_type desconocido: {sec['model_type']}")
    K = _flat(sec["K"])
    if len(K) == 4:  # (fx, fy, cx, cy) -> matriz 3x3 aplanada
        fx, fy, cx, cy = K
        K = (fx, 0.0, cx, 0.0, fy, cy, 0.0, 0.0, 1.0)
    if len(K) != 9:
        raise CalibrationError(f"K debe tener 4 o 9 valores, tiene {len(K)}")
    R = _flat(sec["R_baselink_sensor"]) if "R_baselink_sensor" in sec else None
    t = _flat(sec["t_baselink_sensor"]) if "t_baselink_sensor" in sec else None
    return CameraCalibration(section, sec["model_type"], int(sec["image_width"]), int(sec["image_height"]),
                             K, _flat(sec["D"]), R, t)


def check_resolution(calib: CameraCalibration, width: int, height: int) -> None:
    """Los intrínsecos solo valen para la resolución con la que se calibró."""
    if (calib.image_width, calib.image_height) != (width, height):
        raise CalibrationError(
            f"Calibración a {calib.image_width}x{calib.image_height} pero la imagen es {width}x{height}: "
            "hay que escalar K de forma justificada o usar CameraInfo de esa resolución")
