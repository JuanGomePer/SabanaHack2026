"""CLI de auditoría de datasets locales (solo lectura).

Ejemplos:
    python scripts/audit_local_datasets.py --root data/external/drberry_original
    python scripts/audit_local_datasets.py --config configs/audit_targets.yaml
    python scripts/audit_local_datasets.py --root D:/datasets/afzaal --no-hash --max-images 500

Los informes se escriben en reports/audits/ (ignorado por Git). El script se
niega a escribir dentro del directorio auditado para no tocar los originales.
"""

from __future__ import annotations

import argparse
import sys
from pathlib import Path

VISION_ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(VISION_ROOT / "src"))

import json  # noqa: E402

from berryvision.audit import audit_directory, cross_dataset_duplicates, draw_samples, write_reports  # noqa: E402


def _targets_from_config(path: Path) -> list[tuple[str, Path]]:
    import yaml

    data = yaml.safe_load(path.read_text(encoding="utf-8")) or {}
    targets = []
    for item in data.get("targets", []):
        p = Path(item["path"])
        if not p.is_absolute():
            p = (VISION_ROOT / p).resolve()
        targets.append((item["name"], p))
    return targets


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--root", action="append", default=[], help="Directorio a auditar (repetible)")
    parser.add_argument("--config", type=Path, help="YAML con una lista 'targets' de {name, path}")
    parser.add_argument("--out", type=Path, default=VISION_ROOT / "reports" / "audits")
    parser.add_argument("--no-hash", action="store_true", help="Omite SHA-256 (más rápido, sin duplicados)")
    parser.add_argument("--max-images", type=int, default=None)
    parser.add_argument("--near-dup-threshold", type=int, default=4, help="Hamming máximo de dHash (0-64)")
    parser.add_argument("--samples", type=int, default=0,
                        help="Dibuja cajas en N imágenes por formato (solo revisión local, en --out/<name>_samples)")
    args = parser.parse_args(argv)
    if hasattr(sys.stdout, "reconfigure"):
        sys.stdout.reconfigure(encoding="utf-8")  # la consola de Windows usa cp1252 por defecto

    targets = [(Path(r).name, Path(r).resolve()) for r in args.root]
    if args.config:
        targets += _targets_from_config(args.config)
    if not targets:
        parser.error("Indique --root o --config")

    out = args.out.resolve()
    exit_code = 0
    audited: dict[str, list[dict]] = {}
    for name, root in targets:
        if not root.is_dir():
            print(f"[omitido] {name}: {root} no existe")
            exit_code = 1
            continue
        if out == root or root in out.parents:
            print(f"[omitido] {name}: la salida {out} está dentro del dataset; use otro --out")
            exit_code = 1
            continue
        report = audit_directory(root, compute_hash=not args.no_hash, max_images=args.max_images,
                                 near_dup_threshold=args.near_dup_threshold)
        json_path, csv_path = write_reports(report, out, name)
        audited[name] = report["_records"]
        if args.samples:
            saved = draw_samples(report, out / f"{name}_samples", n=args.samples)
            print(f"   muestras visuales: {len(saved)} en {out / (name + '_samples')}")
        print(f"== {name}")
        print(f"   imágenes: {report['n_images']} (legibles {report['n_readable_images']}, "
              f"ilegibles {len(report['unreadable'])}, duplicados exactos {report['n_duplicate_files']}, "
              f"pares casi-duplicados {report['n_near_duplicate_pairs']})")
        print(f"   splits: {report['images_per_split']}; resoluciones distintas: {report['n_distinct_resolutions']} "
              f"(top {report['resolutions_top'][:3]})")
        if report["cross_split_exact_duplicates"] or report["n_cross_split_near_duplicates"]:
            print(f"   FUGA ENTRE SPLITS: {len(report['cross_split_exact_duplicates'])} exactas, "
                  f"{report['n_cross_split_near_duplicates']} casi-duplicadas")
        print(f"   formatos de anotación: {report['annotation_formats_detected'] or 'ninguno detectado'}")
        for ann in report["annotations"]:
            print(f"   - {ann['format']}: {ann['n_instances']} instancias, clases {ann['class_counts']}")
            print(f"     imágenes por clase: {ann['class_image_counts']}")
            for cls, st in ann["box_stats"].items():
                print(f"     cajas '{cls}': área relativa mediana {st['rel_area_median']}, "
                      f"{st['frac_boxes_ge_50pct_image']:.0%} ocupan >=50% de la imagen")
            print(f"     imágenes sin anotación: {ann['images_without_annotation']}, "
                  f"anotaciones sin imagen: {ann['annotations_without_image']}")
        if report["errors"]:
            print(f"   errores: {report['errors']}")
        print(f"   informe: {json_path}\n   detalle: {csv_path}")
    names = list(audited)
    for i in range(len(names)):
        for j in range(i + 1, len(names)):
            pairs = cross_dataset_duplicates(audited[names[i]], audited[names[j]], args.near_dup_threshold)
            path = out / f"cross__{names[i]}__{names[j]}.json"
            path.write_text(json.dumps(pairs, indent=2, ensure_ascii=False), encoding="utf-8")
            print(f"== {names[i]} vs {names[j]}: {len(pairs)} coincidencias (exactas {sum(p['exact'] for p in pairs)}) → {path.name}")
    return exit_code


if __name__ == "__main__":
    raise SystemExit(main())
