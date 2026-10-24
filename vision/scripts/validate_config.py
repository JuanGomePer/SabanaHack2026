"""Valida configs/x2_vision.yaml (u otra config) contra las reglas del proyecto.

Uso: python scripts/validate_config.py [ruta]
"""

import sys
from pathlib import Path

VISION_ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(VISION_ROOT / "src"))

from berryvision.config import load_config, validate_config  # noqa: E402


def main() -> int:
    if hasattr(sys.stdout, "reconfigure"):
        sys.stdout.reconfigure(encoding="utf-8")
    path = Path(sys.argv[1]) if len(sys.argv) > 1 else VISION_ROOT / "configs" / "x2_vision.yaml"
    problems = validate_config(load_config(path), base_dir=VISION_ROOT)
    if problems:
        print(f"{path}: {len(problems)} problema(s)")
        for p in problems:
            print(f"  - {p}")
        return 1
    print(f"{path}: OK (estructura válida; los valores siguen sin verificar en el robot)")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
