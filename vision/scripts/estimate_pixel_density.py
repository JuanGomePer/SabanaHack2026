"""Tabla de tamaño aparente (px) de objetos de interés según cámara y distancia.

Uso: python scripts/estimate_pixel_density.py
Los tamaños de objeto son órdenes de magnitud para razonar, no mediciones
agronómicas; las cámaras no están calibradas en nuestro robot.
"""

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "src"))

from berryvision.optics import PRESETS, object_size_px, pixels_per_mm  # noqa: E402

OBJECTS_MM = {
    "trips adulto (~1.5 mm)": 1.5,
    "lesión foliar inicial (~3 mm)": 3.0,
    "lesión foliar desarrollada (~10 mm)": 10.0,
    "fruto de arándano (~15 mm)": 15.0,
}
DISTANCES_M = (0.15, 0.30, 0.50)


def main() -> None:
    if hasattr(sys.stdout, "reconfigure"):
        sys.stdout.reconfigure(encoding="utf-8")
    header = "| Cámara | Distancia | px/mm | " + " | ".join(OBJECTS_MM) + " |"
    print(header)
    print("|" + "---|" * (3 + len(OBJECTS_MM)))
    for preset in PRESETS.values():
        f = preset.focal_px
        for d in DISTANCES_M:
            sizes = " | ".join(f"{object_size_px(mm, f, d):.1f}" for mm in OBJECTS_MM.values())
            print(f"| {preset.name} | {d:.2f} m | {pixels_per_mm(f, d):.2f} | {sizes} |")


if __name__ == "__main__":
    main()
