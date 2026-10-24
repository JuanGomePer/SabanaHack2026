# Arquitectura propuesta y contrato de integración

> Propuesta. El repositorio SabanaHack2026 solo contiene `README.md` en `main`, `Samuel` y `Sofinu` (verificado el 2026-10-23), así que no hay backend, frontend ni autenticación existentes con los que integrarse. No se crea una aplicación web paralela ni un segundo sistema de autenticación: el contrato se adaptará a lo que construya el equipo.

## Componentes separados

```text
AgiBot X2 Ultra
 ├─ PC1 (10.0.1.40)  control de movimiento ──── PROHIBIDO para este módulo
 └─ PC2 (Orin NX, 10.0.1.41) ── contenedor podman
       /aima/hal/sensor/rgbd_head_front/rgb_image/compressed ──► [captura o nodo de inferencia vision/]
       rgb_camera_info ─────────────────────────────────────────►   ├─ valida resolución (CameraInfo)
       (depth_image: fase posterior)                                ├─ letterbox → detector → cajas en px originales
                                                                    └─ Observation JSON + imagen de evidencia
                                                                              │
Ubicación declarada (plan de recorrido / navegación) ─────────────────────────┤
Sensores AGRAR (solo lectura; sensor_id + measured_at) ───────────────────────┤
                                                                              ▼
                                       Backend del equipo (por definir) → registro → app/dashboard → revisión humana
```

| Componente | Responsable | Nunca hace |
|---|---|---|
| Inferencia visual | `vision/` en PC2 o en un equipo externo | Ejecutarse en PC1; atribuirse datos de sensores |
| Contexto ambiental | Integración futura con AGRAR | Convertir HR en "infección" |
| Localización | Plan de recorrido / navegación del robot | Inventar camas o posiciones |
| Registro | Backend del equipo | Duplicar la autenticación |
| Alertas | App/dashboard del equipo | Accionar ventiladores o riego |

## Dónde ejecutar la inferencia (por etapas)

| Etapa | Dónde | Cómo | Riesgos |
|---|---|---|---|
| 1. Demo | **Diferida** en el equipo de desarrollo (RTX 4050) | Rosbag en PC2 → `extract_frames.py` → inferencia por lotes → observaciones | Ninguno sobre el robot; no es tiempo real |
| 2. Validación en robot | PC2, contenedor | Nodo ROS 2 suscrito al RGB **comprimido**, QoS RELIABLE, ~1–2 Hz; engine TensorRT FP16 construido en PC2 | Carga de CPU/GPU compartida con el SDK; **medir**, no suponer |
| 3. En línea | PC2 → backend | Publicar observaciones y subir la evidencia por la red de la finca | Wi-Fi del invernadero; seguridad de red (el fabricante desaconseja redes públicas) |

Reglas del fabricante que condicionan el diseño:

- Suscribirse a imágenes crudas solo desde PC2, nunca desde otra unidad (~80 MB/s por flujo).
- Contenedor obligatorio desde el SDK v1.2.0.
- No lanzar nodos en ráfaga.

## Contrato de salida v0.2.0

Especificación: `../contracts/observation.schema.json`. Implementación y validación: `../src/berryvision/observation.py` (con pruebas).

```json
{
  "observation_id": "uuid",
  "schema_version": "0.2.0",
  "observed_at": "2026-10-23T10:15:00-05:00",
  "model_version": "drberry-baseline-0",
  "image_reference": "evidence/<session_id>/<stamp_ns>.jpg",
  "camera_id": "x2_rgbd_head_front_rgb",
  "location": {"farm_id": "F1", "block_id": null, "greenhouse_id": null, "bed_id": null, "position": null, "method": "ruta_predefinida"},
  "visual_findings": [
    {"class_name": "Alternaria", "confidence": 0.62, "taxonomy": "blueberry_leaf/drberry-v1",
     "bbox_xyxy": [410, 220, 470, 280], "mask_reference": null,
     "depth_m": null, "point_xyz_m": null, "point_frame_id": null}
  ],
  "environmental_context": [
    {"variable": "relative_humidity_pct", "value": 88.0, "source_sensor_id": "S-07", "measured_at": "2026-10-23T10:10:00-05:00", "distance_to_bed_m": null}
  ],
  "review_status": "pending"
}
```

| Campo | Obligatorio | Nota |
|---|---|---|
| `observation_id`, `schema_version`, `observed_at`, `model_version`, `image_reference`, `camera_id`, `review_status` | Sí | `observed_at` con zona horaria; ideal: la marca de tiempo del header ROS |
| `location.*` | No | `null` si se desconoce; `method` dice cómo se obtuvo |
| `visual_findings[].class_name/confidence/taxonomy` | Sí | `confidence` = confianza del modelo, **no** probabilidad de infección |
| `bbox_xyxy` | No | Píxeles de la **imagen original** (no de la entrada letterbox) |
| `depth_m`, `point_xyz_m`, `point_frame_id` | No | Nuevos en v0.2.0. `null` hasta validar el registro RGB-profundidad |
| `environmental_context[]` | No | Cada lectura con su sensor y fecha; nunca derivada de la visión |

Cambios de v0.1.0 a v0.2.0: se añadieron los campos de profundidad opcionales y el `camera_id` de ejemplo pasó a la RGB-D del X2.

## Preguntas para el equipo de la app

1. Stack del backend, almacenamiento de imágenes y autenticación del robot o del equipo que sube las observaciones.
2. Identificadores de finca, bloque, nave y cama en la app.
3. ¿El dashboard consume las observaciones por API, por base de datos o por archivos?
