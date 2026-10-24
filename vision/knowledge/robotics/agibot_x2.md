# AgiBot X2 Ultra: registro de evidencia (plataforma vigente)

Resumen operativo en `../../docs/02_robot_agibot_x2_ultra.md`. Aquí se registra de dónde sale cada dato. Consulta: 2026-10-23, documentación AimDK X2 "latest" (SDK v1.1.0).

| Afirmación | Tipo | Fuente |
|---|---|---|
| PC1 RK3588, 10.0.1.40, prohibido para desarrollo secundario | Hecho, fuente primaria | S20, S21, S26 (v0.8.2) |
| 192.168.88.88 por AP Wi-Fi: jump host hacia PC2 en Ultra; PC1 directo en EDU; la advertencia lista "PC1, 10.0.1.40 / 192.168.88.88" | Hecho, fuente primaria (ambiguo) | S21 → se trata como PC1 a efectos de seguridad |
| PC2 Orin NX 16 GB, GPU Ampere 1024 núcleos + 32 Tensor Cores, 157 TOPS, 512 GB, IP 10.0.1.41 | Hecho, fuente primaria | S20, S21 |
| X2 EDU sin PC2 ni sensores de percepción | Hecho, fuente primaria | S20, S23 |
| Ubuntu 22.04, ROS 2 Humble, Python ≥ 3.8, C++17, SDK v1.1.0 = firmware | Hecho, fuente primaria | S21 |
| Contenedor podman en PC2; obligatorio desde v1.2.0; `l4t-base:r36.2.0`; CUDA/TensorRT montados desde el host | Hecho, fuente primaria | S22, S26 |
| Gemini 335: color ≤ 1920×1080 (94°×68°), profundidad ≤ 1280×800 (90°×65°), ≤ 60 fps, 850 nm | Hecho, fuente primaria (ficha) | S23 |
| HAL: RGB 1280×720 rgb8 30 Hz; comprimido MJPEG de la cámara; profundidad 1280×720 16UC1 mm; RELIABLE+VOLATILE; ~80 MB/s por flujo; suscribir solo desde PC2; RGB y profundidad sin sincronizar; TF estática a `rgbd_depth_head_front` | Hecho, fuente primaria | S24 |
| Profundidad no alineada con RGB desde v1.1.0 (`depth_registration` desactivado) | Hecho, fuente primaria | S26 |
| Interfaces de la cámara de interacción eliminadas en v0.8.1 | Hecho, fuente primaria | S26 |
| Calibración `factory_calibration_params.yml`, sección `head_rgbd_rgb` (sin sección de profundidad) | Hecho, fuente primaria | S25 |
| Ejemplos con QoS *best effort* | Documento del equipo | S16 (discrepa de S24) |
| FOV del color a 1280×720 = 94° (sin recorte) | **Hipótesis** | Inferido de S23; verificar con K de CameraInfo |

## Pendiente en la unidad física

Variante, firmware, SDK, L4T y TensorRT; `CameraInfo` real; formato del comprimido; Hz y QoS reales; contenido de `head_rgbd_rgb`; distancia mínima de enfoque; altura de la cabeza respecto a las camas.
