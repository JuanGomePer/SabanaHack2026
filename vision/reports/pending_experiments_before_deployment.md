# Experimentos pendientes antes de cualquier despliegue

Ninguno de estos pasos se ha ejecutado. Están ordenados por dependencia. **Nada se ejecuta en PC1.**

| # | Experimento | Depende de | Qué decide | Criterio para avanzar |
|---|---|---|---|---|
| P1 | **E0/E1 DrBerry**: descarga, auditoría, `box_stats` y revisión manual | `ROBOFLOW_API_KEY` | ¿Las cajas marcan hoja o lesión? | Significado de la etiqueta documentado |
| P2 | **E1 arándano**: ResNet-18 sobre recortes de hoja (si las cajas son hojas) o detector (si son lesiones), con el mismo pipeline E4c (`configs/experiments/drberry/E1_leaf_cls.yaml`) | P1 | Primer modelo real de arándano | Recall por clase con IC; FN analizados |
| P3 | **Clase sin síntomas del mismo dominio**: usar "Sana" de DrBerry, no PlantVillage | P1 | Evitar la confusión fuente-clase observada en fresa | Comprobación de origen por clase (como notebook 01 §5.1) |
| P4 | **E3 resolución** en arándano: 224/384 (clasificación) y 640/1280/tiling (detección) a la densidad del X2 | P2 | `imgsz` | Recall por tamaño de lesión; latencia |
| P5 | **Rechazo / fuera de distribución**: umbral de confianza, energía o clase *otros* con datos | P2 | Cómo responde a lo desconocido | Cobertura vs error en imágenes ajenas |
| P6 | **Captura con el X2** (`docs/09`) y **test independiente por sesión** | Acceso a PC2 | Desempeño en el dominio real | ≥1 sesión etiquetada congelada |
| P7 | **E5**: evaluar P2 en P6 | P2 + P6 | ¿Sirve en la finca? | Punto de operación aceptado por AGRAR |
| P8 | **Exportación**: PyTorch → ONNX (opset fijo, entrada estática) y comparación numérica PyTorch vs ONNX en val | P2 | Equivalencia tras exportar | Diferencia máxima en probabilidades documentada; mismas predicciones |
| P9 | **TensorRT FP16 en PC2**, dentro del contenedor, con el TensorRT montado del host; repetir la comparación de P8 | P8 + PC2 | Precisión y latencia reales | Latencia p50/p95, memoria y recall sin degradación relevante |
| P10 | **Nodo de inferencia** suscrito al RGB comprimido (QoS RELIABLE), con preprocesamiento idéntico al de entrenamiento (`berryvision.preprocess` + `training.data.build_transforms`) y salida en el contrato v0.2.0 | P9 | Integración | Observaciones válidas con el esquema |
| P11 | **Profundidad / 3D** (`docs/10`) | P10 + calibración verificada | Ubicar detecciones | Error de distancia medido |
| P12 | **Riesgo ambiental** (Rivera et al. 2013) con sensores AGRAR, en un componente separado | Interfaces AGRAR | Alerta de riesgo, no diagnóstico | Validación con incidencias registradas |

## Estrategia de despliegue (documentada, no ejecutada)

- **Preprocesamiento único**: el mismo *letterbox* y la misma normalización en entrenamiento, exportación y nodo ROS. Comprobar con una imagen de referencia que el tensor de entrada es idéntico en los tres.
- **Exportar a ONNX en el equipo de desarrollo; construir el engine solo en PC2.** Un engine construido en la RTX 4050 no sirve en la Jetson.
- **Registro por observación**: imagen o referencia, *timestamp* del header ROS, versión del modelo (hash del checkpoint), umbral congelado, `camera_id` y resultado (`contracts/observation.schema.json`).
- **Latencia**: las cifras de `run_info.json` son del equipo de desarrollo (RTX 4050, lote 1) y **no** representan PC2.
