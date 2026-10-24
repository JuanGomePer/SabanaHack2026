# tests/

`python -m pytest -q` desde `vision/` (usa `pythonpath = ["src"]` de `pyproject.toml`).

Las pruebas generan imágenes y anotaciones sintéticas en directorios temporales. No dependen de ningún dataset de terceros.

| Archivo | Cubre |
|---|---|
| `test_audit.py` | YOLO, COCO, LabelMe, Supervisely, VOC y CSV; imágenes corruptas; duplicados; desajuste imagen-etiqueta; solo lectura; el CLI se niega a escribir dentro del dataset |
| `test_x2_pipeline.py` | Guardia de PC1, letterbox 1280×720→640 y retorno de cajas, coincidencia imagen/CameraInfo, decodificación JPEG en RGB, calibración de solo lectura (YAML sintético), reglas de `configs/x2_vision.yaml` |
| `test_data_pipeline.py` | Nombres locales seguros, extracción segura (rechaza `..` y enlaces), manifiesto sin credenciales, fugas entre splits, `box_stats`, polígonos YOLO, casi-duplicados tras recompresión, indicios de sintéticas o variantes `.rf.`, muestras visuales, coincidencias entre datasets, particiones por grupo |
| `test_training.py` | Imagen base de Roboflow, partición estratificada por grupos (aumentadas solo en train), Wilson, informe por clase, barrido y reglas de umbral (desempate hacia abajo), ECE, pesos de clase, Focal≡CE con γ=0, modelos (congelación y BN), letterbox en el Dataset, DataLoader (drop_last), `fit` de 2 épocas en CPU, regla de selección |
| `test_optics_and_contract.py` | Cálculos ópticos, validación del contrato de observación y su JSON Schema |
