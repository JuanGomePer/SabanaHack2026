"""Genera reports/metrics_per_class.md a partir de los artefactos del experimento seleccionado.

Uso: python scripts/report_metrics.py   (lee reports/experiments/selection.json)
Los números salen de val_metrics.json / test_metrics.json / *_predictions.npz; no se escriben a mano.
"""

from __future__ import annotations

import json
import sys
from pathlib import Path

VISION_ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(VISION_ROOT / "src"))

import numpy as np  # noqa: E402

from berryvision.training.selection import disease_conditional  # noqa: E402

EXP = VISION_ROOT / "reports" / "experiments"


def table(per_class: list[dict]) -> list[str]:
    out = ["| Clase | Soporte | TP | FN | FP | Recall | IC 95 % (Wilson) | Precisión | Especificidad | F1 | F2 |",
           "|---|---|---|---|---|---|---|---|---|---|---|"]
    for r in per_class:
        lo, hi = r["recall_ci95"]
        out.append(f"| {r['class']} | {r['support']} | {r['tp']} | {r['fn']} | {r['fp']} | {r['recall']:.3f} | "
                   f"[{lo:.2f}, {hi:.2f}] | {r['precision']:.3f} | {r['specificity']:.3f} | {r['f1']:.3f} | {r['f2']:.3f} |")
    return out


def cond_table(dc: dict) -> list[str]:
    out = ["| Enfermedad | Soporte | Aciertos | FN (otra enfermedad) | Recall | IC 95 % |", "|---|---|---|---|---|---|"]
    for r in dc["per_class"]:
        lo, hi = r["recall_ci95"]
        out.append(f"| {r['class']} | {r['support']} | {r['tp']} | {r['fn']} | {r['recall']:.3f} | [{lo:.2f}, {hi:.2f}] |")
    return out


def main() -> int:
    sel = json.loads((EXP / "selection.json").read_text(encoding="utf-8"))["selected"]
    d = EXP / sel
    info = json.loads((d / "run_info.json").read_text(encoding="utf-8"))
    L = [f"# Métricas por clase — {sel} (experimento auxiliar en FRESA)", "",
         "> Generado por `scripts/report_metrics.py` a partir de los artefactos. **No son métricas de arándano ni del robot.**",
         f"> Código `{info['code_tree_sha256'][:16]}` · manifiesto `{info['manifest_sha256'][:16]}` · "
         f"config `{info['config_path']}` · semilla {info['config']['seed']} · mejor época {info['fit']['best_epoch']}.", ""]
    for split in ("val", "test"):
        mpath = d / f"{split}_metrics.json"
        if not mpath.exists():
            L += [f"## {split}: no evaluado", ""]
            continue
        m = json.loads(mpath.read_text(encoding="utf-8"))
        npz = np.load(d / f"{split}_predictions.npz")
        classes = m["classes"]
        hi = classes.index(m.get("healthy_class", "strawberry_asymptomatic"))
        a = m["argmax"]
        L += [f"## {split.upper()} — {a['n']} imágenes originales", "",
              f"Exactitud {a['accuracy']:.3f} · exactitud balanceada (= recall macro) {a['balanced_accuracy']:.3f} · "
              f"AUROC OvR macro {a['auroc'].get('macro_ovr', float('nan')):.4f} / weighted {a['auroc'].get('weighted_ovr', float('nan')):.4f} / micro {a['auroc'].get('micro', float('nan')):.4f} · "
              f"mAP OvR macro {a['map_ovr_macro']:.4f} · ECE {a['calibration']['ece']:.4f}", "",
              "### 8 clases (argmax)", ""] + table(a["per_class"]) + [""]
        dc = disease_conditional(npz["probs"], npz["labels"], classes, hi)
        L += ["### Condicionado a enfermedad (análisis principal; sin la clase confundida con la fuente)", "",
              f"Recall macro {dc['macro_recall']:.3f} · peor clase {dc['min_recall']:.3f}", ""] + cond_table(dc) + [""]
        if split == "test":
            al = m["alert_at_frozen_threshold"]
            L += [f"### Alerta binaria al umbral congelado {m['frozen_threshold']:.2f} (confundida con la fuente)", "",
                  f"Recall {al['recall']:.3f} · precisión {al['precision']:.3f} · FN {al['fn']} · FP {al['fp']} · "
                  f"alertas por 100 imágenes {al['alerts_per_100_images']:.1f}", ""]
    ood = d / "ood_blueberry_check.json"
    if ood.exists():
        o = json.loads(ood.read_text(encoding="utf-8"))
        L += ["## Fuera de dominio (hojas de arándano; ninguna pertenece a las clases del modelo)", "",
              "| Fuente | n | Confianza media | % con confianza ≥ 0,9 | % que dispara alerta | Clases predichas |", "|---|---|---|---|---|---|"]
        for k, v in o.items():
            L.append(f"| {k} | {v['n']} | {v['mean_max_prob']:.3f} | {100 * v['frac_max_prob_ge_0.9']:.1f} | "
                     f"{100 * v['frac_alert_at_threshold']:.1f} | {v['predicted_class_counts']} |")
    (VISION_ROOT / "reports" / "metrics_per_class.md").write_text("\n".join(L) + "\n", encoding="utf-8")
    print("escrito reports/metrics_per_class.md")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
