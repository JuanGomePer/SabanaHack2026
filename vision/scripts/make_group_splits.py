"""Genera un manifiesto de particiones por grupo a partir de un informe de auditoría.

Uso:
    python scripts/make_group_splits.py reports/audits/<dataset>_images.csv \
        --out configs/splits/<dataset>_seed0.csv [--seed 0] [--ratios 0.7 0.15 0.15] \
        [--near-threshold 4] [--respect-original]

--respect-original conserva el split original del dataset (si existe) y solo
informa de los grupos que lo atraviesan (fugas), sin moverlos.
El manifiesto (ruta relativa, grupo, split) es pequeño y SÍ se versiona; las
imágenes no.
"""

from __future__ import annotations

import argparse
import csv
import sys
from collections import Counter
from pathlib import Path

VISION_ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(VISION_ROOT / "src"))

from berryvision.splits import assign_splits, build_groups, leakage  # noqa: E402


def main() -> int:
    if hasattr(sys.stdout, "reconfigure"):
        sys.stdout.reconfigure(encoding="utf-8")
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("images_csv", type=Path)
    ap.add_argument("--out", type=Path, required=True)
    ap.add_argument("--seed", type=int, default=0)
    ap.add_argument("--ratios", type=float, nargs=3, default=(0.7, 0.15, 0.15))
    ap.add_argument("--near-threshold", type=int, default=4)
    ap.add_argument("--respect-original", action="store_true")
    args = ap.parse_args()

    with open(args.images_csv, newline="", encoding="utf-8") as fh:
        records = [{k: (v or None) for k, v in r.items()} for r in csv.DictReader(fh)]
    groups = build_groups(records, near_threshold=args.near_threshold)
    if args.respect_original:
        split_of = {r["rel_path"]: r.get("split") or "sin_split" for r in records if r["rel_path"] in groups}
    else:
        split_of = assign_splits(groups, tuple(args.ratios), seed=args.seed)
    leaks = leakage(split_of, groups)

    args.out.parent.mkdir(parents=True, exist_ok=True)
    with open(args.out, "w", newline="", encoding="utf-8") as fh:
        w = csv.writer(fh)
        w.writerow(["rel_path", "group_id", "split"])
        for path in sorted(groups):
            w.writerow([path, groups[path], split_of[path]])
    n_groups = len(set(groups.values()))
    print(f"{len(groups)} imágenes en {n_groups} grupos → {dict(Counter(split_of.values()))}")
    print(f"grupos que atraviesan splits: {len(leaks)}" + (" (FUGA)" if leaks else ""))
    print(f"manifiesto: {args.out}")
    return 1 if leaks and not args.respect_original else 0


if __name__ == "__main__":
    raise SystemExit(main())
