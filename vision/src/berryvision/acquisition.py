"""Utilidades de adquisición reproducible de datasets.

Cada descarga deja en `data/external/<id>/ACQUISITION.json` la URL, la fecha,
la licencia declarada, la revisión de origen y los hashes, para que otro
integrante pueda reconstruirla. Los archivos descargados se tratan como datos
no confiables: se extraen en su propio directorio, sin rutas absolutas ni
saltos fuera de él, y nunca se ejecuta nada de su interior.
"""

from __future__ import annotations

import hashlib
import json
import tarfile
import urllib.request
import zipfile
from datetime import datetime, timezone
from pathlib import Path

USER_AGENT = "berryvision-acquisition/0.2 (+SabanaHack2026 research)"
_WINDOWS_BAD = r'<>:"/\|?*'


class DownloadError(RuntimeError):
    """La descarga no devolvió el contenido esperado (p. ej. una página HTML de error)."""


def local_name(original: str, index: int) -> str:
    """Nombre local único y válido en Windows; el original se conserva en el manifiesto.

    El prefijo numérico evita colisiones en sistemas de archivos que no distinguen
    mayúsculas (p. ej. 'blueberry-leaf.jpg' frente a 'Blueberry-leaf.jpg').
    """
    clean = "".join("_" if c in _WINDOWS_BAD or ord(c) < 32 else c for c in original).strip(" .")
    return f"{index:05d}__{clean or 'file'}"


def sha256_path(path: Path, chunk: int = 1 << 20) -> str:
    h = hashlib.sha256()
    with open(path, "rb") as fh:
        for block in iter(lambda: fh.read(chunk), b""):
            h.update(block)
    return h.hexdigest()


def md5_path(path: Path, chunk: int = 1 << 20) -> str:
    h = hashlib.md5()
    with open(path, "rb") as fh:
        for block in iter(lambda: fh.read(chunk), b""):
            h.update(block)
    return h.hexdigest()


def _download_once(url: str, tmp: Path, timeout: int, expect_binary: bool) -> int:
    req = urllib.request.Request(url, headers={"User-Agent": USER_AGENT})
    with urllib.request.urlopen(req, timeout=timeout) as resp, open(tmp, "wb") as fh:
        ctype = resp.headers.get("Content-Type", "")
        if expect_binary and ctype.startswith("text/html"):
            raise DownloadError(f"Se esperaba un archivo y el servidor devolvió HTML ({url})")
        declared = resp.headers.get("Content-Length")
        n = 0
        while True:
            block = resp.read(1 << 20)
            if not block:
                break
            fh.write(block)
            n += len(block)
    if declared is not None and int(declared) != n:
        raise DownloadError(f"Descarga truncada: {n} de {declared} bytes ({url})")
    if n == 0:
        raise DownloadError(f"Respuesta vacía ({url})")
    return n


def download(url: str, dest: Path, timeout: int = 120, expect_binary: bool = True,
             expected_size: int | None = None, expected_md5: str | None = None, retries: int = 3) -> Path:
    """Descarga con verificación: Content-Length, tamaño y MD5 esperados (si se conocen) y reintentos."""
    dest.parent.mkdir(parents=True, exist_ok=True)
    tmp = dest.with_suffix(dest.suffix + ".part")
    last: Exception | None = None
    for _ in range(max(1, retries)):
        try:
            n = _download_once(url, tmp, timeout, expect_binary)
            if expected_size is not None and n != expected_size:
                raise DownloadError(f"Tamaño {n} distinto del esperado {expected_size} ({url})")
            if expected_md5 is not None and md5_path(tmp) != expected_md5:
                raise DownloadError(f"MD5 distinto del publicado ({url})")
            tmp.replace(dest)
            return dest
        except DownloadError as exc:
            last = exc
            tmp.unlink(missing_ok=True)
            if "HTML" in str(exc):
                break               # un enlace caído no se arregla reintentando
        except BaseException:
            tmp.unlink(missing_ok=True)
            raise
    raise last


def _is_within(base: Path, target: Path) -> bool:
    base, target = base.resolve(), target.resolve()
    return target == base or base in target.parents


def safe_extract(archive: Path, dest: Path) -> int:
    """Extrae tar/zip rechazando rutas absolutas, '..' y enlaces simbólicos o duros."""
    dest.mkdir(parents=True, exist_ok=True)
    n = 0
    if tarfile.is_tarfile(archive):
        with tarfile.open(archive) as tf:
            for m in tf.getmembers():
                if m.issym() or m.islnk() or m.isdev():
                    raise ValueError(f"Miembro no permitido en el archivo: {m.name}")
                if not _is_within(dest, dest / m.name):
                    raise ValueError(f"Ruta fuera del destino: {m.name}")
            for m in tf.getmembers():
                tf.extract(m, dest)
                n += m.isfile()
    elif zipfile.is_zipfile(archive):
        with zipfile.ZipFile(archive) as zf:
            for name in zf.namelist():
                if not _is_within(dest, dest / name):
                    raise ValueError(f"Ruta fuera del destino: {name}")
            zf.extractall(dest)
            n = sum(1 for i in zf.infolist() if not i.is_dir())
    elif archive.suffix.lower() == ".7z":
        import py7zr  # dependencia opcional (extra `acquire`)
        with py7zr.SevenZipFile(archive, "r") as z:
            infos = z.list()
            for info in infos:
                if getattr(info, "is_symlink", False):
                    raise ValueError(f"Enlace no permitido en el archivo: {info.filename}")
                if not _is_within(dest, dest / info.filename):
                    raise ValueError(f"Ruta fuera del destino: {info.filename}")
            z.extractall(path=dest)
            n = sum(1 for i in infos if not i.is_directory)
    else:
        raise ValueError(f"Formato de archivo no reconocido: {archive}")
    return n


def write_manifest(dest_dir: Path, **fields) -> Path:
    """Escribe ACQUISITION.json. Nunca incluye credenciales."""
    forbidden = {k for k in fields if "key" in k.lower() or "token" in k.lower() or "secret" in k.lower()}
    if forbidden:
        raise ValueError(f"El manifiesto no puede contener credenciales: {sorted(forbidden)}")
    data = {"acquired_at": datetime.now(timezone.utc).isoformat(timespec="seconds"), **fields}
    dest_dir.mkdir(parents=True, exist_ok=True)
    path = dest_dir / "ACQUISITION.json"
    path.write_text(json.dumps(data, indent=2, ensure_ascii=False), encoding="utf-8")
    return path
