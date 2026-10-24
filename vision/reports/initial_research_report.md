# Informe inicial de investigación (fase 1)

> **Histórico parcial.** Las secciones sobre el robot (B) se refieren al Booster K1, descartado el 2026-10-23. La plataforma vigente es el AgiBot X2 Ultra: ver `x2_update_report.md` y `../docs/02_robot_agibot_x2_ultra.md`. Las secciones de datasets (C, D) siguen vigentes.

Fecha: 2026-10-23 · Rama: `Sofinu` · Autoría: equipo + Claude Code
Convención: **[H]** hecho de fuente primaria · **[S]** fuente secundaria · **[L]** observación local · **[I]** hipótesis de ingeniería · **[D]** decisión · **[P]** pendiente

## A. Auditoría del entorno

- [L] `SabanaHack2026` no estaba clonado en el equipo. El remoto público tiene `main`, `Samuel` y `Sofinu`, las tres en `3a8d83b Initial commit`, con un único archivo, `README.md` (`# SabanaHack2026`). Se clonó en `hakatoon/SabanaHack2026` y se trabajó en `Sofinu`.
- [L] No había código, backend, frontend, CLAUDE.md, datasets ni pesos de modelos. No había cambios ajenos que preservar.
- [L] Entorno: Windows 11, Python 3.11.9, GPU RTX 4050 Laptop (6 GB). El Python global ya trae torch, ultralytics y opencv, pero el módulo usa su propio `.venv` con solo Pillow, PyYAML y pytest.
- [L] Antes de recibir la instrucción del repositorio compartido se creó por error `hakatoon/agrar-berry-vision` con `git init` vacío. Se eliminó (D-009).

## B. Robot

- [H] Booster K1: "stereo depth camera"; ediciones de 48, 117 (Orin NX 8GB) y 200 TOPS (AGX Orin 32GB); HR de operación 5–90 % sin condensación.
- [S] Cámara D-Robotics 544×488 y 105°×94° (equipo de RoboCup).
- [H en la demo] `robocup_demo` usa `/StereoNetNode/rectified_image` con fx = 206.45, consistente al 1 % con la hipótesis anterior [I].
- [L] Los documentos compartidos por el equipo son del **AgiBot X2** (Ultra: Orin NX 16GB, RGB-D Gemini335 1920×1080, cámara de interacción 2608×1960; EDU: sin sensores).
- [I] Tamaño aparente (salida de `scripts/estimate_pixel_density.py`): K1 a 0.30 m da 0.70 px/mm (trips 1.0 px, lesión de 3 mm 2.1 px, lesión de 10 mm 7.0 px); X2 Ultra RGB-D color a 0.30 m da 2.98 px/mm.

## C. Datasets (verificado en las fuentes, sin descargar)

| Dataset | Hecho clave | Uso |
|---|---|---|
| DrBerry-Original-Data | [H] 410 img, 4 clases, detección, CC BY 4.0, 1 versión | **Principal (Alternaria)** |
| drberry-gen-3 | [H] 2.671 img, mismas clases; [I] probablemente aumentado | Auxiliar solo train |
| Afzaal 2021 | [H] 2.500 img, gray_mold 476/598, polígonos, CC BY 4.0, ~20 % de internet | Experimental, fresa |
| PlantDoc | [L] Verificado por CSV: Blueberry leaf 827+22 cajas; ninguna enfermedad de arándano | Auxiliar (sanas) |
| Strawberry Hybrid | [H] 5.610 img, 1.018 sintéticas, CC BY-NC 4.0 | Auxiliar académico |
| PlantVillage | [H] 54.306 img, arándano solo sano; [P] conteo exacto | Auxiliar con cautela |
| Thrip_Leaf | [H] 5.618 img, Spathiphyllum, solo académico, contraseña por correo | Bloqueado |
| HyperspectralBlueberries | [H] 420 frutos, hiperespectral, 27.8 GB | Descartado |

Ranking, puntuaciones y decisiones: `../knowledge/datasets/dataset_comparison.md`.

## D. Recomendación

- **Alternaria**: DrBerry-Original-Data primero.
- **Moho gris**: Afzaal, solo como experimento en fresa.
- **Trips**: sin datos utilizables; no priorizar con la cámara del K1.
- **Hojas sanas**: "Sana" de DrBerry (mismo dominio) antes que PlantDoc o PlantVillage.
- **Sin datos específicos**: Botrytis en arándano y trips en arándano.
- **Siguientes experimentos**: E0 (auditoría), E1 (baseline), E3 (resolución del robot), E4 (fresa) y E5 (test del robot). Ver `../docs/05_estrategia_de_vision.md`.

## E. Pruebas ejecutadas

- `.venv/Scripts/python -m pytest -q` → **13 passed** (auditoría YOLO/COCO/LabelMe/Supervisely/VOC/CSV, imágenes corruptas, duplicados, solo lectura, CLI, óptica y contrato).
- Prueba de humo con datos reales: el CLI sobre los CSV de PlantDoc-Object-Detection (solo etiquetas, CC BY 4.0) reporta 8.921 cajas y 849 de `Blueberry leaf`. Coincide con el conteo independiente (8.469 + 452 y 827 + 22).

## F. Lo que **no** se hizo

No se descargaron datasets, no se entrenó ni validó ningún modelo, no hay métricas de desempeño, no hubo conexión con ningún robot y no se hicieron commits ni push.
