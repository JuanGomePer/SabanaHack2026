"""Preprocesamiento coherente entre entrenamiento e inferencia.

- La resolución de la cámara nunca es una constante: se toma de CameraInfo y
  se comprueba contra la imagen realmente recibida.
- La entrada de la red (p. ej. 640) es independiente de la resolución original.
- Letterbox: escala uniforme + relleno; nunca se estira la imagen.
"""

from __future__ import annotations

import io
from dataclasses import dataclass

from PIL import Image


class FrameMismatchError(ValueError):
    """La imagen recibida no coincide con lo que declara CameraInfo."""


@dataclass(frozen=True)
class LetterboxParams:
    src_w: int
    src_h: int
    dst: int
    scale: float
    new_w: int
    new_h: int
    pad_left: int
    pad_top: int


def letterbox_params(src_w: int, src_h: int, dst: int, stride: int = 32) -> LetterboxParams:
    if src_w <= 0 or src_h <= 0:
        raise ValueError("Dimensiones de origen inválidas")
    if dst % stride:
        raise ValueError(f"El tamaño de entrada {dst} debe ser múltiplo de {stride}")
    scale = min(dst / src_w, dst / src_h)
    new_w, new_h = round(src_w * scale), round(src_h * scale)
    pad_left = (dst - new_w) // 2
    pad_top = (dst - new_h) // 2
    return LetterboxParams(src_w, src_h, dst, scale, new_w, new_h, pad_left, pad_top)


def letterbox_image(img: Image.Image, dst: int, fill=(114, 114, 114)) -> tuple[Image.Image, LetterboxParams]:
    p = letterbox_params(img.width, img.height, dst)
    canvas = Image.new("RGB", (dst, dst), fill)
    canvas.paste(img.convert("RGB").resize((p.new_w, p.new_h), Image.BILINEAR), (p.pad_left, p.pad_top))
    return canvas, p


def box_to_source(box_xyxy: list[float], p: LetterboxParams) -> list[float]:
    """Convierte una caja en coordenadas de la red a píxeles de la imagen original."""
    x1, y1, x2, y2 = box_xyxy
    out = [(x1 - p.pad_left) / p.scale, (y1 - p.pad_top) / p.scale,
           (x2 - p.pad_left) / p.scale, (y2 - p.pad_top) / p.scale]
    return [min(max(out[0], 0), p.src_w), min(max(out[1], 0), p.src_h),
            min(max(out[2], 0), p.src_w), min(max(out[3], 0), p.src_h)]


def box_to_network(box_xyxy: list[float], p: LetterboxParams) -> list[float]:
    x1, y1, x2, y2 = box_xyxy
    return [x1 * p.scale + p.pad_left, y1 * p.scale + p.pad_top,
            x2 * p.scale + p.pad_left, y2 * p.scale + p.pad_top]


def check_frame_matches_info(frame_w: int, frame_h: int, info_w: int, info_h: int) -> None:
    """Las dimensiones de la imagen recibida deben coincidir con las de CameraInfo."""
    if (frame_w, frame_h) != (info_w, info_h):
        raise FrameMismatchError(
            f"Imagen {frame_w}x{frame_h} distinta de CameraInfo {info_w}x{info_h}: "
            "revise el topic, la resolución configurada o un posible re-escalado")


def decode_compressed(data: bytes) -> Image.Image:
    """Decodifica el payload de un sensor_msgs/CompressedImage (JPEG/MJPEG) a RGB.

    PIL devuelve RGB. cv2.imdecode devuelve BGR: mezclar ambos sin convertir
    invierte los canales y degrada el modelo sin dar error.
    """
    with Image.open(io.BytesIO(data)) as im:
        return im.convert("RGB")
