# Informe de actualización: AgiBot X2 Ultra (fases A–F)

Fecha: 2026-10-23 · Rama: `Sofinu` · Sin commits ni push.
Convención: **[H]** fuente primaria · **[L]** observación local · **[I]** hipótesis · **[D]** decisión · **[P]** pendiente

## A. Auditoría del repositorio

- [L] `git fetch` + `git ls-remote`: `main`, `Samuel` y `Sofinu` siguen en `3a8d83b Initial commit`. No hay trabajo nuevo de otros integrantes; el árbol local solo tiene `vision/` sin seguimiento.
- [L] La instrucción menciona la rama `sofinu`, pero en el remoto solo existe **`Sofinu`**. Se siguió trabajando en ella y no se creó otra (D-017).
- [L] Se actualizaron todos los documentos que daban el K1 como plataforma vigente. El K1 queda como histórico en `knowledge/robotics/booster_k1.md` y en los presets ópticos marcados como DESCARTADO.

## B. Investigación del X2 Ultra (solo documentación oficial; nada verificado en la unidad)

- [H] PC1 = RK3588, 10.0.1.40, **prohibido**. PC2 = Orin NX 16 GB (1024 núcleos Ampere, 32 Tensor Cores, 157 TOPS), 10.0.1.41. PC3 = interacción.
- [H] Ubuntu 22.04, ROS 2 Humble, SDK v1.1.0 (= firmware). Contenedor podman obligatorio desde v1.2.0; CUDA y TensorRT se montan desde el host.
- [H] La RGB-D publica RGB 1280×720 rgb8 a 30 Hz, comprimido MJPEG de la cámara y profundidad 1280×720 16UC1 en mm. QoS RELIABLE+VOLATILE, ~80 MB/s por flujo crudo, suscripción solo desde PC2. RGB y profundidad no sincronizados y, desde v1.1.0, sin alinear.
- [H] Calibración `head_rgbd_rgb` en PC2 (PINHOLE o KANNALA_BRANDT, K, D, extrínsecos respecto a base_link); no tiene sección de profundidad.
- [H] Las interfaces de la cámara de interacción se eliminaron en v0.8.1.
- [I] Tamaño aparente: lesión de 3 mm a 30 cm ≈ 6 px a 1280×720 y ≈ 3 px tras letterbox a 640.
- Discrepancias registradas: QoS (HAL RELIABLE frente a *best effort* en los ejemplos compartidos) y 192.168.88.88 (jump host / PC1), que por seguridad se trata como PC1.

## C. Datasets

Sin cambios en la selección: DrBerry-Original principal; Afzaal experimental (fresa); trips bloqueado; Botrytis en arándano sin datos. Se actualizaron las notas de compatibilidad con la cámara del X2.

## D. Preparación del módulo (cambios en el repositorio)

| Archivo | Cambio |
|---|---|
| `configs/x2_vision.yaml` | **Nuevo.** Robot, PC2, hosts prohibidos, topics, QoS, `imgsz` 640, umbrales, `weights_path`/`engine_path` = null, `use_depth` = false, calibración de solo lectura |
| `src/berryvision/safety.py` | **Nuevo.** Clasificación pc1/pc2/external y `assert_not_pc1` |
| `src/berryvision/preprocess.py` | **Nuevo.** Letterbox, conversión de cajas, comprobación imagen↔CameraInfo, decodificación JPEG→RGB |
| `src/berryvision/calibration.py` | **Nuevo.** Lector de `factory_calibration_params.yml` de solo lectura con comprobación de resolución |
| `src/berryvision/config.py` + `scripts/validate_config.py` | **Nuevos.** Reglas del proyecto aplicadas a la config |
| `scripts/robot/inspect_rgbd_interfaces.sh` | **Nuevo.** Inspección de solo lectura en PC2; aborta en PC1 |
| `scripts/robot/short_capture_test.sh` | **Nuevo.** Captura de ≤ 30 s, exige `--yes`, PC2 y espacio libre; verifica el bag |
| `scripts/robot/extract_frames.py` | **Nuevo.** Extrae JPEG + `manifest.csv` de un rosbag (requiere ROS 2) |
| `src/berryvision/observation.py`, `contracts/observation.schema.json` | v0.2.0: campos opcionales `depth_m`, `point_xyz_m`, `point_frame_id` |
| `src/berryvision/optics.py` | Presets del X2 (1280 y 1920); K1 marcado como descartado |
| `tests/test_x2_pipeline.py` | **Nuevo.** 25 pruebas |
| `docs/02_robot_agibot_x2_ultra.md` | Reemplaza a `02_robot_booster_k1.md` |
| `docs/09_captura_datos_x2.md`, `docs/10_profundidad_y_localizacion_3d.md` | **Nuevos** |
| `docs/00, 01, 03, 04, 05, 06, 07, 08`, `README.md`, `CLAUDE.md`, `knowledge/*` | Actualizados al X2 |
| `.gitignore` | Bloquea calibraciones de fábrica e informes de inspección |

## E. Pruebas ejecutadas (equipo de desarrollo, Windows, `.venv`)

- `python -m pytest -q` → **38 passed**.
- `python scripts/validate_config.py` → `OK (estructura válida; los valores siguen sin verificar en el robot)`.
- `python scripts/estimate_pixel_density.py` → la tabla de `docs/02` §5.
- `bash -n` sobre los dos scripts de robot → sin errores de sintaxis. **No se ejecutaron**: no hay robot ni ROS 2 en este equipo.
- `py_compile scripts/robot/extract_frames.py` → compila. **No se ejecutó** contra ningún rosbag.

## F. Lo que NO se hizo

No hubo conexión al robot, ni lectura de `CameraInfo` o de la calibración real, ni capturas, ni descarga de datasets, ni entrenamiento, exportación o medición de latencia, ni commits o push.

## Pendientes priorizados

1. Acceso autorizado a PC2 → `inspect_rgbd_interfaces.sh` → registrar variante, SDK, L4T, TensorRT, `CameraInfo`, QoS y Hz.
2. Captura corta + extracción; después, sesiones según `docs/09`.
3. DrBerry: descarga, auditoría, E1 y E3 (640 frente a 1280).
4. Respuestas de AGRAR: imágenes de Botrytis en arándano y significado de "Trips".
