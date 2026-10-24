# Investigación de modelos y herramientas

Todavía no se ha elegido ni instalado ninguna biblioteca de entrenamiento. Aquí se comparan las candidatas.

| Herramienta | Qué resuelve | Licencia | A favor | En contra |
|---|---|---|---|---|
| Ultralytics (YOLOv8/11) | Detección y segmentación; exportación ONNX/TensorRT | **AGPL-3.0** (o licencia empresarial) | Más rápida de poner en marcha; exportación directa a ONNX/TensorRT para Jetson; ya instalada en el Python global del equipo de desarrollo | El copyleft AGPL afecta a un servicio o producto de AGRAR; hay que decidirlo antes de comercializar |
| torchvision (Faster R-CNN, RetinaNet, SSDlite) | Detección | BSD-3 | Licencia permisiva; PyTorch ya está disponible | Más lento en Jetson; más código propio para entrenar y exportar |
| YOLOX (Megvii) | Detección | Apache-2.0 | Permisiva; exporta a ONNX y TensorRT | Proyecto con menos mantenimiento |
| RT-DETR (Hugging Face transformers) | Detección | Apache-2.0 | Permisiva; buen rendimiento con objetos medianos | Más pesado; medir en la Orin NX 16GB de PC2 |
| MMDetection | Detección y segmentación | Apache-2.0 | Muy completa | Instalación compleja en Windows y Jetson |

## Recomendación inicial (a validar)

- **Baseline de la hackathon**: un detector YOLO pequeño (n/s) con Ultralytics sobre DrBerry-Original-Data, registrando la decisión de licencia (D-008). Es el camino con menor riesgo de no llegar a tiempo.
- **Control**: un clasificador de imagen completa (por ejemplo, MobileNet o ResNet18 de torchvision) para saber si la detección aporta algo frente a clasificar.
- **Despliegue (PC2 del X2 Ultra)**: ONNX exportado en el equipo de desarrollo → engine TensorRT FP16 construido **dentro del contenedor de PC2** con el TensorRT montado del host (un engine de otra GPU no sirve). Entrada fija; tamaño elegido **después** de E3 (640 frente a 1280 o recortes).
- Las dependencias de inferencia (onnxruntime-gpu o bindings de TensorRT) se declaran en el Dockerfile del contenedor, no en el SO del robot.
- No se descargan pesos grandes ni se prueban varias arquitecturas a la vez.

## Preguntas de investigación

1. ¿Las cajas de DrBerry delimitan lesiones o la hoja entera? Cambia el significado de la métrica.
2. ¿Con 410 imágenes se obtiene recall útil para Alternaria? Medir con validación cruzada por grupo si hay metadatos de planta o sesión.
3. ¿El *tiling* (dividir la imagen en recortes) ayuda con lesiones pequeñas en imágenes de 1280×720 del X2, frente a reducir a 640 (que divide a la mitad el tamaño de las lesiones)?
