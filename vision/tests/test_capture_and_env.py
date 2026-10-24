"""Pruebas del esquema de metadatos de captura de AGRAR y del riesgo ambiental (datos sintéticos)."""

from datetime import datetime, timedelta, timezone
from pathlib import Path

import yaml

from berryvision.capture_metadata import environment_age_minutes, validate_capture
from berryvision.env_risk import Reading, RiskParams, data_gaps, risk_events

VISION_ROOT = Path(__file__).resolve().parents[1]
TZ = timezone(timedelta(hours=-5))


def _rec(**over):
    rec = {
        "image_id": "img-1", "session_id": "S1", "captured_at": "2026-10-24T09:00:00-05:00",
        "camera": {"camera_id": "x2_rgbd_head_front_rgb"},
        "location": {"farm_id": "F1", "bed_id": "C2"}, "organ": "fruit_green",
        "annotations": [{"label": "botrytis_suspected", "evidence_level": "suspected", "task": "lesion_detection",
                         "labeled_by": "anotador-1", "labeled_at": "2026-10-24T10:00:00-05:00"}],
        "environment": [{"variable": "relative_humidity_pct", "value": 92.0, "source_sensor_id": "S-07",
                         "measured_at": "2026-10-24T08:50:00-05:00", "quality": "ok"}],
        "consent": {"owner": "AGRAR", "use_scope": "investigacion_hackathon"},
    }
    rec.update(over)
    return rec


def test_valid_capture_and_env_age():
    assert validate_capture(_rec()) == []
    assert environment_age_minutes(_rec()) == [10.0]


def test_confirmed_requires_expert_or_lab_and_confirmation_block():
    a = {"label": "botrytis_confirmed", "evidence_level": "suspected", "task": "lesion_detection",
         "labeled_by": "x", "labeled_at": "2026-10-24T10:00:00-05:00"}
    probs = validate_capture(_rec(annotations=[a]))
    assert any("exige evidencia" in p for p in probs) and any("confirmation" in p for p in probs)
    a2 = {**a, "evidence_level": "lab_confirmed", "confirmation": {"method": "cámara húmeda", "by": "lab", "date": "2026-10-25"}}
    assert validate_capture(_rec(annotations=[a2])) == []


def test_project_rules_on_labels():
    base = {"labeled_by": "x", "labeled_at": "2026-10-24T10:00:00-05:00"}
    cases = [
        ({"label": "no_visible_symptoms", "evidence_level": "confirmed_healthy", "task": "organ_classification"}, "no equivale"),
        ({"label": "thrips_damage", "evidence_level": "expert_confirmed", "task": "thrips_damage_compatible"}, "trips"),
        ({"label": "botrytis_suspected", "evidence_level": "suspected", "task": "image_level", "source": "environment"}, "ambientales"),
        ({"label": "alternaria_suspected", "evidence_level": "lab_confirmed", "task": "lesion_detection"}, "_confirmed"),
    ]
    for ann, frag in cases:
        assert any(frag in p for p in validate_capture(_rec(annotations=[{**base, **ann}]))), frag


def test_stale_environment_reading_must_be_flagged():
    env = [{"variable": "temperature_c", "value": 18.0, "source_sensor_id": "S-01",
            "measured_at": "2026-10-24T03:00:00-05:00", "quality": "ok"}]
    assert any("desactualizada" in p for p in validate_capture(_rec(environment=env)))
    env[0]["quality"] = "desactualizada"
    assert validate_capture(_rec(environment=env)) == []


def test_schema_and_taxonomy_files_are_consistent():
    import json
    schema = json.loads((VISION_ROOT / "contracts/agrar_capture_metadata.schema.json").read_text(encoding="utf-8"))
    tax = yaml.safe_load((VISION_ROOT / "knowledge/datasets/blueberry_taxonomy.yaml").read_text(encoding="utf-8"))
    ev_schema = set(schema["properties"]["annotations"]["items"]["properties"]["evidence_level"]["enum"])
    assert ev_schema == set(tax["evidence_levels"])
    assert set(schema["properties"]["organ"]["enum"]) == set(tax["organs"])


def _series(sensor, start, hours, temp, rh=None, wet=None, step_min=15):
    out, t = [], start
    while t <= start + timedelta(hours=hours):
        out.append(Reading(sensor, t, temp, rh, wet))
        t += timedelta(minutes=step_min)
    return out


def test_risk_event_requires_more_than_six_wet_hours_in_range():
    t0 = datetime(2026, 10, 24, 0, 0, tzinfo=TZ)
    long_wet = _series("A", t0, 7, temp=18.0, wet=True)
    short_wet = _series("B", t0, 5, temp=18.0, wet=True)
    cold = _series("C", t0, 8, temp=10.0, wet=True)
    ev = {e["sensor_id"]: e for e in risk_events(long_wet + short_wet + cold)}
    assert ev["A"]["risk"] and ev["A"]["hours"] == 7.0 and ev["A"]["wetness_source"] == "leaf_wetness_sensor"
    assert not ev["B"]["risk"]
    assert "C" not in ev
    assert all(e["is_diagnosis"] is False for e in ev.values())


def test_rh_proxy_is_declared_and_gaps_break_continuity():
    t0 = datetime(2026, 10, 24, 0, 0, tzinfo=TZ)
    first = _series("D", t0, 4, temp=16.0, rh=95.0)
    second = _series("D", t0 + timedelta(hours=5), 4, temp=16.0, rh=95.0)   # hueco de ~1 h
    ev = risk_events(first + second, RiskParams())
    assert len(ev) == 2 and not any(e["risk"] for e in ev)                  # 4 h + 4 h no suman
    assert all(e["wetness_source"] == "proxy_rh" for e in ev)
    assert data_gaps(first + second)[0]["minutes"] == 60.0


def test_validate_capture_session_script(tmp_path):
    import json
    import subprocess
    import sys
    from PIL import Image
    from berryvision.audit import sha256_file
    sess = tmp_path / "F1" / "S1"
    (sess / "images").mkdir(parents=True)
    recs = []
    for i, (lab, ev) in enumerate([("botrytis_suspected", "suspected"), ("botrytis_suspected", "suspected"),
                                   ("no_visible_symptoms", "no_visible_symptoms")]):
        p = sess / "images" / f"{i}.jpg"
        Image.new("RGB", (32, 24), (i * 40, 120, 40)).save(p)
        r = _rec(image_id=f"img-{i}", session_id="S1",
                 annotations=[{"label": lab, "evidence_level": ev, "task": "organ_classification",
                               "labeled_by": "a", "labeled_at": "2026-10-24T10:00:00-05:00"}])
        r["file"] = {"rel_path": f"images/{i}.jpg", "sha256": sha256_file(p)}
        recs.append(r)
    (sess / "captures.jsonl").write_text("\n".join(json.dumps(r) for r in recs), encoding="utf-8")
    script = VISION_ROOT / "scripts/validate_capture_session.py"
    ok = subprocess.run([sys.executable, str(script), str(sess)], capture_output=True, text=True, encoding="utf-8")
    assert ok.returncode == 0, ok.stdout + ok.stderr
    assert "faltan negativos pareados" in ok.stdout          # 2 positivos vs 1 negativo en la misma cámara/sesión
    (sess / "images" / "0.jpg").write_bytes(b"modificado")
    bad = subprocess.run([sys.executable, str(script), str(sess)], capture_output=True, text=True, encoding="utf-8")
    assert bad.returncode == 1 and "SHA-256" in bad.stdout
