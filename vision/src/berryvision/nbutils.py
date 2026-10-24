"""Utilidades para los notebooks: rutas relativas, paneles locales y estadísticas de dominio.

Los paneles con imágenes de datasets de terceros se guardan en reports/figures_local/
(ignorado por Git) y NO se muestran en las salidas guardadas del notebook, salvo que
quien lo ejecute active SHOW_PANELS localmente.
"""

from __future__ import annotations

import json
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw, ImageFilter, ImageStat


def find_vision_root(start: Path | None = None) -> Path:
    p = (start or Path.cwd()).resolve()
    for cand in [p, *p.parents]:
        if (cand / "pyproject.toml").exists() and (cand / "src" / "berryvision").is_dir():
            return cand
    raise FileNotFoundError("No se encontró vision/ (pyproject.toml + src/berryvision)")


def image_stats(path: Path, max_side: int = 256) -> dict:
    """Brillo, saturación aproximada, nitidez (varianza del Laplaciano aproximada) y medias RGB."""
    with Image.open(path) as im:
        im = im.convert("RGB")
        im.thumbnail((max_side, max_side))
        st = ImageStat.Stat(im)
        hsv = ImageStat.Stat(im.convert("HSV"))
        edges = np.asarray(im.convert("L").filter(ImageFilter.FIND_EDGES), dtype=np.float32)
    return {"mean_r": st.mean[0], "mean_g": st.mean[1], "mean_b": st.mean[2],
            "brightness": hsv.mean[2], "saturation": hsv.mean[1], "sharpness": float(edges.var())}


def save_panel(items: list[dict], vision_root: Path, out_path: Path, cols: int = 6, thumb: int = 220,
               draw_boxes: bool = True) -> Path:
    """items: dicts con rel_path, title y, opcionalmente, boxes (xyxy normalizadas)."""
    if not items:
        return out_path
    rows = (len(items) + cols - 1) // cols
    canvas = Image.new("RGB", (cols * thumb, rows * (thumb + 28)), "white")
    d = ImageDraw.Draw(canvas)
    for k, it in enumerate(items):
        with Image.open(vision_root / it["rel_path"]) as im:
            im = im.convert("RGB")
            if draw_boxes and it.get("boxes"):
                dr = ImageDraw.Draw(im)
                w, h = im.size
                for x1, y1, x2, y2 in it["boxes"]:
                    dr.rectangle([x1 * w, y1 * h, x2 * w, y2 * h], outline=(255, 0, 80), width=max(2, w // 200))
            im.thumbnail((thumb, thumb))
        x, y = (k % cols) * thumb, (k // cols) * (thumb + 28)
        canvas.paste(im, (x + (thumb - im.width) // 2, y))
        d.text((x + 3, y + thumb + 2), str(it.get("title", ""))[:34], fill=(0, 0, 0))
    out_path.parent.mkdir(parents=True, exist_ok=True)
    canvas.save(out_path, quality=85)
    return out_path


def boxes_of(row: dict) -> list:
    try:
        return json.loads(row.get("annotations") or "{}").get("boxes_xyxy_norm", [])
    except json.JSONDecodeError:
        return []
