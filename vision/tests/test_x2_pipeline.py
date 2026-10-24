"""Pruebas de las piezas específicas del AgiBot X2 Ultra (sin robot ni ROS 2)."""

import copy
import io
from pathlib import Path

import pytest
from PIL import Image

from berryvision.calibration import CalibrationError, check_resolution, load_camera_section
from berryvision.config import load_config, validate_config
from berryvision.optics import PRESETS, object_size_px
from berryvision.preprocess import (FrameMismatchError, box_to_network, box_to_source,
                                    check_frame_matches_info, decode_compressed, letterbox_image,
                                    letterbox_params)
from berryvision.safety import ForbiddenHostError, assert_not_pc1, classify_host

VISION_ROOT = Path(__file__).resolve().parents[1]
CONFIG = VISION_ROOT / "configs" / "x2_vision.yaml"


# ---------------------------------------------------------------- seguridad

@pytest.mark.parametrize("addrs", [{"10.0.1.40"}, {"192.168.88.88"}, {"10.0.1.40", "10.0.1.41"}])
def test_pc1_addresses_are_refused(addrs):
    assert classify_host(addrs) == "pc1"
    with pytest.raises(ForbiddenHostError):
        assert_not_pc1(addrs)


def test_pc2_and_external_hosts_are_allowed():
    assert assert_not_pc1({"10.0.1.41", "172.17.0.2"}) == "pc2"
    assert assert_not_pc1({"192.168.1.20"}) == "external"


def test_this_development_machine_is_not_pc1():
    assert classify_host() != "pc1"


# ---------------------------------------------------------------- preprocesamiento

def test_letterbox_1280x720_to_640_preserves_aspect():
    p = letterbox_params(1280, 720, 640)
    assert p.scale == pytest.approx(0.5)
    assert (p.new_w, p.new_h) == (640, 360)
    assert (p.pad_left, p.pad_top) == (0, 140)


def test_letterbox_box_roundtrip_and_clipping():
    p = letterbox_params(1280, 720, 640)
    box = [100.0, 200.0, 300.0, 400.0]
    assert box_to_source(box_to_network(box, p), p) == pytest.approx(box)
    assert box_to_source([-10, 0, 700, 700], p) == pytest.approx([0, 0, 1280, 720])


def test_letterbox_image_does_not_stretch():
    img = Image.new("RGB", (1280, 720), (0, 200, 0))
    out, p = letterbox_image(img, 640)
    assert out.size == (640, 640)
    assert out.getpixel((320, 10)) == (114, 114, 114)   # relleno arriba
    assert out.getpixel((320, 320)) == (0, 200, 0)      # contenido centrado


def test_letterbox_rejects_non_stride_size():
    with pytest.raises(ValueError):
        letterbox_params(1280, 720, 600)


def test_frame_must_match_camera_info():
    check_frame_matches_info(1280, 720, 1280, 720)
    with pytest.raises(FrameMismatchError):
        check_frame_matches_info(1920, 1080, 1280, 720)


def test_decode_compressed_jpeg_returns_rgb():
    buf = io.BytesIO()
    Image.new("RGB", (64, 36), (220, 20, 20)).save(buf, "JPEG", quality=95)
    img = decode_compressed(buf.getvalue())
    assert img.mode == "RGB" and img.size == (64, 36)
    r, g, b = img.getpixel((32, 18))
    assert r > 180 and g < 60 and b < 60   # el rojo sigue en el canal R (no BGR)


# ---------------------------------------------------------------- calibración

CALIB_YAML = """%YAML:1.0
head_rgbd_rgb:
  time: "2026-01-01 00:00:00"
  head_yaw: 0.0
  head_pitch: 0.0
  model_type: PINHOLE
  image_width: 1280
  image_height: 720
  K: [600.0, 0.0, 640.0, 0.0, 600.0, 360.0, 0.0, 0.0, 1.0]
  D: [0.01, -0.02, 0.0, 0.0, 0.0]
  R_baselink_sensor: [1, 0, 0, 0, 1, 0, 0, 0, 1]
  t_baselink_sensor: [0.1, 0.0, 1.2]
stereo_left:
  model_type: KANNALA_BRANDT
  image_width: 2064
  image_height: 1552
  K: [500.0, 500.0, 1032.0, 776.0]
  D: [0, 0, 0, 0]
"""


def test_calibration_is_parsed_read_only(tmp_path):
    # Valores sintéticos de prueba, NO son la calibración de ningún robot.
    path = tmp_path / "calib.yml"
    path.write_text(CALIB_YAML, encoding="utf-8")
    before = path.read_bytes()
    c = load_camera_section(path)
    assert (c.fx, c.fy, c.cx, c.cy) == (600.0, 600.0, 640.0, 360.0)
    assert c.model_type == "PINHOLE" and len(c.D) == 5 and len(c.t_baselink_sensor) == 3
    check_resolution(c, 1280, 720)
    with pytest.raises(CalibrationError):
        check_resolution(c, 1920, 1080)
    kb = load_camera_section(path, "stereo_left")
    assert kb.model_type == "KANNALA_BRANDT" and kb.cx == 1032.0
    assert path.read_bytes() == before


def test_calibration_missing_section_or_fields(tmp_path):
    path = tmp_path / "c.yml"
    path.write_text("head_rgbd_rgb:\n  model_type: PINHOLE\n", encoding="utf-8")
    with pytest.raises(CalibrationError):
        load_camera_section(path)
    with pytest.raises(CalibrationError):
        load_camera_section(path, "head_rear_rgb")


# ---------------------------------------------------------------- configuración

def test_repository_config_is_valid():
    assert validate_config(load_config(CONFIG), base_dir=VISION_ROOT) == []


@pytest.mark.parametrize("mutate,expected", [
    (lambda c: c["robot"].update(compute_unit="PC1"), "PC2"),
    (lambda c: c["robot"].update(forbidden_hosts=[]), "forbidden_hosts"),
    (lambda c: c["camera"].update(width=1280), "CameraInfo"),
    (lambda c: c["camera"].update(subscribe_from="PC3"), "subscribe_from"),
    (lambda c: c["model"].update(imgsz=600), "imgsz"),
    (lambda c: c["model"].update(confidence_threshold=1.5), "confidence_threshold"),
    (lambda c: c["model"].update(engine_path="models/no_existe.engine"), "no existe"),
    (lambda c: c["model"].update(taxonomy=None), "taxonomy"),
    (lambda c: c["inference"].update(enable_3d_projection=True), "use_depth"),
    (lambda c: c["calibration"].update(read_only=False), "read_only"),
])
def test_config_rules_are_enforced(mutate, expected):
    cfg = copy.deepcopy(load_config(CONFIG))
    mutate(cfg)
    problems = validate_config(cfg, base_dir=VISION_ROOT)
    assert any(expected in p for p in problems), problems


# ---------------------------------------------------------------- óptica X2

def test_x2_rgbd_1280_gives_more_pixels_than_discarded_k1():
    f_x2 = PRESETS["x2_rgbd_color_1280"].focal_px
    f_k1 = PRESETS["k1_hipotesis_robocup"].focal_px
    assert f_x2 == pytest.approx(596.8, abs=0.5)
    assert object_size_px(3, f_x2, 0.3) > 2.5 * object_size_px(3, f_k1, 0.3)
