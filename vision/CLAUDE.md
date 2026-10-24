# CLAUDE.md: módulo vision/ de SabanaHack2026

Lee esto y `docs/00_resumen_ejecutivo.md` antes de proponer cambios relevantes.

## Proyecto

- Hackathon Sabana Hack 2026, reto **AGRAR Berry Good Idea**. El robot inspecciona camas de arándano, detecta señales visuales de enfermedades o plagas, las localiza (finca → bloque → nave → cama → posición) y genera alertas para revisión humana.
- Repositorio compartido `JuanGomePer/SabanaHack2026`; rama de trabajo **`Sofinu`** (S mayúscula; el equipo a veces la escribe `sofinu`). Toda la solución vive aquí. **Nunca** crear repos nuevos o anidados.
- Este módulo vive en `vision/` y es autocontenido: sus dependencias no van a la app.

## Plataforma: AgiBot X2 Ultra (Booster K1 descartado; ver D-010)

- **PC1 (10.0.1.40; 192.168.88.88 por Wi-Fi) = control de movimiento: PROHIBIDO.** Nada se ejecuta, instala, compila ni copia allí. `berryvision.safety.assert_not_pc1()` y los scripts de `scripts/robot/` lo bloquean, pero **verifica a mano en qué máquina estás antes de cualquier operación sobre el robot.**
- PC2 (10.0.1.41) = Jetson Orin NX 16 GB, 157 TOPS: destino de inferencia, **dentro del contenedor podman** (obligatorio desde el SDK v1.2.0). No instalar nada en el SO del robot.
- Cámara: RGB-D frontal Orbbec Gemini 335. La HAL documenta RGB 1280×720 rgb8 30 Hz, comprimido MJPEG y profundidad 16UC1 (mm) **no alineada ni sincronizada**. Topics y QoS en `configs/x2_vision.yaml`.
- Calibración de fábrica en PC2 `/agibot/data/param/protected/factory_calib/factory_calibration_params.yml`: **solo lectura, nunca al repo, nunca estimarla**.
- Nada se ha verificado aún en la unidad física.

## Reglas innegociables

1. **Solo informar**: sin escribir en controladores, ventiladores o riego; sin comandos de movimiento ni cambios de modo del robot.
2. No inventar métricas, conteos, licencias, parámetros de cámara ni ubicaciones; lo no verificado se marca como hipótesis o pendiente. No afirmar acceso al robot, capturas ni rendimiento que no hayan ocurrido.
3. La resolución de la cámara no se fija: se lee de `CameraInfo` y se valida. `imgsz` (640) es independiente y está sujeto a E3.
4. RGB primero; la profundidad y el 3D van después (`docs/10`).
5. `gray_mold` de fresa ≠ Botrytis en arándano. Cada hallazgo lleva su `taxonomy`.
6. `confidence` = confianza del modelo, no probabilidad de infección. Los datos ambientales van con sensor y fecha, separados.
7. No versionar datos, imágenes, rosbags, pesos (`*.pt`, `*.onnx`, `*.engine`), calibraciones ni credenciales.
8. Git: sin commits, push, `reset --hard` ni `clean` salvo petición explícita; preservar el trabajo ajeno.

## Datasets (ver `knowledge/datasets/`)

- Ver `docs/11_dataset_strategy.md`, `reports/dataset_selection_report.md` y `knowledge/datasets/taxonomy.yaml` **antes** de tocar datos o clases.
- Primer modelo: `blueberry_leaf_condition_v1` = hojas de arándano con 4 condiciones de DrBerry. Núcleo: DrBerry original v1 (410 img, **estirado a 1024²**) frente a gen-3-20 v1 (585), comparados tras descargar. **Bloqueado sin `ROBOFLOW_API_KEY`** (solo en variable de entorno; nunca en archivos ni en el chat).
- Descargados y auditados (auxiliares): PlantVillage `Blueberry___healthy` (1.502, laboratorio; solo control) y PlantDoc `Blueberry leaf` (117; **no es "sana"**).
- Experimental: Afzaal (moho gris en fresa). Auxiliares: drberry-gen-3 (solo train), PlantDoc (Blueberry leaf).
- Bloqueado: Thrip_Leaf. Descartado: HyperspectralBlueberries.
- **No existe dataset público de Botrytis en arándano.**

## Entrenamiento (fase 2026-10-24)

- Manifiesto: `scripts/build_manifest.py`, que genera `data/processed/manifest_v1.csv` (no versionado) y `manifests/` (versionado). Particiones estratificadas por grupos sin fugas.
- **Único entrenamiento hecho: experimento AUXILIAR en FRESA (E4c)**, no arándano. Seleccionado E4c_04 (ResNet-18). Informes: `reports/experiment_report.md`, `error_analysis.md` y `metrics_per_class.md`; notebooks `notebooks/01_*` y `02_*`.
- En fresa la clase sin síntomas está **confundida con la fuente**: no usar la alerta binaria como evidencia. Selección por recall condicionado entre enfermedades (`training/selection.py`).
- Protocolo: seleccionar solo con val (`select_experiment.py`), congelar `selection.json` y abrir test **una vez** (`evaluate_final.py`). Nunca recalcular la selección tras abrir test.
- GPU: torch CUDA solo en `vision/.venv` (extra `train`).

## Banco de imágenes de arándano (2026-10-24)

- Catálogo de 33 fuentes: `knowledge/datasets/blueberry_image_sources.yaml` → `scripts/build_source_tables.py`. Auditoría: `reports/blueberry_image_repository_audit.md`; notebook 03.
- **No hay datos públicos utilizables de Botrytis ni de trips en arándano.** La prioridad es `pry20220204-drberry` (posibles cajas de lesión; requiere API key) y los datos de AGRAR.
- Descargados como contexto (no "sanos"): BlueberryDCM (CC BY-NC) y Blueberry YOLO (CC BY).
- Datos propios: taxonomía con niveles de evidencia (`blueberry_taxonomy.yaml`), esquema `contracts/agrar_capture_metadata.schema.json`, `scripts/validate_capture_session.py`, protocolo (`reports/blueberry_collection_protocol.md`), guía (`reports/annotation_guide.md`) y solicitudes (`reports/agrar_blueberry_data_request.md`, `reports/data_requests/`).
- Riesgo ambiental aparte: `src/berryvision/env_risk.py` (nunca diagnostica) y `docs/13`.

## Datos, artefactos y despliegue (D-044 a D-048, `docs/14`)

- Fuentes autorizadas: `configs/data_sources.yaml` (DrBerry principal, bloqueada sin key; Zhang solo evaluación). Verificar con `scripts/prepare_data.py verify`.
- Zhang: usar `manifests/splits/blueberry_yolo_zhang_groups.csv` (la partición del autor tiene fuga).
- Inferencia: `scripts/export_model_artifact.py` → `artifacts/models/<id>/` (no versionado) → `scripts/predict.py`. Docker: `vision/Dockerfile`, solo inferencia; el modelo se monta.
- Los datos nunca van a Git ni a la imagen. No modificar la configuración de despliegue de `main`.
- Respaldo: repo de datasets PRIVADO de Hugging Face con `scripts/sync_hub.py` (`BERRYVISION_HF_REPO`, `HF_TOKEN` solo en el entorno).

## Comandos

```bash
cd vision
.venv/Scripts/python -m pytest -q                       # Linux: .venv/bin/python
.venv/Scripts/python scripts/validate_config.py         # reglas de configs/x2_vision.yaml
.venv/Scripts/python scripts/build_manifest.py          # manifiesto + particiones por grupos
bash scripts/run_aux_experiments.sh                     # experimentos E4c (GPU)
.venv/Scripts/python scripts/select_experiment.py       # selección SOLO con val
.venv/Scripts/python scripts/report_metrics.py          # informe por clase desde artefactos
.venv/Scripts/python scripts/audit_local_datasets.py --root data/external/<id> [--root otro] --samples 8
.venv/Scripts/python scripts/make_group_splits.py reports/audits/<id>_images.csv --out configs/splits/<id>_seed0.csv
.venv/Scripts/python scripts/acquire/fetch_github_subset.py {plantvillage_blueberry_healthy|plantdoc_blueberry}
.venv/Scripts/python scripts/acquire/fetch_roboflow.py drberry drberry-original-data 1 yolov8   # requiere ROBOFLOW_API_KEY
.venv/Scripts/python scripts/estimate_pixel_density.py
# Solo en PC2, con autorización:
bash scripts/robot/inspect_rgbd_interfaces.sh           # solo lectura
bash scripts/robot/short_capture_test.sh --yes 5        # captura de prueba de 5 s
python scripts/robot/extract_frames.py <bag> <out>      # requiere ROS 2 (rosbag2_py)
```

## Cómo se documenta

Fuentes en `knowledge/sources.yaml`; decisiones en `knowledge/decision_log.md` (añadir entradas, no borrar); datasets en `knowledge/datasets/catalog.yaml`. Distingue: hecho de fuente primaria / fuente secundaria / observación local / hipótesis / decisión / pendiente.

## Próximos pasos

`docs/08_roadmap.md`: `ROBOFLOW_API_KEY` → DrBerry (E0/E1, `configs/experiments/`) → E3. En paralelo: acceso a PC2 (inspección y captura) y solicitud de imágenes a AGRAR. Las cifras «80 %» y «50 %» no se usan (`knowledge/claims_pending_verification.md`).
