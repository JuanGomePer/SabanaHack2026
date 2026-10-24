"""Estimaciones ópticas aproximadas (modelo pinhole en el centro de la imagen).

Sirven para responder una pregunta de ingeniería antes de entrenar: ¿cuántos
píxeles ocupa una lesión o un insecto a la distancia de trabajo del robot?
Con lentes gran angular (>100°) el modelo pinhole sobreestima la densidad en
los bordes; los valores son orientativos hasta tener la calibración real.
"""

from __future__ import annotations

import math
from dataclasses import dataclass


@dataclass(frozen=True)
class CameraPreset:
    name: str
    width_px: int
    hfov_deg: float | None
    status: str
    source: str
    fx_px: float | None = None

    @property
    def focal_px(self) -> float:
        if self.fx_px is not None:
            return self.fx_px
        if self.hfov_deg is None:
            raise ValueError(f"{self.name}: falta fx o FOV horizontal")
        return focal_px_from_fov(self.width_px, self.hfov_deg)


def focal_px_from_fov(width_px: int, hfov_deg: float) -> float:
    if not 0 < hfov_deg < 180:
        raise ValueError("El FOV horizontal debe estar entre 0 y 180 grados")
    return (width_px / 2) / math.tan(math.radians(hfov_deg) / 2)


def pixels_per_mm(focal_px: float, distance_m: float) -> float:
    if distance_m <= 0:
        raise ValueError("La distancia debe ser positiva")
    return focal_px / (distance_m * 1000)


def object_size_px(size_mm: float, focal_px: float, distance_m: float) -> float:
    return size_mm * pixels_per_mm(focal_px, distance_m)


# Ninguno de estos valores es una calibración de NUESTRO robot: con la unidad
# física se usa fx de CameraInfo / factory_calibration_params.yml.
PRESETS: dict[str, CameraPreset] = {
    "x2_rgbd_color_1280": CameraPreset(
        "X2 Ultra RGB-D color 1280x720 (Gemini 335)", 1280, 94.0,
        "Resolución documentada en la interfaz HAL; FOV de la ficha a 1920x1080 (se asume sin recorte: NO VERIFICADO)",
        "x2-aimdk HAL sensor + sensor_fov"),
    "x2_rgbd_color_1920": CameraPreset(
        "X2 Ultra RGB-D color 1920x1080 (máximo del sensor)", 1920, 94.0,
        "Ficha del fabricante; no es la resolución publicada por defecto", "x2-aimdk sensor_fov"),
    "x2_stereo_frontal": CameraPreset(
        "X2 Ultra estéreo frontal (SenYun SDS23NNS1)", 2064, 156.0,
        "Ficha; lente gran angular (KANNALA_BRANDT): pinhole poco fiable fuera del centro",
        "x2-aimdk sensor_fov"),
    "k1_hipotesis_robocup": CameraPreset(
        "Booster K1 (DESCARTADO; solo comparación)", 544, 105.0,
        "Plataforma descartada el 2026-10-23", "Ficha HSL 2026 Ruhrbot Devils"),
    "k1_demo_vision_yaml": CameraPreset(
        "Booster K1 fx de robocup_demo (DESCARTADO)", 544, None,
        "Plataforma descartada", "BoosterRobotics/robocup_demo vision.yaml", fx_px=206.445511),
}
