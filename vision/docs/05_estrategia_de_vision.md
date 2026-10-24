# Estrategia de visión por computadora (AgiBot X2 Ultra, cámara RGB-D Gemini 335)

## Principios

1. **Primero RGB, luego profundidad.** El primer modelo es un detector RGB con un baseline medible. La profundidad es otra fase (`10_profundidad_y_localizacion_3d.md`). No se entrena un modelo multimodal solo porque exista la profundidad.
2. **La resolución de la cámara no es una constante.** Se lee de `CameraInfo` y se valida en cada imagen. La entrada de la red (`imgsz`, inicialmente 640) es independiente.
3. **El mismo preprocesamiento en entrenamiento e inferencia** (`src/berryvision/preprocess.py`).

## Tarea (D-007, sin cambios)

| Opción | Decisión |
|---|---|
| Clasificación de imagen completa | Solo como control |
| **Detección con cajas** | Tarea principal (DrBerry trae cajas) |
| Segmentación de instancias | Experimento aparte de moho gris en fresa (Afzaal) |
| Modelo multicultivo único | Descartado |

## Clases iniciales a investigar y realidad de los datos

| # | Clase pedida | Datos disponibles | Decisión |
|---|---|---|---|
| 1 | Alternaria en hojas de arándano | DrBerry (410 img; Alternaria, Oidio, Heliothis, Sana) | **Entrenable**; taxonomía `blueberry_leaf/drberry-v1` |
| 2 | Moho gris / Botrytis | Solo en fresa (Afzaal `gray_mold`) | Experimento separado `strawberry/afzaal-2021`. **No** es una clase del detector de arándano |
| 3 | Trips | Solo en Spathiphyllum, con acceso bloqueado | No entrenable por ahora; ~3 px a 30 cm con la RGB-D |
| 4 | Hoja de arándano sin síntomas | "Sana" de DrBerry (mismo dominio). PlantDoc `Blueberry leaf` **no** es sana (auditoría) y PlantVillage es de laboratorio | Entrenable con DrBerry como `blueberry_leaf_no_visible_symptoms` |

La taxonomía final depende de la auditoría de DrBerry (conteo por clase y qué delimitan las cajas). Taxonomía vigente: `knowledge/datasets/taxonomy.yaml`; estrategia de datos: `11_dataset_strategy.md`. La única muestra pública de DrBerry sugiere que las cajas cubren **hojas completas** y no lesiones.

## Preprocesamiento

| Aspecto | Política | Estado |
|---|---|---|
| Fuente de imagen | `rgb_image/compressed` (MJPEG de la cámara), decodificado con PIL → RGB | Documentado; verificar `format` en el robot |
| Orden de color | RGB en todo el pipeline. `cv2.imdecode` da BGR y hay que convertir; hay una prueba que lo vigila | Implementado |
| Resolución | De `CameraInfo` (HAL documenta 1280×720) y comprobada contra la imagen | Implementado (`check_frame_matches_info`) |
| Relación de aspecto | 16:9 → letterbox a `imgsz` sin estirar; las cajas se devuelven a píxeles originales | Implementado y probado |
| Distorsión | Gemini 335 color, probablemente `PINHOLE` con D pequeño. **No rectificar** salvo que `D` de la calibración lo justifique, y entonces hacerlo igual en entrenamiento | Pend. leer `head_rgbd_rgb` |
| Compresión | Las imágenes del robot son MJPEG. Añadir artefactos JPEG como aumentación a los datasets públicos es razonable | Por evaluar |
| Desenfoque / exposición | Aumentación moderada: brillo, exposición, balance de blancos y desenfoque de movimiento leve | Por evaluar con capturas reales |
| Recortes / zoom | Solo si las cajas se recalculan y revisan; ninguna transformación debe cortar lesiones sin control | Regla |

## Experimentos, en orden

| ID | Datos | Pregunta | Condición previa |
|---|---|---|---|
| E0 | DrBerry-Original | Calidad, balance, duplicados y tamaño de cajas | Descarga + `audit_local_datasets.py` |
| E1 | DrBerry-Original | Baseline de detección ligero: recall y precisión por clase | E0 |
| E1c | DrBerry-Original | Control con clasificador de imagen completa | E0 |
| E2 | + drberry-gen-3 (solo train) | ¿Aporta sin contaminar el test? | Hashes y casi-duplicados |
| **E3** | DrBerry degradado a la densidad del X2 | Recall frente al tamaño de lesión con `imgsz` 640, 960, 1280 y recortes, simulando 1280×720 a 0.15/0.30/0.50 m | Tabla óptica (hecho) + `CameraInfo` real |
| E4 | Afzaal (fresa) | Moho gris **en fresa** (segmentación o detección) | Auditoría |
| E5 | Imágenes del X2 | Test independiente del dominio real | Protocolo `09_captura_datos_x2.md` |
| E6 | Modelo de E1/E3 en PC2 | Latencia, memoria y FPS reales con TensorRT FP16 | Engine construido en el contenedor de PC2 |

E3 decide si 640 basta. La tabla óptica indica que reducir 1280→640 deja una lesión de 3 mm a 30 cm en ~3 px.
