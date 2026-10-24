"""Construye el manifiesto unificado v1 y sus particiones por grupos.

Uso: python scripts/build_manifest.py [--seed 0] [--near-threshold 4]

Salidas:
  data/processed/manifest_v1.csv          manifiesto completo con anotaciones (no versionado, regenerable)
  manifests/manifest_v1_splits.csv        vista ligera versionable (identidad, etiqueta, grupo, partición)
  manifests/manifest_v1.meta.json         hashes, conteos, comprobaciones de fuga y decisiones

Las fuentes ausentes (p. ej. DrBerry sin ROBOFLOW_API_KEY) se registran como pendientes.
"""

from __future__ import annotations

import argparse
import json
import sys
from collections import Counter, defaultdict
from datetime import datetime, timezone
from pathlib import Path

VISION_ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(VISION_ROOT / "src"))

from berryvision.manifest import (MANIFEST_VERSION, rows_plantdoc, rows_plantvillage,  # noqa: E402
                                  rows_strawberry, write_manifest_csv)
from berryvision.splits import assign_splits, build_groups, leakage, stratified_group_split  # noqa: E402


def _group_rows(rows, near_threshold, use_base_id):
    recs = [{"rel_path": r.rel_path, "sha256": r.sha256, "dhash": r.dhash, "error": None if r.sha256 else "x"}
            for r in rows]
    base = {r.rel_path: r.base_id for r in rows}
    groups = build_groups(recs, near_threshold=near_threshold,
                          group_key=(lambda rec: base[rec["rel_path"]]) if use_base_id else None)
    for r in rows:
        r.group_id = f"{r.source_id}:{groups.get(r.rel_path, r.rel_path)}"
    return groups


def main() -> int:
    if hasattr(sys.stdout, "reconfigure"):
        sys.stdout.reconfigure(encoding="utf-8")
    ap = argparse.ArgumentParser()
    ap.add_argument("--seed", type=int, default=0)
    ap.add_argument("--near-threshold", type=int, default=4)
    args = ap.parse_args()

    meta = {"manifest_version": MANIFEST_VERSION, "seed": args.seed,
            "built_at": datetime.now(timezone.utc).isoformat(timespec="seconds"),
            "sources": {}, "pending_sources": {}, "checks": {}}
    all_rows = []

    # --- PlantVillage (control de dominio; fondo uniforme -> umbral dHash 0, ver D-026)
    pv = rows_plantvillage(VISION_ROOT)
    g = _group_rows(pv, near_threshold=0, use_base_id=False)
    sp = assign_splits({r.rel_path: r.group_id for r in pv}, seed=args.seed)
    for r in pv:
        r.split = sp[r.rel_path]
    all_rows += pv

    # --- PlantDoc arándano (auxiliar, requiere revisión manual)
    pd_ = rows_plantdoc(VISION_ROOT)
    _group_rows(pd_, near_threshold=args.near_threshold, use_base_id=False)
    sp = assign_splits({r.rel_path: r.group_id for r in pd_}, seed=args.seed)
    for r in pd_:
        r.split = sp[r.rel_path]
    all_rows += pd_

    # --- Fresa (variante traditional, sin sintéticas) + metadatos de sintéticas
    sw = rows_strawberry(VISION_ROOT)
    usable = [r for r in sw if r.source_id == "strawberry_traditional" and not r.exclusion_reason]
    _group_rows(usable, near_threshold=args.near_threshold, use_base_id=True)
    # Fuga en el split ORIGINAL del autor: grupos repartidos entre train/valid/test
    orig = defaultdict(set)
    for r in usable:
        orig[r.group_id].add(r.original_split)
    meta["checks"]["strawberry_original_split_groups_crossing"] = sum(len(s) > 1 for s in orig.values())
    meta["checks"]["strawberry_original_eval_augmented"] = sum(
        r.is_augmented and r.original_split != "train" for r in usable)
    items = [{"rel_path": r.rel_path, "group_id": r.group_id, "label": r.canonical_label,
              "is_augmented": r.is_augmented} for r in usable]
    sp = stratified_group_split(items, ratios=(0.7, 0.15, 0.15), seed=args.seed)
    for r in usable:
        r.split = sp[r.rel_path]
        if r.split == "excluded":
            r.exclusion_reason = "aumentada de una imagen original asignada a val/test"
    usable_ids = {id(r) for r in usable}
    for r in sw:
        if id(r) not in usable_ids:
            r.split = "excluded"
    all_rows += sw

    # --- comprobaciones
    for src in sorted({r.source_id for r in all_rows}):
        rs = [r for r in all_rows if r.source_id == src]
        groups = {r.rel_path: r.group_id for r in rs if r.split in ("train", "val", "test")}
        splits = {r.rel_path: r.split for r in rs if r.split in ("train", "val", "test")}
        meta["sources"][src] = {
            "n_rows": len(rs), "splits": dict(Counter(r.split for r in rs)),
            "n_groups": len(set(groups.values())), "groups_crossing_splits": len(leakage(splits, groups)),
            "labels_by_split": {s: dict(sorted(Counter(r.canonical_label for r in rs if r.split == s).items()))
                                for s in ("train", "val", "test")},
            "augmented_in_val_test": sum(r.is_augmented and r.split in ("val", "test") for r in rs),
            "synthetic_rows": sum(r.is_synthetic for r in rs),
            "exclusions": dict(Counter(r.exclusion_reason.split(":")[0] for r in rs if r.exclusion_reason)),
        }
    sizes = Counter(r.group_id for r in usable)
    meta["checks"]["strawberry_largest_groups"] = sizes.most_common(5)
    sources_by_sha = defaultdict(set)
    for r in all_rows:
        if r.sha256:
            sources_by_sha[r.sha256].add(r.source_id)
    meta["checks"]["cross_source_exact_duplicates"] = sum(len(v) > 1 for v in sources_by_sha.values())
    meta["pending_sources"]["drberry"] = "bloqueado: ROBOFLOW_API_KEY no definida (D-020)"
    meta["pending_sources"]["afzaal_original"] = "Dropbox deshabilitado; sus bases están dentro de strawberry_hybrid"

    # Manifiesto completo (con anotaciones) -> data/processed (ignorado; se regenera con este script)
    out = VISION_ROOT / "data" / "processed" / "manifest_v1.csv"
    digest = write_manifest_csv(all_rows, out)
    meta["manifest_sha256"] = digest
    meta["manifest_full_path"] = "data/processed/manifest_v1.csv (no versionado)"
    # Vista ligera versionable: identidad, etiqueta, grupo y partición
    slim = VISION_ROOT / "manifests" / "manifest_v1_splits.csv"
    import csv as _csv
    cols = ["image_id", "source_id", "rel_path", "sha256", "canonical_label", "original_split", "group_id",
            "split", "is_augmented", "is_synthetic", "review_status", "exclusion_reason"]
    with open(slim, "w", newline="", encoding="utf-8") as fh:
        w = _csv.writer(fh)
        w.writerow(cols)
        for r in all_rows:
            w.writerow([getattr(r, c) for c in cols])
    from berryvision.audit import sha256_file
    meta["manifest_splits_sha256"] = sha256_file(slim)
    (VISION_ROOT / "manifests" / "manifest_v1.meta.json").write_text(
        json.dumps(meta, indent=2, ensure_ascii=False), encoding="utf-8")
    print(json.dumps({k: v for k, v in meta.items() if k != "sources"}, indent=1, ensure_ascii=False)[:2500])
    for src, s in meta["sources"].items():
        print(src, s["splits"], "grupos:", s["n_groups"], "cruzan:", s["groups_crossing_splits"],
              "aug en val/test:", s["augmented_in_val_test"])
    print("manifiesto:", out, "sha256:", digest[:16])
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
