"""Particiones por grupo para evitar fugas entre train, val y test.

Las imágenes idénticas (SHA-256) o casi idénticas (dHash a distancia <= umbral)
se agrupan con union-find y cada grupo completo cae en un único split. Un
`group_key` opcional (planta, sesión, fuente) une además imágenes que comparten
origen aunque no se parezcan. La asignación es determinista: depende de la
semilla y del hash del identificador del grupo, no del orden de los archivos.
"""

from __future__ import annotations

import hashlib
from collections import defaultdict
from typing import Callable


class _UnionFind:
    def __init__(self, items):
        self.parent = {i: i for i in items}

    def find(self, x):
        while self.parent[x] != x:
            self.parent[x] = self.parent[self.parent[x]]
            x = self.parent[x]
        return x

    def union(self, a, b):
        ra, rb = self.find(a), self.find(b)
        if ra != rb:
            self.parent[max(ra, rb)] = min(ra, rb)


def build_groups(records: list[dict], near_threshold: int = 4,
                 group_key: Callable[[dict], str | None] | None = None) -> dict[str, str]:
    """Devuelve {rel_path: group_id}. `records` sigue el esquema de ImageRecord (dicts)."""
    paths = [r["rel_path"] for r in records if not r.get("error")]
    uf = _UnionFind(paths)
    by_sha = defaultdict(list)
    for r in records:
        if not r.get("error") and r.get("sha256"):
            by_sha[r["sha256"]].append(r["rel_path"])
    for group in by_sha.values():
        for p in group[1:]:
            uf.union(group[0], p)
    hashed = [(r["rel_path"], int(r["dhash"], 16)) for r in records if not r.get("error") and r.get("dhash")]
    if near_threshold >= 0:
        for i in range(len(hashed)):
            for j in range(i + 1, len(hashed)):
                if (hashed[i][1] ^ hashed[j][1]).bit_count() <= near_threshold:
                    uf.union(hashed[i][0], hashed[j][0])
    if group_key is not None:
        first_by_key = {}
        for r in records:
            if r.get("error"):
                continue
            k = group_key(r)
            if k is None:
                continue
            if k in first_by_key:
                uf.union(first_by_key[k], r["rel_path"])
            else:
                first_by_key[k] = r["rel_path"]
    return {p: uf.find(p) for p in paths}


def assign_splits(groups: dict[str, str], ratios=(0.7, 0.15, 0.15), seed: int = 0,
                  names=("train", "val", "test")) -> dict[str, str]:
    """Asigna cada grupo completo a un split según un hash estable (seed, group_id)."""
    if abs(sum(ratios) - 1.0) > 1e-6 or len(ratios) != len(names):
        raise ValueError("ratios debe sumar 1 y tener la misma longitud que names")
    cuts = [sum(ratios[: i + 1]) for i in range(len(ratios))]
    out = {}
    for path, gid in groups.items():
        h = int(hashlib.sha256(f"{seed}:{gid}".encode()).hexdigest()[:12], 16) / 16**12
        out[path] = next(n for n, c in zip(names, cuts) if h < c or c == cuts[-1])
    return out


def leakage(split_of: dict[str, str], groups: dict[str, str]) -> list[str]:
    """Grupos repartidos en más de un split (debe ser vacío)."""
    seen = defaultdict(set)
    for path, gid in groups.items():
        seen[gid].add(split_of[path])
    return [g for g, s in seen.items() if len(s) > 1]


def stratified_group_split(items: list[dict], ratios=(0.7, 0.15, 0.15), seed: int = 0) -> dict[str, str]:
    """Partición estratificada por clase y agrupada.

    `items`: dicts con `rel_path`, `group_id`, `label` e `is_augmented`.
    - Cada grupo completo cae en un único split; la clase del grupo es la mayoritaria
      entre sus imágenes originales (no aumentadas).
    - Dentro de cada clase, los grupos se ordenan con un hash estable (seed, group_id)
      y se asignan a val/test hasta alcanzar la cuota de imágenes ORIGINALES; el resto va a train.
    - Las imágenes aumentadas solo pueden ir a train. Si su grupo cae en val/test se
      marcan como 'excluded' (evita evaluar con variantes del mismo original).
    """
    if abs(sum(ratios) - 1.0) > 1e-6:
        raise ValueError("ratios debe sumar 1")
    by_group: dict[str, list[dict]] = defaultdict(list)
    for it in items:
        by_group[it["group_id"]].append(it)
    group_label, group_n = {}, {}
    for gid, members in by_group.items():
        originals = [m for m in members if not m["is_augmented"]] or members
        counts = defaultdict(int)
        for m in originals:
            counts[m["label"]] += 1
        # desempate determinista (no depende del orden de un set)
        group_label[gid] = sorted(counts.items(), key=lambda kv: (-kv[1], kv[0]))[0][0]
        group_n[gid] = sum(not m["is_augmented"] for m in members)
    split_of_group = {}
    for label in sorted(set(group_label.values())):
        gids = sorted((g for g, l in group_label.items() if l == label),
                      key=lambda g: hashlib.sha256(f"{seed}:{g}".encode()).hexdigest())
        total = sum(group_n[g] for g in gids)
        quota = {"val": round(total * ratios[1]), "test": round(total * ratios[2])}
        filled = {"val": 0, "test": 0}
        for g in gids:
            if group_n[g] == 0:          # grupo solo con aumentadas: no sirve para evaluar
                split_of_group[g] = "train"
                continue
            target = next((s for s in ("test", "val") if filled[s] < quota[s]), "train")
            split_of_group[g] = target
            if target != "train":
                filled[target] += group_n[g]
    out = {}
    for gid, members in by_group.items():
        s = split_of_group[gid]
        for m in members:
            out[m["rel_path"]] = "excluded" if (m["is_augmented"] and s != "train") else s
    return out
