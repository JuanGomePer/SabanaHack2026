"""Métricas de clasificación orientadas a falsos negativos.

Convenciones:
- Multiclase: ROC y AP one-vs-rest por clase; agregaciones macro (media simple),
  weighted (ponderada por soporte) y micro (todas las decisiones binarias juntas).
- Alerta binaria: positivo = cualquier clase de enfermedad; puntuación =
  1 - P(clase sin síntomas). Un FN de alerta = imagen con enfermedad que el
  sistema dejaría pasar como "sin síntomas".
- `confidence` es la salida softmax del modelo: no es una probabilidad calibrada
  de infección. La calibración se mide (ECE), no se supone.
"""

from __future__ import annotations

import math

import numpy as np
from sklearn.metrics import (average_precision_score, confusion_matrix, precision_recall_curve,
                             roc_auc_score, roc_curve)


def wilson_ci(k: int, n: int, z: float = 1.96) -> tuple[float, float]:
    if n == 0:
        return (float("nan"), float("nan"))
    p = k / n
    d = 1 + z * z / n
    c = (p + z * z / (2 * n)) / d
    h = z * math.sqrt(p * (1 - p) / n + z * z / (4 * n * n)) / d
    return (max(0.0, c - h), min(1.0, c + h))


def fbeta(p: float, r: float, beta: float) -> float:
    b2 = beta * beta
    return (1 + b2) * p * r / (b2 * p + r) if (p + r) > 0 else 0.0


def per_class_report(y_true: np.ndarray, y_pred: np.ndarray, classes: list[str]) -> list[dict]:
    cm = confusion_matrix(y_true, y_pred, labels=list(range(len(classes))))
    n = cm.sum()
    out = []
    for i, c in enumerate(classes):
        tp = int(cm[i, i]); fn = int(cm[i].sum() - tp); fp = int(cm[:, i].sum() - tp); tn = int(n - tp - fn - fp)
        prec = tp / (tp + fp) if tp + fp else 0.0
        rec = tp / (tp + fn) if tp + fn else 0.0
        lo, hi = wilson_ci(tp, tp + fn)
        out.append({"class": c, "support": tp + fn, "tp": tp, "fn": fn, "fp": fp, "tn": tn,
                    "precision": prec, "recall": rec, "recall_ci95": [lo, hi],
                    "specificity": tn / (tn + fp) if tn + fp else 0.0,
                    "f1": fbeta(prec, rec, 1), "f2": fbeta(prec, rec, 2),
                    "fn_rate": fn / (tp + fn) if tp + fn else 0.0,
                    "fp_rate": fp / (fp + tn) if fp + tn else 0.0})
    return out


def expected_calibration_error(probs: np.ndarray, y_true: np.ndarray, n_bins: int = 15) -> dict:
    conf = probs.max(1)
    pred = probs.argmax(1)
    correct = (pred == y_true).astype(float)
    edges = np.linspace(0, 1, n_bins + 1)
    ece, bins = 0.0, []
    for lo, hi in zip(edges[:-1], edges[1:]):
        m = (conf > lo) & (conf <= hi)
        if m.sum() == 0:
            bins.append({"lo": lo, "hi": hi, "n": 0, "acc": None, "conf": None})
            continue
        acc, cf = correct[m].mean(), conf[m].mean()
        ece += m.mean() * abs(acc - cf)
        bins.append({"lo": float(lo), "hi": float(hi), "n": int(m.sum()), "acc": float(acc), "conf": float(cf)})
    return {"ece": float(ece), "bins": bins}


def multiclass_summary(probs: np.ndarray, y_true: np.ndarray, classes: list[str],
                       y_pred: np.ndarray | None = None) -> dict:
    y_pred = probs.argmax(1) if y_pred is None else y_pred
    rep = per_class_report(y_true, y_pred, classes)
    onehot = np.eye(len(classes))[y_true]
    present = onehot.sum(0) > 0
    auroc = {}
    try:
        auroc = {"macro_ovr": float(roc_auc_score(onehot[:, present], probs[:, present], average="macro")),
                 "weighted_ovr": float(roc_auc_score(onehot[:, present], probs[:, present], average="weighted")),
                 "micro": float(roc_auc_score(onehot[:, present], probs[:, present], average="micro"))}
    except ValueError:
        pass
    ap = {c: float(average_precision_score(onehot[:, i], probs[:, i])) for i, c in enumerate(classes) if present[i]}
    return {
        "n": int(len(y_true)),
        "accuracy": float((y_pred == y_true).mean()),
        "balanced_accuracy": float(np.mean([r["recall"] for r in rep if r["support"]])),
        "macro_recall": float(np.mean([r["recall"] for r in rep if r["support"]])),
        "macro_precision": float(np.mean([r["precision"] for r in rep if r["support"]])),
        "macro_f2": float(np.mean([r["f2"] for r in rep if r["support"]])),
        "auroc": auroc, "average_precision": ap,
        "map_ovr_macro": float(np.mean(list(ap.values()))) if ap else None,
        "confusion": confusion_matrix(y_true, y_pred, labels=list(range(len(classes)))).tolist(),
        "per_class": rep, "calibration": expected_calibration_error(probs, y_true),
    }


def alert_scores(probs: np.ndarray, healthy_idx: int) -> np.ndarray:
    return 1.0 - probs[:, healthy_idx]


def threshold_sweep(y_alert: np.ndarray, score: np.ndarray, thresholds=None) -> list[dict]:
    thresholds = np.round(np.linspace(0.01, 0.99, 99), 2) if thresholds is None else thresholds
    rows = []
    for t in thresholds:
        pred = score >= t
        tp = int((pred & (y_alert == 1)).sum()); fn = int((~pred & (y_alert == 1)).sum())
        fp = int((pred & (y_alert == 0)).sum()); tn = int((~pred & (y_alert == 0)).sum())
        p = tp / (tp + fp) if tp + fp else 1.0
        r = tp / (tp + fn) if tp + fn else 0.0
        rows.append({"threshold": float(t), "tp": tp, "fn": fn, "fp": fp, "tn": tn, "precision": p, "recall": r,
                     "f1": fbeta(p, r, 1), "f2": fbeta(p, r, 2),
                     "alerts_per_100_images": 100 * (tp + fp) / len(score)})
    return rows


def choose_threshold(sweep: list[dict], rule: str = "max_f2", min_recall: float | None = None,
                     tie_break: str = "lowest") -> dict:
    """Regla documentada: con `min_recall`, el umbral MÁS ALTO que alcanza ese recall
    (menos falsas alarmas); si no, el de mayor F2.

    Empates en F2: por defecto se elige el umbral MÁS BAJO (`tie_break="lowest"`), porque
    con costos asimétricos un umbral alto deja sin margen a positivos cercanos al límite.
    Lección de E4c_04 (registrada en decision_log D-034): con el desempate anterior
    ("highest") se eligió 0,89 y en test una imagen de moho gris con P(enfermedad)=0,873
    quedó sin alerta. E4c conserva su umbral original; el cambio aplica a experimentos nuevos."""
    if min_recall is not None:
        ok = [r for r in sweep if r["recall"] >= min_recall]
        if not ok:
            return {"rule": f"recall>={min_recall}", "feasible": False}
        best = max(ok, key=lambda r: r["threshold"])
        return {"rule": f"recall>={min_recall}", "feasible": True, **best}
    sign = -1 if tie_break == "lowest" else 1
    best = max(sweep, key=lambda r: (round(r["f2"], 6), sign * r["threshold"]))
    return {"rule": "max_f2", "tie_break": tie_break, "feasible": True, **best}


def alert_curves(y_alert: np.ndarray, score: np.ndarray) -> dict:
    fpr, tpr, roc_t = roc_curve(y_alert, score)
    prec, rec, pr_t = precision_recall_curve(y_alert, score)
    return {"auroc": float(roc_auc_score(y_alert, score)), "ap": float(average_precision_score(y_alert, score)),
            "roc": {"fpr": fpr.tolist(), "tpr": tpr.tolist()},
            "pr": {"precision": prec.tolist(), "recall": rec.tolist()}}


def predict_with_alert_threshold(probs: np.ndarray, healthy_idx: int, threshold: float) -> np.ndarray:
    """Regla de decisión: si P(enfermedad) >= umbral, se predice la enfermedad más probable;
    si no, 'sin síntomas'. Bajar el umbral reduce FN de alerta a costa de más alertas."""
    pred = probs.argmax(1).copy()
    disease = probs.copy()
    disease[:, healthy_idx] = -1
    alert = alert_scores(probs, healthy_idx) >= threshold
    pred[alert] = disease[alert].argmax(1)
    pred[~alert] = healthy_idx
    return pred
