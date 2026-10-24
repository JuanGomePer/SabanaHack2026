# Plataforma robótica: AgiBot X2 Ultra

> **Decisión del equipo (2026-10-23):** la plataforma es el **AgiBot X2 Ultra**. El Booster K1 queda descartado; su investigación se conserva como histórico en `../knowledge/robotics/booster_k1.md`.
>
> **Nada de esta página se ha comprobado en la unidad física.** Todo procede de la documentación oficial de AimDK X2 (fuentes S20–S26 en `../knowledge/sources.yaml`), consultada el 2026-10-23 para el SDK v1.1.0. Columna "Estado": **Doc** = documentado por el fabricante; **Pend.** = pendiente de verificar en el robot.

## 1. Computadores a bordo y seguridad

| Unidad | Hardware | IP | Uso para visión |
|---|---|---|---|
| **PC1** — control de movimiento | RK3588 | **10.0.1.40** (y 192.168.88.88 vía AP Wi-Fi según la advertencia de requisitos) | **PROHIBIDO.** El fabricante prohíbe usarlo como entorno de compilación o ejecución de desarrollo secundario por razones de seguridad |
| **PC2** — desarrollo | Jetson Orin NX 16 GB: GPU Ampere de 1024 núcleos y 32 Tensor Cores, CPU Cortex-A78AE de 8 núcleos, 157 TOPS, 512 GB | 10.0.1.41 (cable) | **Destino de la inferencia**, dentro del contenedor |
| **PC3** — interacción | RK3588S | — | Fuera del alcance |

Salvaguardas implementadas en este módulo:

- `src/berryvision/safety.py` aborta si la máquina tiene una IP de PC1.
- Los scripts de `scripts/robot/` repiten esa comprobación en bash.
- `configs/x2_vision.yaml` declara `compute_unit: PC2` y `forbidden_hosts`, y `validate_config` lo exige.

La detección por IP es una red de seguridad, **no sustituye la verificación manual** de en qué máquina se está.

Otras restricciones documentadas:

- No modificar el SO, los drivers ni la configuración DDS del Orin.
- No lanzar nodos ROS en ráfaga (unos 2 por segundo como máximo) con el robot de pie o caminando: la congestión DDS puede hacerlo caer.
- Las actualizaciones de firmware formatean los discos.
- No guardar datos en `$HOME/aimdk*`, que mantiene el sistema.

## 2. Entorno de desarrollo

| Elemento | Valor | Estado |
|---|---|---|
| SO / ROS 2 | Ubuntu 22.04 LTS, ROS 2 Humble | Doc |
| Lenguajes | Python ≥ 3.8, C++17 | Doc |
| SDK | v1.1.0 (2026-05-11); debe coincidir con el firmware | Doc; **versión de nuestra unidad: Pend.** |
| Contenedor | Podman en PC2. **Obligatorio desde v1.2.0**; opcional pero recomendado en v1.1.0. `apt` y `pip` solo funcionan en modo contenedor | Doc |
| Imagen base | `l4t-base:r36.2.0`; CUDA, cuDNN y TensorRT **no incluidos**, se montan desde el host (`libnvinfer`, `libcudnn`…) | Doc; versión de TensorRT: Pend. |
| Red | Cable: host 10.0.1.2/24 → PC2 10.0.1.41. Wi-Fi solo para depurar | Doc |
| Credenciales SSH | Las facilita el soporte técnico | Pend. (nunca se versionan) |

Consecuencias:

- El engine de TensorRT se construye **dentro del contenedor de PC2**, con el TensorRT que se monta del host. Un engine construido en otra GPU no sirve.
- Las dependencias de inferencia se declaran en el Dockerfile del contenedor, nunca en el SO del robot.

## 3. Cámara elegida: RGB-D frontal Orbbec Gemini 335

| Parámetro | Ficha del sensor (S23) | Interfaz HAL publicada (S24) | Estado |
|---|---|---|---|
| Color | hasta 1920×1080, FOV 94°×68° | **1280×720, `rgb8`, 30 Hz** | Doc; Pend. en la unidad |
| Color comprimido | — | `CompressedImage` **MJPEG** generado por la propia cámara, 30 Hz | Doc |
| Profundidad | hasta 1280×800, FOV 90°×65° | **1280×720, `16UC1` en milímetros, 30 Hz** | Doc |
| QoS | — | **RELIABLE + VOLATILE** (history y depth sin documentar) | Doc |
| Ancho de banda | — | ~80 MB/s por flujo crudo; suscribirse **solo desde PC2** | Doc |
| Sincronía | — | RGB y profundidad **no** sincronizados: hay que emparejar por marca de tiempo | Doc |
| Alineación | — | Desde v1.1.0 la profundidad **ya no está alineada** con el RGB (`depth_registration` desactivado) | Doc (changelog) |
| Frames | — | `rgbd_head_front` (RGB, profundidad y sus intrínsecos); TF estática `rgbd_head_front` → `rgbd_depth_head_front` en `/tf_static` | Doc |

Topics:

```yaml
rgb_topic:        /aima/hal/sensor/rgbd_head_front/rgb_image/compressed   # sensor_msgs/CompressedImage
rgb_raw_topic:    /aima/hal/sensor/rgbd_head_front/rgb_image              # sensor_msgs/Image (solo en PC2)
rgb_info_topic:   /aima/hal/sensor/rgbd_head_front/rgb_camera_info        # sensor_msgs/CameraInfo
depth_topic:      /aima/hal/sensor/rgbd_head_front/depth_image            # sensor_msgs/Image 16UC1
depth_info_topic: /aima/hal/sensor/rgbd_head_front/depth_camera_info
```

Discrepancias registradas:

- El equipo espera RGB y profundidad a 1280×720 y 30 Hz, que coincide con la interfaz HAL; la ficha del sensor admite más. **La resolución nunca se fija en la config**: se lee de `CameraInfo` y se compara con cada imagen (`preprocess.check_frame_matches_info`).
- Los ejemplos de Python compartidos por el equipo usan QoS *best effort*, pero la HAL documenta RELIABLE. Hay que verificarlo con `ros2 topic info -v`.
- La cámara de interacción aparece en la ficha, pero **sus interfaces se eliminaron en el SDK v0.8.1**.

Otras cámaras para más adelante: estéreo frontal 2064×1552 o 2048×1536 (lente gran angular, modelo KANNALA_BRANDT, 10 Hz, QoS TRANSIENT_LOCAL) y trasera (parcialmente tapada por el asa y rotada 90° en la versión nueva).

## 4. Calibración de fábrica

Archivo en PC2: `/agibot/data/param/protected/factory_calib/factory_calibration_params.yml`, sección `head_rgbd_rgb`, con estos campos:

- `model_type`: PINHOLE o KANNALA_BRANDT;
- `image_width` e `image_height`;
- `K` y `D`;
- `R_baselink_sensor` y `t_baselink_sensor`;
- `head_yaw` y `head_pitch`: ángulos de la cabeza durante la calibración.

No hay una sección propia para la cámara de profundidad.

Reglas, con la implementación en `src/berryvision/calibration.py`:

- Solo lectura.
- Nunca se copia al repositorio (el `.gitignore` lo bloquea).
- No se sustituye por estimaciones.
- Se comprueba que `image_width × image_height` coincide con la imagen usada.

**Que una sección se lea no implica que se haya leído la de nuestro robot: eso sigue pendiente.**

## 5. Tamaño aparente de los objetivos

Salida de `scripts/estimate_pixel_density.py`. Usa un modelo pinhole en el centro, supone que el FOV de 94° se mantiene a 1280×720 (sin verificar) y los tamaños de objeto son orientativos:

| Cámara | Distancia | px/mm | Trips ~1.5 mm | Lesión ~3 mm | Lesión ~10 mm |
|---|---|---|---|---|---|
| RGB-D 1280×720 | 0.15 m | 3.98 | 6.0 | 11.9 | 39.8 |
| RGB-D 1280×720 | 0.30 m | 1.99 | 3.0 | 6.0 | 19.9 |
| RGB-D 1280×720 | 0.50 m | 1.19 | 1.8 | 3.6 | 11.9 |
| *K1 descartado, como referencia* | 0.30 m | 0.70 | 1.0 | 2.1 | 7.0 |

Lectura de ingeniería, como hipótesis:

1. La RGB-D del X2 da unas **2,9 veces más píxeles por milímetro** que el K1 a 1280 px de ancho.
2. **Ojo con el tamaño de entrada.** Con `imgsz=640` y letterbox, la imagen de 1280×720 se reduce a la mitad. Una lesión de 3 mm a 30 cm pasa de ~6 px a **~3 px** en la red. Hay que comparar 640, 1280 o recortes; es el experimento E3 (`05_estrategia_de_vision.md`).
3. Los trips siguen siendo marginales (3 px a 30 cm en la imagen original) y, además, no hay datos.
4. Falta la **distancia mínima de enfoque** del color de la Gemini 335 (Pend.); fija cuánto puede acercarse la cabeza.

## 6. Comprobaciones pendientes en la unidad física

Solo en PC2, con autorización:

1. `bash scripts/robot/inspect_rgbd_interfaces.sh`: topics, `CameraInfo` de color y profundidad, QoS, Hz, formato del comprimido y TF profundidad→RGB. No graba ni envía comandos.
2. Leer `head_rgbd_rgb` con `berryvision.calibration.load_camera_section(...)` y contrastarlo con `rgb_camera_info`.
3. `bash scripts/robot/short_capture_test.sh --yes 5`: captura de 5 s, comprobando antes el espacio y después que el bag se puede leer.
4. Registrar la variante (Ultra o Ultra nueva versión), el firmware, el SDK, la versión de L4T y la de TensorRT.
