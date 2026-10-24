"""Carga y validación de configs/x2_vision.yaml.

La validación hace cumplir reglas del proyecto, no solo tipos: PC1 nunca es
destino, la resolución de la cámara no se fija en la config, no se declara un
modelo que no existe y la profundidad no se activa a medias.
"""

from __future__ import annotations

from pathlib import Path

import yaml

from .safety import PC1_ADDRESSES

REQUIRED_CAMERA_TOPICS = ("rgb_topic", "rgb_info_topic", "depth_topic", "depth_info_topic")
FORBIDDEN_CAMERA_KEYS = ("width", "height", "resolution")


def load_config(path: str | Path) -> dict:
    return yaml.safe_load(Path(path).read_text(encoding="utf-8")) or {}


def validate_config(cfg: dict, base_dir: str | Path | None = None) -> list[str]:
    problems: list[str] = []
    robot = cfg.get("robot", {})
    camera = cfg.get("camera", {})
    model = cfg.get("model", {})
    inference = cfg.get("inference", {})
    calib = cfg.get("calibration", {})

    if robot.get("model") != "agibot_x2_ultra":
        problems.append("robot.model debe ser agibot_x2_ultra")
    if robot.get("compute_unit") != "PC2":
        problems.append("robot.compute_unit debe ser PC2 (PC1 está prohibido)")
    if not PC1_ADDRESSES <= set(robot.get("forbidden_hosts", [])):
        problems.append(f"robot.forbidden_hosts debe incluir {sorted(PC1_ADDRESSES)}")

    for key in REQUIRED_CAMERA_TOPICS:
        if not str(camera.get(key, "")).startswith("/"):
            problems.append(f"camera.{key} falta o no es un topic absoluto")
    for key in FORBIDDEN_CAMERA_KEYS:
        if key in camera:
            problems.append(f"camera.{key} no debe fijarse: se lee de CameraInfo")
    if camera.get("subscribe_from") not in (None, "PC2"):
        problems.append("camera.subscribe_from debe ser PC2")

    imgsz = model.get("imgsz")
    if not isinstance(imgsz, int) or imgsz <= 0 or imgsz % 32:
        problems.append("model.imgsz debe ser un entero positivo múltiplo de 32")
    for key in ("confidence_threshold", "nms_iou_threshold"):
        v = model.get(key)
        if v is not None and not (isinstance(v, (int, float)) and 0 <= v <= 1):
            problems.append(f"model.{key} debe estar en [0,1]")
    if not model.get("taxonomy"):
        problems.append("model.taxonomy es obligatoria (evita mezclar cultivos)")
    for key in ("weights_path", "engine_path"):
        p = model.get(key)
        if p is not None:
            full = Path(p) if Path(p).is_absolute() or base_dir is None else Path(base_dir) / p
            if not full.exists():
                problems.append(f"model.{key} declara {p}, que no existe")

    if inference.get("enable_3d_projection") and not inference.get("use_depth"):
        problems.append("inference.enable_3d_projection requiere use_depth: true")
    rate = inference.get("max_rate_hz")
    if rate is not None and not (0 < rate <= camera.get("expected_rate_hz", 30)):
        problems.append("inference.max_rate_hz fuera de rango")

    if calib and calib.get("read_only") is not True:
        problems.append("calibration.read_only debe ser true")
    return problems
