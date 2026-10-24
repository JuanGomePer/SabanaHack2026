"""Validación de metadatos de captura de AGRAR (contracts/agrar_capture_metadata.schema.json).

Además de la forma, aplica reglas del proyecto que un JSON Schema no expresa bien:
- `*_confirmed` exige evidencia expert_confirmed o lab_confirmed y un bloque `confirmation`.
- `no_visible_symptoms` nunca se declara como `confirmed_healthy`.
- daño compatible con trips solo puede ser `suspected` salvo confirmación del insecto.
- las lecturas ambientales llevan sensor y hora, y no pueden ser más recientes que la captura
  por más de una tolerancia (se registran tal cual; la antigüedad se calcula, no se inventa).
- nunca se acepta una etiqueta de enfermedad derivada solo del ambiente.
"""

from __future__ import annotations

from datetime import datetime, timedelta

EVIDENCE = {"lab_confirmed", "expert_confirmed", "suspected", "no_visible_symptoms", "confirmed_healthy", "unknown"}
TASKS = {"lesion_detection", "organ_classification", "image_level", "thrips_insect_on_plant",
         "thrips_damage_compatible", "thrips_on_sticky_trap"}
ORGANS = {"leaf", "young_leaf", "flower", "fruit_green", "fruit_ripe", "calyx", "shoot", "stem", "whole_plant", "sticky_trap"}
REQUIRED = ("image_id", "session_id", "captured_at", "camera", "location", "organ", "annotations", "consent")


def _dt(s):
    return datetime.fromisoformat(s)


def validate_capture(rec: dict, max_env_age: timedelta = timedelta(hours=2)) -> list[str]:
    p: list[str] = []
    for k in REQUIRED:
        if k not in rec:
            p.append(f"falta {k}")
    if p:
        return p
    try:
        cap = _dt(rec["captured_at"])
    except (TypeError, ValueError):
        return ["captured_at no es ISO 8601"]
    if cap.tzinfo is None:
        p.append("captured_at debe incluir zona horaria")
    if not rec["camera"].get("camera_id"):
        p.append("camera.camera_id es obligatorio")
    if not rec["location"].get("farm_id"):
        p.append("location.farm_id es obligatorio")
    if rec["organ"] not in ORGANS:
        p.append(f"organ inválido: {rec['organ']}")
    if not rec["consent"].get("owner") or not rec["consent"].get("use_scope"):
        p.append("consent.owner y consent.use_scope son obligatorios")
    for i, a in enumerate(rec["annotations"]):
        lab, ev, task = a.get("label", ""), a.get("evidence_level"), a.get("task")
        if ev not in EVIDENCE:
            p.append(f"annotations[{i}].evidence_level inválido: {ev}")
        if task not in TASKS:
            p.append(f"annotations[{i}].task inválida: {task}")
        if not a.get("labeled_by") or not a.get("labeled_at"):
            p.append(f"annotations[{i}] requiere labeled_by y labeled_at")
        if lab.endswith("_confirmed") and ev not in ("expert_confirmed", "lab_confirmed"):
            p.append(f"annotations[{i}]: '{lab}' exige evidencia expert_confirmed o lab_confirmed (tiene {ev})")
        if lab.endswith("_confirmed") and not a.get("confirmation"):
            p.append(f"annotations[{i}]: '{lab}' requiere bloque confirmation (método, quién, fecha)")
        if lab.endswith("_suspected") and ev in ("expert_confirmed", "lab_confirmed"):
            p.append(f"annotations[{i}]: '{lab}' con evidencia confirmada: use la etiqueta *_confirmed")
        if lab == "no_visible_symptoms" and ev == "confirmed_healthy":
            p.append(f"annotations[{i}]: no_visible_symptoms no equivale a confirmed_healthy")
        if task == "thrips_damage_compatible" and ev not in ("suspected", "unknown"):
            p.append(f"annotations[{i}]: daño compatible con trips solo puede ser suspected/unknown")
        if a.get("source") == "environment":
            p.append(f"annotations[{i}]: una etiqueta no puede derivarse solo de condiciones ambientales")
    for j, e in enumerate(rec.get("environment") or []):
        if not e.get("source_sensor_id") or not e.get("measured_at"):
            p.append(f"environment[{j}] requiere source_sensor_id y measured_at")
            continue
        try:
            m = _dt(e["measured_at"])
        except (TypeError, ValueError):
            p.append(f"environment[{j}].measured_at no es ISO 8601")
            continue
        if m.tzinfo is not None and cap.tzinfo is not None and abs(cap - m) > max_env_age and e.get("quality") in (None, "ok"):
            p.append(f"environment[{j}]: lectura a {abs(cap - m)} de la captura marcada como 'ok' (use quality='desactualizada')")
    return p


def environment_age_minutes(rec: dict) -> list[float | None]:
    cap = _dt(rec["captured_at"])
    out = []
    for e in rec.get("environment") or []:
        try:
            out.append(round(abs((cap - _dt(e["measured_at"])).total_seconds()) / 60, 1))
        except (KeyError, TypeError, ValueError):
            out.append(None)
    return out
