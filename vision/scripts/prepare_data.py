"""Verifica y prepara las dos fuentes autorizadas (configs/data_sources.yaml).

Uso:
    python scripts/prepare_data.py verify  [--source ID] [--fast]   # estado: complete/missing/incomplete/modified
    python scripts/prepare_data.py prepare [--source ID] [--archive RUTA] [--no-keep-archive]
    python scripts/prepare_data.py lock     --source ID             # congela una fuente recién auditada
    python scripts/prepare_data.py splits   --source ID [--seed 0]  # partición por foto de origen (sin fugas)

Los datos se buscan en BERRYVISION_DATA_DIR (por defecto vision/data). Nunca se
descarga durante un build de Docker: es una operación explícita.
Códigos de salida: 0 todo íntegro · 1 problema de integridad · 3 falta credencial o datos.
"""

from __future__ import annotations

import argparse
import sys
from pathlib import Path

VISION_ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(VISION_ROOT / "src"))

from berryvision.datasources import (  # noqa: E402
    PreparationError, group_split_rows, load_sources, lock_path, prepare, read_lock, source_dir, tree_rows,
    validate_labels, verify_tree, write_lock,
)
from berryvision.storage import StorageError, data_dir  # noqa: E402


def cmd_verify(sources: dict, fast: bool) -> int:
    worst = 0
    for sid, cfg in sources.items():
        root = source_dir(cfg)
        lp = lock_path(cfg)
        st = verify_tree(root, read_lock(lp) if lp.exists() else None, full_hash=not fast)
        line = f"{sid:24s} {st.status:10s} archivos={st.n_files}"
        if st.status in ("incomplete", "modified"):
            line += f" faltan={len(st.missing)} cambiados={len(st.changed)} sobrantes={len(st.extra)}"
            worst = max(worst, 1)
        if st.status in ("complete", "unlocked"):
            lab = validate_labels(cfg, root)
            line += f" imágenes={lab['images']} cajas={lab['boxes']} problemas_etiqueta={len(lab['problems'])}"
            if lab["problems"]:
                worst = max(worst, 1)
        if st.status == "missing":
            line += f"  ← ausente en {root} ({cfg.get('status', '')})"
            worst = max(worst, 3)
        if st.status == "unlocked":
            line += "  ← sin bloqueo: no se puede comprobar si está completa"
            worst = max(worst, 1)
        print(line)
    return worst


def cmd_prepare(sources: dict, archive: Path | None, keep: bool) -> int:
    worst = 0
    for sid, cfg in sources.items():
        try:
            prepare(sid, cfg, archive=archive, keep_archive=keep)
        except PreparationError as exc:
            print(f"ERROR: {exc}")
            worst = max(worst, 3 if "ROBOFLOW_API_KEY" in str(exc) else 1)
    return worst


def cmd_lock(sid: str, cfg: dict) -> int:
    lp = lock_path(cfg)
    if lp.exists():
        print(f"{lp} ya existe; un bloqueo no se reescribe (cree una nueva versión de la fuente)")
        return 1
    root = source_dir(cfg)
    lab = validate_labels(cfg, root)
    if lab["problems"]:
        print(f"No se congela: {len(lab['problems'])} problemas de etiquetas, p. ej. {lab['problems'][:3]}")
        return 1
    rows = tree_rows(root)
    write_lock(rows, lp)
    print(f"{lp.relative_to(VISION_ROOT)}: {len(rows)} archivos, {lab['images']} imágenes, {lab['boxes']} cajas")
    return 0


def cmd_splits(sid: str, cfg: dict, seed: int) -> int:
    import csv
    from collections import Counter
    if "splits" not in cfg:
        print(f"{sid} no declara `splits` en data_sources.yaml")
        return 2
    out = VISION_ROOT / cfg["splits"]
    if out.exists():
        print(f"{out.relative_to(VISION_ROOT)} ya existe; no se sobrescribe (una partición usada no se cambia)")
        return 1
    rows = group_split_rows(cfg, source_dir(cfg), seed=seed)
    out.parent.mkdir(parents=True, exist_ok=True)
    with open(out, "w", newline="", encoding="utf-8") as fh:
        w = csv.DictWriter(fh, fieldnames=list(rows[0]), lineterminator="\n")
        w.writeheader()
        w.writerows(rows)
    author_splits: dict[str, set] = {}
    for r in rows:
        author_splits.setdefault(r["origin"], set()).add(r["author_split"])
    leaked = sum(len(s) > 1 for s in author_splits.values())
    photo_split = {r["origin"]: r["group_split"] for r in rows}
    print(f"{out.relative_to(VISION_ROOT)}: {len(rows)} imágenes, {len(photo_split)} fotos de origen; "
          f"en la partición del autor {leaked} fotos cruzaban particiones")
    print("imágenes por split:", dict(Counter(r["group_split"] for r in rows)),
          "· fotos por split:", dict(Counter(photo_split.values())))
    return 0


def main() -> int:
    if hasattr(sys.stdout, "reconfigure"):
        sys.stdout.reconfigure(encoding="utf-8")
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("command", choices=["verify", "prepare", "lock", "splits"])
    ap.add_argument("--source")
    ap.add_argument("--archive", type=Path, help="archivo ya descargado (se verifica igual)")
    ap.add_argument("--no-keep-archive", action="store_true")
    ap.add_argument("--fast", action="store_true", help="verify: compara tamaños, no hashes")
    ap.add_argument("--seed", type=int, default=0)
    a = ap.parse_args()
    try:
        data_dir(must_exist=True)
    except StorageError as exc:
        print(f"ERROR: {exc}")
        return 3
    sources = load_sources()
    if a.source:
        if a.source not in sources:
            print(f"Fuente no autorizada: {a.source}. Autorizadas: {', '.join(sources)}")
            return 2
        sources = {a.source: sources[a.source]}
    if a.command == "verify":
        return cmd_verify(sources, a.fast)
    if a.command == "prepare":
        return cmd_prepare(sources, a.archive, not a.no_keep_archive)
    if not a.source:
        print(f"{a.command} requiere --source")
        return 2
    if a.command == "splits":
        return cmd_splits(a.source, sources[a.source], a.seed)
    return cmd_lock(a.source, sources[a.source])


if __name__ == "__main__":
    raise SystemExit(main())
