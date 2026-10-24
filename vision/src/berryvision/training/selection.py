"""Regla de selección de experimentos (fijada ANTES de ver resultados, solo con validación).

Motivación: en fresa, la clase sin síntomas viene de otra fuente (Pérez-Borrero) que las
enfermedades (Afzaal), así que "enfermedad vs. sin síntomas" está confundida con la fuente.
El criterio principal es por tanto el recall ENTRE ENFERMEDADES (condicionado a que la
imagen tiene una enfermedad): mide los falsos negativos que sí dependen del síntoma.

Orden lexicográfico (validación):
  1. recall macro condicionado entre enfermedades (más alto mejor), redondeado a 0.01;
  2. peor recall por clase de enfermedad (más alto mejor), redondeado a 0.01;
  3. falsos negativos de alerta al umbral congelado (menos es mejor);
  4. alertas por 100 imágenes al umbral congelado (menos es mejor);
  5. latencia en el equipo de desarrollo (menos es mejor).
"""

from __future__ import annotations

import numpy as np

from .metrics import per_class_report


def disease_conditional(probs: np.ndarray, labels: np.ndarray, classes: list[str], healthy_idx: int) -> dict:
    """Entre imágenes con enfermedad: ¿se elige la enfermedad correcta? (argmax sin la clase sana)."""
    mask = labels != healthy_idx
    dis_idx = [i for i in range(len(classes)) if i != healthy_idx]
    p = probs[mask][:, dis_idx]
    y = np.array([dis_idx.index(v) for v in labels[mask]])
    pred = p.argmax(1)
    rep = per_class_report(y, pred, [classes[i] for i in dis_idx])
    rec = [r["recall"] for r in rep if r["support"]]
    return {"n": int(mask.sum()), "macro_recall": float(np.mean(rec)), "min_recall": float(np.min(rec)),
            "per_class": rep, "y": y.tolist(), "pred": pred.tolist(), "classes": [classes[i] for i in dis_idx]}


def selection_key(summary: dict) -> tuple:
    return (round(summary["disease_cond_macro_recall"], 2), round(summary["disease_cond_min_recall"], 2),
            -summary["alert_fn"], -summary["alerts_per_100"], -summary.get("latency_ms", 0.0))


def select(summaries: list[dict]) -> dict:
    return max(summaries, key=selection_key)
