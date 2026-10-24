"""Pruebas del manifiesto, la estratificación por grupos y el paquete de entrenamiento.

Se ejecutan en CPU con datos sintéticos; no requieren GPU ni datasets descargados.
"""

import numpy as np
import pytest
from PIL import Image

torch = pytest.importorskip("torch")

from berryvision.manifest import roboflow_base_id  # noqa: E402
from berryvision.splits import stratified_group_split  # noqa: E402
from berryvision.training.data import ManifestDataset, build_transforms, make_loader  # noqa: E402
from berryvision.training.engine import build_optimizer, build_scheduler, fit  # noqa: E402
from berryvision.training.losses import FocalLoss, build_loss, class_weights  # noqa: E402
from berryvision.training.metrics import (choose_threshold, expected_calibration_error,  # noqa: E402
                                          per_class_report, predict_with_alert_threshold, threshold_sweep,
                                          wilson_ci)
from berryvision.training.models import build_model, count_params, param_groups, set_bn_eval  # noqa: E402


# ---------------------------------------------------------------- manifiesto y particiones

@pytest.mark.parametrize("name,base", [
    ("aug_127_anthracnose_fruit_rot43_jpg.rf.1ca4ae705ad17dedc650c80de2393b3a.jpg", "anthracnose_fruit_rot43"),
    ("anthracnose_fruit_rot43_jpg.rf.9d56943ec2941253d6df35e2f823b1db.jpg", "anthracnose_fruit_rot43"),
    ("1009_jpg.rf.9d56943ec2941253d6df35e2f823b1db.jpg", "1009"),
    ("gray_mold_synthetic_wp9MndcCV6_jpg.rf.82247f24bbf75aa5f5542044d7c85a1e.jpg", "gray_mold_synthetic_wp9mndccv6"),
])
def test_roboflow_base_id(name, base):
    assert roboflow_base_id(name) == base


def _items():
    items = []
    for c in ("a", "b"):
        for g in range(40):
            items.append({"rel_path": f"{c}/{g}.jpg", "group_id": f"{c}{g}", "label": c, "is_augmented": False})
            items.append({"rel_path": f"{c}/aug_{g}.jpg", "group_id": f"{c}{g}", "label": c, "is_augmented": True})
    return items


def test_stratified_group_split_keeps_groups_and_excludes_eval_augmented():
    items = _items()
    sp = stratified_group_split(items, (0.7, 0.15, 0.15), seed=3)
    assert sp == stratified_group_split(items, (0.7, 0.15, 0.15), seed=3)
    by_group = {}
    for it in items:
        s = sp[it["rel_path"]]
        if it["is_augmented"]:
            assert s in ("train", "excluded")
            continue
        by_group.setdefault(it["group_id"], set()).add(s)
    assert all(len(v) == 1 for v in by_group.values())
    for c in ("a", "b"):          # cuota por clase: 15 % de 40 originales = 6
        assert sum(sp[f"{c}/{g}.jpg"] == "test" for g in range(40)) == 6
        assert sum(sp[f"{c}/{g}.jpg"] == "val" for g in range(40)) == 6
    aug_eval = [it for it in items if it["is_augmented"] and sp[it["rel_path"]] == "excluded"]
    assert len(aug_eval) == 24


# ---------------------------------------------------------------- métricas

def test_wilson_and_per_class_report():
    lo, hi = wilson_ci(9, 10)
    assert 0.55 < lo < 0.6 and 0.98 < hi <= 1.0
    y = np.array([0, 0, 1, 1, 1, 2])
    p = np.array([0, 1, 1, 1, 0, 2])
    rep = {r["class"]: r for r in per_class_report(y, p, ["sana", "e1", "e2"])}
    assert (rep["e1"]["tp"], rep["e1"]["fn"], rep["e1"]["fp"]) == (2, 1, 1)
    assert rep["sana"]["recall"] == 0.5 and rep["e2"]["precision"] == 1.0


def test_threshold_rules_and_alert_prediction():
    y = np.array([1, 1, 1, 0, 0, 0])
    s = np.array([0.9, 0.6, 0.2, 0.3, 0.1, 0.05])
    sw = threshold_sweep(y, s)
    hi_rec = choose_threshold(sw, min_recall=1.0)
    assert hi_rec["feasible"] and hi_rec["threshold"] <= 0.2 and hi_rec["fn"] == 0
    assert not choose_threshold(sw, min_recall=1.1)["feasible"]
    probs = np.array([[0.55, 0.45, 0.0], [0.9, 0.05, 0.05]])
    assert predict_with_alert_threshold(probs, 0, 0.5).tolist() == [0, 0]
    assert predict_with_alert_threshold(probs, 0, 0.4).tolist() == [1, 0]   # bajar el umbral recupera el FN


def test_ece_is_zero_for_perfectly_calibrated_bins():
    probs = np.array([[1.0, 0.0]] * 10)
    assert expected_calibration_error(probs, np.zeros(10, dtype=int))["ece"] == pytest.approx(0.0)


# ---------------------------------------------------------------- pérdidas

def test_class_weights_rule_and_focal_reduces_to_ce():
    w = class_weights({"a": 100, "b": 10, "c": 1}, ["a", "b", "c"], power=1.0, w_min=0.25, w_max=4.0)
    assert w[2] > w[1] > w[0]
    assert float(w.mean()) == pytest.approx(1.0)
    with pytest.raises(ValueError):
        class_weights({"a": 1}, ["a", "b"])
    logits = torch.randn(16, 3)
    y = torch.randint(0, 3, (16,))
    assert float(FocalLoss(gamma=0.0)(logits, y)) == pytest.approx(float(build_loss("ce")(logits, y)), rel=1e-5)
    assert float(FocalLoss(gamma=2.0)(logits, y)) < float(build_loss("ce")(logits, y))


# ---------------------------------------------------------------- modelos

def test_models_shapes_freezing_and_bn():
    x = torch.randn(2, 3, 64, 64)
    assert build_model("smallcnn", 4)(x).shape == (2, 4)
    m = build_model("resnet18", 5, pretrained=False, freeze_backbone=True, dropout=0.2)
    assert m(x).shape == (2, 5)
    total, trainable = count_params(m)
    assert trainable == 512 * 5 + 5 and total > trainable
    assert len(param_groups(m, 1e-3)) == 1          # solo la cabeza es entrenable
    m2 = build_model("resnet18", 5, pretrained=False)
    m2.train()
    set_bn_eval(m2)
    bns = [mod for mod in m2.modules() if isinstance(mod, torch.nn.BatchNorm2d)]
    assert all(not b.training for b in bns) and all(not p.requires_grad for b in bns for p in b.parameters())


# ---------------------------------------------------------------- datos y bucle de entrenamiento

def _toy_rows(root, n_per=8):
    rows = []
    for c, color in (("sana", (30, 160, 40)), ("enf", (150, 120, 60))):
        for i in range(n_per):
            p = root / f"{c}_{i}.png"
            Image.new("RGB", (80, 60), tuple(min(255, v + i * 3) for v in color)).save(p)
            rows.append({"rel_path": p.name, "canonical_label": c, "image_id": f"{c}{i}"})
    return rows


def test_dataset_letterbox_shapes_and_loader(tmp_path):
    rows = _toy_rows(tmp_path)
    ds = ManifestDataset(rows, ["sana", "enf"], tmp_path, build_transforms(64, train=True,
                                                                          aug={"rotation": 10, "jpeg_quality": [60, 95]}))
    x, y, i = ds[0]
    assert tuple(x.shape) == (3, 64, 64) and y == 0
    dl = make_loader(ds, batch_size=5, train=True, num_workers=0)
    assert sum(len(b[1]) for b in dl) == 15            # drop_last en train (16 -> 3 lotes de 5)
    dl_eval = make_loader(ds, batch_size=5, train=False, num_workers=0)
    assert sum(len(b[1]) for b in dl_eval) == 16       # evaluación completa, sin mezclar


def test_fit_runs_one_epoch_on_cpu(tmp_path):
    rows = _toy_rows(tmp_path)
    classes = ["sana", "enf"]
    tr = make_loader(ManifestDataset(rows, classes, tmp_path, build_transforms(32, True)), 4, True, 0)
    va = make_loader(ManifestDataset(rows, classes, tmp_path, build_transforms(32, False)), 4, False, 0)
    model = build_model("smallcnn", 2)
    opt = build_optimizer("adamw", param_groups(model, 1e-3), 1e-4)
    sched, mode = build_scheduler("cosine", opt, 2, len(tr))
    info = fit(model, tr, va, classes, 0, {"id": "t", "epochs": 2, "patience": 2, "amp": False}, torch.device("cpu"),
               tmp_path / "out", build_loss("ce"), opt, sched, mode, tmp_path / "ck" / "best.pt")
    assert (tmp_path / "out" / "history.csv").exists() and (tmp_path / "ck" / "best.pt").exists()
    assert 1 <= info["best_epoch"] <= 2


def test_disease_conditional_and_selection_rule():
    from berryvision.training.selection import disease_conditional, select
    probs = np.array([[0.1, 0.7, 0.2], [0.8, 0.1, 0.1], [0.6, 0.1, 0.3], [0.9, 0.05, 0.05]])
    labels = np.array([1, 2, 2, 0])
    dc = disease_conditional(probs, labels, ["sana", "e1", "e2"], 0)
    assert dc["n"] == 3 and dc["pred"] == [0, 0, 1]      # sin la clase sana, la 2ª imagen elige e1 (error)
    assert dc["macro_recall"] == pytest.approx(0.75) and dc["min_recall"] == 0.5
    a = {"id": "a", "disease_cond_macro_recall": 0.901, "disease_cond_min_recall": 0.7, "alert_fn": 3, "alerts_per_100": 80}
    b = {"id": "b", "disease_cond_macro_recall": 0.899, "disease_cond_min_recall": 0.8, "alert_fn": 5, "alerts_per_100": 70}
    assert select([a, b])["id"] == "b"                     # empate a 0.01 en macro -> gana el mejor peor-recall


def test_f2_ties_prefer_lowest_threshold_by_default():
    y = np.array([1, 1, 0, 0])
    s = np.array([0.95, 0.90, 0.10, 0.05])          # cualquier umbral en (0.10, 0.90] da F2 = 1
    sw = threshold_sweep(y, s)
    low = choose_threshold(sw)
    high = choose_threshold(sw, tie_break="highest")
    assert low["f2"] == high["f2"] == 1.0
    assert low["threshold"] < high["threshold"] and low["threshold"] <= 0.11
