import json
import math
from pathlib import Path

import pytest

from berryvision.observation import EnvironmentalReading, Location, Observation, VisualFinding
from berryvision.optics import PRESETS, focal_px_from_fov, object_size_px, pixels_per_mm

VISION_ROOT = Path(__file__).resolve().parents[1]


def test_focal_from_fov_90_degrees():
    assert focal_px_from_fov(1000, 90) == pytest.approx(500)


def test_k1_hypothesis_is_consistent_with_demo_fx():
    # 544 px y 105° implican fx≈209 px; robocup_demo usa fx=206.4 en su imagen rectificada.
    hyp = PRESETS["k1_hipotesis_robocup"].focal_px
    demo = PRESETS["k1_demo_vision_yaml"].focal_px
    assert hyp == pytest.approx(208.7, abs=0.5)
    assert abs(hyp - demo) / demo < 0.02


def test_pixels_per_mm_scales_inversely_with_distance():
    f = 200.0
    assert pixels_per_mm(f, 0.2) == pytest.approx(2 * pixels_per_mm(f, 0.4))
    assert object_size_px(5, f, 0.5) == pytest.approx(2.0)


def test_invalid_inputs():
    with pytest.raises(ValueError):
        focal_px_from_fov(100, 180)
    with pytest.raises(ValueError):
        pixels_per_mm(100, 0)


def _valid_observation(**overrides):
    obs = Observation(
        observed_at="2026-10-23T10:15:00-05:00",
        model_version="drberry-baseline-0",
        image_reference="evidence/obs-001.jpg",
        camera_id="x2_rgbd_head_front_rgb",
        location=Location(farm_id="F1", bed_id=None),
        visual_findings=[VisualFinding("Alternaria", 0.62, "blueberry_leaf/drberry-v1", [10, 10, 40, 40])],
        environmental_context=[EnvironmentalReading("relative_humidity_pct", 88.0, "S-07", "2026-10-23T10:10:00-05:00")],
    )
    for k, v in overrides.items():
        setattr(obs, k, v)
    return obs


def test_valid_observation_has_no_problems_and_serializes():
    obs = _valid_observation()
    assert obs.validate() == []
    d = obs.to_dict()
    assert d["location"]["bed_id"] is None  # ubicación desconocida no se inventa
    assert d["review_status"] == "pending"
    json.dumps(d)


def test_invalid_observation_is_flagged():
    obs = _valid_observation(review_status="diagnosed")
    obs.visual_findings.append(VisualFinding("gray_mold", 1.4, "", [5, 5, 1, 1]))
    obs.environmental_context.append(EnvironmentalReading("temperature_c", 18.0, "", "ayer"))
    problems = obs.validate()
    assert any("review_status" in p for p in problems)
    assert any("confidence" in p for p in problems)
    assert any("taxonomy" in p for p in problems)
    assert any("degenerada" in p for p in problems)
    assert any("sensor de origen" in p for p in problems)
    assert any("measured_at" in p for p in problems)


def test_json_schema_and_dataclass_agree_on_required_fields():
    schema = json.loads((VISION_ROOT / "contracts/observation.schema.json").read_text(encoding="utf-8"))
    keys = set(_valid_observation().to_dict())
    assert set(schema["required"]) <= keys
    assert set(schema["properties"]["review_status"]["enum"]) == {
        "pending", "confirmed", "rejected", "needs_field_check"}
    assert math.isclose(schema["properties"]["visual_findings"]["items"]["properties"]["confidence"]["maximum"], 1)
