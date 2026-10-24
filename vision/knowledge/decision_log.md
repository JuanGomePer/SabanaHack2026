# Bitácora de decisiones

Formato: fecha · decisión · razonamiento · alternativas descartadas · estado.

## 2026-10-23

**D-001 · Ubicación del módulo en `vision/` dentro de SabanaHack2026 (rama `Sofinu`).**
El repositorio solo tenía `README.md` y un commit inicial; no hay convención previa de backend ni de ML. `vision/` es autocontenido (su propio `pyproject.toml`, `.gitignore` y `.venv`) para no imponer dependencias de Python ni de ML al resto de la aplicación.
Descartado: un repositorio aparte (prohibido por el equipo) o `ml/` o `services/` (no hay convención que lo justifique).
Estado: vigente; revisar cuando exista el backend.

**D-002 · La rama se llama `Sofinu` (S mayúscula), no `sofinu`.**
`git ls-remote` muestra `main`, `Samuel` y `Sofinu`, todas en `3a8d83b`. Se trabajó en `Sofinu`.

**D-003 · Robot de referencia: Booster K1, con la discrepancia X2 abierta. (SUPERADA por D-010).**
Las instrucciones del equipo fijan el K1, pero los documentos técnicos compartidos son del AgiBot X2. Se documentan ambos y no se asume ninguno.

**D-004 · Primer dataset: DrBerry-Original-Data (Alternaria en hoja de arándano).**
Es el único que combina cultivo objetivo, enfermedad objetivo, licencia abierta y acceso. Descartado como principal: drberry-gen-3 (más imágenes, pero de procedencia desconocida y con riesgo de fuga).

**D-005 · Botrytis se trata como riesgo ambiental y no como clase visual en arándano.**
No hay imágenes de Botrytis en arándano. Afzaal (fresa) se usa solo como experimento separado.

**D-006 · Thrips bloqueado.**
El acceso y la licencia lo restringen, y el análisis óptico indica 1–2 px por insecto con el K1 (con la RGB-D del X2: ~3 px a 30 cm, ~1,5 px tras letterbox a 640; sigue bloqueado, ver D-013).

**D-007 · Tarea inicial: detección con cajas.**
DrBerry trae cajas. Segmentación solo para el experimento de Afzaal. Clasificación de imagen completa solo como control.

**D-008 · No se fija todavía la biblioteca de entrenamiento.**
Ultralytics es lo más rápido (y es lo que usa robocup_demo), pero tiene licencia **AGPL-3.0**. Para la hackathon es aceptable; para un producto de AGRAR requiere licencia empresarial o una alternativa con licencia permisiva. Ver `model_research/README.md`.

**D-009 · Corrección de proceso.**
Antes de recibir la instrucción del repositorio compartido se creó por error una carpeta `hakatoon/agrar-berry-vision` con `git init` (sin commits ni archivos de otros). Se eliminó al recibir la instrucción. No afectó a SabanaHack2026.

**D-010 · Plataforma definitiva: AgiBot X2 Ultra (Booster K1 descartado).**
Lo confirmó el equipo. La documentación del K1 se conserva como histórico. Los documentos del X2 compartidos antes (S16) se contrastaron con la documentación oficial (S20–S26).

**D-011 · Cámara de la primera versión: RGB-D frontal Orbbec Gemini 335, solo el flujo RGB.**
Da color y, más adelante, profundidad. Descartadas por ahora: la estéreo (gran angular, menor densidad central, 10 Hz), la de interacción (interfaces eliminadas en v0.8.1) y la trasera (obstruida).

**D-012 · Inferencia solo en PC2 (contenedor) o en un equipo externo; PC1 bloqueado por código.**
`safety.py`, los scripts bash y `validate_config` lo hacen cumplir. 192.168.88.88 también se trata como PC1 porque la advertencia oficial lo agrupa con 10.0.1.40.

**D-013 · Resolución nunca fija en la config; `imgsz` nominal 640 sujeto a E3.**
La HAL documenta 1280×720. A 640 una lesión de 3 mm a 30 cm queda en ~3 px, así que E3 compara 640, 1280 y recortes.

**D-014 · RGB comprimido (MJPEG) como fuente por defecto.**
Ahorra ancho de banda y almacenamiento; ~80 MB/s por flujo crudo. Decodificación en RGB con PIL (`cv2.imdecode` da BGR y obliga a convertir).

**D-015 · Profundidad y 3D aplazadas.**
Desde v1.1.0 la profundidad no está alineada ni sincronizada con el RGB. El flujo queda documentado en `docs/10`; los campos del contrato (v0.2.0) van en `null` hasta validarlo.

**D-016 · QoS RELIABLE según la HAL**, aunque los ejemplos compartidos usan *best effort*. Se verifica con `ros2 topic info -v` antes del nodo definitivo.

**D-017 · La rama sigue siendo `Sofinu`.**
La actualización la nombra `sofinu`, pero el remoto (verificado el 2026-10-23) solo tiene `Sofinu`; no se crea una rama nueva.

**D-018 · Primer modelo = `blueberry_leaf_condition_v1` (hojas de arándano con condición; 4 clases DrBerry), no "detector de lesiones".**
La única muestra pública de DrBerry tiene una caja que cubre casi toda la hoja, y la versión original está estirada a 1024². No se promete localización de manchas hasta que `box_stats` y la revisión manual lo permitan.

**D-019 · DrBerry original v1 y gen-3-20 v1 se descargan ambos y se comparan antes de elegir.**
gen-3-20 no está estirado, pero su procedencia no está documentada. gen-3 (2.671) queda como auxiliar solo para train tras deduplicar.

**D-020 · Bloqueo: sin `ROBOFLOW_API_KEY` no se descarga DrBerry ni se entrena.**
La key no se pide por chat ni se guarda en archivos; cada integrante la define en su sesión.

**D-021 · PlantDoc `Blueberry leaf` = "hoja de condición no especificada", nunca "sana".**
La auditoría encontró hojas decoloradas, una con deficiencia de hierro, cajas incompletas y 1 duplicado train↔test.

**D-022 · PlantVillage solo como control de sesgo de dominio.**
Fondo uniforme de laboratorio: riesgo de atajo. Licencia CC BY-SA 3.0 según HF (GitHub sin LICENSE).

**D-023 · Afzaal se queda como experimento E4 en fresa.**
El enlace oficial de Dropbox está deshabilitado (2026-10-23); no se fuerza la descarga.

**D-024 · Hyperspectral no se descarga** (27,8 GB, 462 bandas, etiquetas por lote): fuera de alcance.

**D-025 · Thrip_Leaf bloqueado.**
El GPL-3.0 del repositorio no habilita los datos; prevalece el README, que es solo académico.

**D-026 · Particiones por grupos (union-find SHA-256 + dHash) y manifiestos versionados en `configs/splits/`.**
En fondos uniformes se usa umbral 0 de dHash, porque con umbral 4 hubo falsos positivos en PlantVillage.

**D-027 · Las cifras «80 %» y «50 % Botrytis» quedan en `claims_pending_verification.md`** y no se usan en el modelo ni en el pitch.

## 2026-10-23 (fase de entrenamiento, interrumpida por el límite de uso)

**D-028 · Candidatos nuevos investigados (no descargados):**
- Strawberry Hybrid: la API pública de Mendeley funciona sin credenciales. Hay dos variantes: `hybrid` (con 1.018 sintéticas DALL·E 3) y `traditional` (sin sintéticas). Las aumentadas llevan el prefijo `aug_` y los exports de Roboflow `.rf.`, así que se pueden agrupar por imagen base para evitar fugas. La API se queda en 1.000 archivos por carpeta y el zip completo devuelve 403 en S3. Pendiente: otra vía de descarga. Las bases provienen de Afzaal 2021 y Pérez-Borrero 2020. Licencia CC BY-NC 4.0.
- GreenHouse Annotations (Roboflow): 504 imágenes; clases Fungus_Gnats, Insects, Pea_Aphids, Spider_Mite, Thrips; CC BY 4.0; requiere ROBOFLOW_API_KEY.
- 64mp_thrip_bb: la página está tras un challenge de Cloudflare; no se pudo verificar.
- CT PestNet (HF, derivado de IP102): 75.222 imágenes, 102 clases (varias de trips, de campo), CC BY 4.0, 3,19 GB. Auxiliar para trips en primer plano, no en arándano.
- Tomato Disease (Mendeley c2x8rynybg): 1.026 imágenes con gray mold en tomate, cajas VOC, CC BY 4.0, 3,14 GB.
- Strawberry-MM-Straw5 (HF): 1.170 imágenes YOLO con gray_mold, más temperatura, HR y humedad del suelo por imagen; CC BY-NC-SA 4.0. Interesante para combinar imagen y ambiente.
- Mummy berry (Frontiers 2024, 927 imágenes de arándano): NO es público; «disponible por los autores». Hay que solicitarlo.
- Revista UPTC (enfermedades del arándano en Colombia): la página bloqueó la consulta con un control anti-bot. Pendiente.
- PRJNA984325: genómica de B. cinerea (Michigan); sin imágenes.
- PubMed 30722487 = Rivera, Zoffoli y Latorre (2013), Plant Disease, doi:10.1094/PDIS-12-12-1112-RE: riesgo de Botrytis en arándano con más de 6 h de humectación entre 14 y 25 °C; r = 0,96 con la incidencia en fruta almacenada; sin validación de campo. Base del futuro componente de riesgo ambiental, separado de la visión.

**D-029 · Entorno de entrenamiento.** El Python global tiene torch 2.9.0+cpu (sin CUDA). Hay una RTX 4050 de 6 GB (driver 596.49). Se lanzó la instalación de torch y torchvision cu126, más pandas, matplotlib, scikit-learn, ipykernel y nbconvert, SOLO en `vision/.venv`. Su resultado está pendiente de verificar.

## 2026-10-24 (fase de entrenamiento inicial)

**D-030 · Experimento auxiliar en fresa, explícitamente separado de arándano.**
DrBerry sigue bloqueado y no se simula. Strawberry Hybrid se descargó de la API pública de Mendeley (zip firmado, sha256 `cc1311b9…`) con `fetch_archive.py strawberry_hybrid`. Se usa solo la variante *traditional* (sin sintéticas).

**D-031 · Manifiesto unificado v1 (no destructivo).**
`data/processed/manifest_v1.csv` (completo, regenerable) y `manifests/manifest_v1_splits.csv` (versionado). Sintéticas identificadas por imagen base (1.018 = README; el hash `.rf.` de Roboflow cambia entre variantes, así que comparar nombres no sirve).

**D-032 · Particiones estratificadas por grupos.**
Grupo = imagen base (sin `aug_` ni `.rf.`) ∪ duplicados ∪ dHash ≤ 4. Las aumentadas van solo a train; las aumentadas de imágenes de evaluación quedan excluidas. Se descartó el split del autor: 360 grupos cruzan particiones y hay 314 aumentadas en valid/test.

**D-033 · Hallazgo: en fresa la clase sin síntomas está confundida con la fuente** (Pérez-Borrero frente a Afzaal).
Selección y análisis de FN por recall **condicionado entre enfermedades**. Para arándano, la clase sin síntomas debe venir del mismo dominio que las enfermas.

**D-034 · Desempate de F2 hacia el umbral más bajo.**
Con el desempate anterior (más alto) E4c_04 quedó con umbral 0,89 y en test un moho gris con P(enfermedad) = 0,873 quedó sin alerta. Se corrige la regla para experimentos futuros; **no** se reevalúa test (sería ajustar a posteriori). Al tocar `metrics.py`, el hash del código actual difiere del registrado en los `run_info.json` de E4c (`93dac9fd…`).

**D-035 · Seleccionado E4c_04_originals_ce** (solo validación, `selection.json`).
Empata con E4c_02 en los criterios principales; ganó por latencia (ruido). Test abierto una vez: recall condicionado 0,953, peor clase 0,75 (oídio en fruto).

**D-036 · Entorno.** torch 2.14.1+cu126 en `vision/.venv` (extra `train`); el Python global no se modifica.

## 2026-10-24 (banco de imágenes de arándano y datos propios)

**D-037 · Catálogo ampliado a 33 fuentes en `knowledge/datasets/blueberry_image_sources.yaml`**, que es la fuente única; la matriz y el manifiesto se generan con `build_source_tables.py`.
Las colecciones duplicadas o forks (PlantDoc estandarizado, Plant_Village_Blueberry, codelabs) no se cuentan como datos independientes.

**D-038 · `pry20220204-drberry` pasa a ser la prioridad 1 de DrBerry.**
633 imágenes, CC BY 4.0, y la muestra pública muestra cajas de LESIÓN y polígonos de hoja sobre hojas unidas a la planta. Si se confirma, la tarea pasa de clasificar hojas (D-018) a detectar lesiones. Sigue bloqueado por `ROBOFLOW_API_KEY`.

**D-039 · BlueberryDCM y Blueberry YOLO, descargados con MD5 verificado, como `DOMAIN_GENERALIZATION` (contexto de cultivo).**
Nunca son "sanas" ni sirven para entrenar enfermedades. En BlueberryDCM se usan las etiquetas VOC/VIA, porque las YOLO pierden la distinción visible/ocluido.

**D-040 · AgriVision (CC BY-NC-ND) no se descarga hasta consultar a los autores**; las galerías institucionales sin licencia (UBA, Rutgers, INIA) quedan solo como referencia visual.

**D-041 · Descargas verificadas.**
`acquisition.download` valida `Content-Length`, tamaño y MD5 publicados, y reintenta. La primera descarga de BlueberryDCM se truncó en silencio (789 KB de 107 MB).

**D-042 · Taxonomía de arándano con niveles de evidencia separados de la condición y de la tarea** (`blueberry_taxonomy.yaml`), esquema de captura de AGRAR (`contracts/agrar_capture_metadata.schema.json`) y validador con reglas del proyecto: `*_confirmed` exige experto o laboratorio, el daño de trips es siempre `suspected` y no se aceptan etiquetas derivadas del ambiente.

**D-043 · Riesgo ambiental implementado aparte** (`env_risk.py`, Rivera et al. 2013) con sustituto por HR declarado. Nunca es un diagnóstico ni actúa sobre la ventilación.

## 2026-10-24 (persistencia, simplificación de datos y Docker)

**D-044 · Solo dos fuentes autorizadas para el modelo** (`configs/data_sources.yaml`): DrBerry `pry20220204` como principal y Blueberry YOLO (Zhang) como complementaria, solo para evaluación de dominio. El resto del catálogo es investigación.

**D-045 · Diagnóstico de la "pérdida" de datos en Railway** (`docs/14`): los datos de visión nunca estuvieron en Git ni en la imagen (`.gitignore` de `vision/` y `.dockerignore` raíz de `main`). Ningún dato local se perdió; la copia de seguridad está en `hakatoon/_backups/`.

**D-046 · Bloqueo por hashes por archivo** (`manifests/data_lock/`) y preparación idempotente (`prepare_data.py`); rutas por `BERRYVISION_DATA_DIR` / `BERRYVISION_MODEL_DIR`; inferencia desde un artefacto con SHA-256 (`inference.py`), sin dataset; imagen Docker de solo inferencia con contexto en lista blanca.

**D-047 · Corrección: Blueberry YOLO tiene fuga en la partición del autor.** Sus 466 imágenes son recortes de 92 fotos y 37 cruzan particiones (D-039 decía 0 fugas: solo se habían mirado hashes). Se usa `manifests/splits/blueberry_yolo_zhang_groups.csv` (62/16/14 fotos).

**D-048 · El modelo auxiliar de fresa (E4c_04) alerta en el 85,2 % (IC 95 % 81,7–88,1) de las imágenes de campo de Zhang.** Confirma el cambio de dominio; no es una tasa de falsos positivos. La adaptación de dominio con Zhang no se integra hasta poder compararla con un modelo base de DrBerry en validación.
