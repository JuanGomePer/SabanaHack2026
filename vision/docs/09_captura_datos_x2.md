# Protocolo de captura de datos reales con el X2 Ultra

Objetivo: obtener imágenes **representativas del dominio real** (cámara RGB-D del robot en camas de arándano) para dos usos:

- un **test independiente**, que es la prioridad;
- después, *fine-tuning*.

Los datasets públicos complementan, pero no sustituyen, esta validación.

## Antes de grabar (lista obligatoria)

- [ ] Autorización del responsable del robot y de la finca. Robot quieto o con movimiento operado por personal autorizado; este módulo **no envía comandos de movimiento**.
- [ ] Confirmar la máquina: PC2 (10.0.1.41), dentro del contenedor. Los scripts abortan en PC1.
- [ ] `inspect_rgbd_interfaces.sh` ejecutado y su informe revisado (resolución, Hz y formato reales).
- [ ] Espacio libre verificado (`df -h`). RGB comprimido a 30 Hz; a modo orientativo, hay que medir el tamaño real con la prueba corta.
- [ ] Prueba corta de 5 s (`short_capture_test.sh`) y extracción correcta con `extract_frames.py`.
- [ ] Datos guardados fuera de `$HOME/aimdk*` y fuera de Git (`vision/data/robot_captures/` está ignorado).

## Qué grabar

- **Topics:** el RGB **comprimido** y `rgb_camera_info`. La profundidad cruda (~80 MB/s) solo en sesiones dedicadas a la fase 3D, grabando en PC2. Nunca suscribirse a flujos crudos desde otro equipo.
- **Frecuencia:** grabar a la tasa nativa y submuestrear al extraer (`--every N`). Los fotogramas consecutivos son casi idénticos.

## Diversidad requerida por sesión

| Eje | Variantes mínimas |
|---|---|
| Ubicación | Varias camas y naves; centro **y bordes** de cama |
| Distancia cabeza–planta | ~0.15, 0.30 y 0.50 m (lo que permita el enfoque) |
| Ángulo | Frontal, oblicuo, de arriba abajo (pitch de cabeza si aplica) |
| Iluminación | Mañana, mediodía y tarde; nublado; contraluz |
| Órganos | Hojas (haz y envés si es posible), tallos, flores, frutos |
| Oclusión | Hojas superpuestas, estructura del invernadero |
| Movimiento | Robot quieto. En marcha **solo** si es seguro y está autorizado |
| Estado | Plantas sin síntomas **y** anomalías que verifique un agrónomo |

## Metadatos por sesión (`session.yaml` junto al bag)

`session_id`, fecha y hora con zona horaria, operador, finca, bloque, nave, camas recorridas, variante del robot, firmware y SDK, topics grabados, resumen de `CameraInfo`, condiciones de luz, distancia aproximada, notas del agrónomo e incidencias.

`extract_frames.py` escribe además un `manifest.csv` por fotograma: archivo, sesión, marca de tiempo, `frame_id`, formato y dimensiones de `CameraInfo`.

## Etiquetado

- Herramienta con exportación YOLO o COCO, por ejemplo CVAT o Label Studio. La elección está pendiente.
- Etiquetas solo de clases definidas en `05_estrategia_de_vision.md`. Una anomalía sin confirmar por el agrónomo se marca como `unverified`, no con una enfermedad.
- Guía de anotación escrita (qué delimita la caja) antes de etiquetar.
- Revisión cruzada de una muestra por una segunda persona.

## Particiones

- Separar por **sesión** (y por cama o planta cuando se pueda), nunca dividiendo fotogramas consecutivos al azar.
- La primera sesión etiquetada de calidad se **congela como test** antes de entrenar con imágenes del robot.
