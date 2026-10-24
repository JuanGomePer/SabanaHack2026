# Adquisición y auditoría de datos

## Principios

- Antes de descargar: comprobar tamaño, estructura y licencia; descargar solo lo que tiene un papel asignado (`11_dataset_strategy.md`).
- Todo va a `vision/data/external/<id>/`, ignorado por Git. Cada descarga deja `ACQUISITION.json` con URL, commit o versión, fecha, licencia, cita y SHA-256 por archivo o del archivo comprimido.
- Los archivos descargados son datos no confiables: se extraen en su propio directorio, rechazando rutas absolutas, `..` y enlaces (`berryvision.acquisition.safe_extract`), y nunca se ejecuta nada de su interior.
- Credenciales solo desde variables de entorno (`ROBOFLOW_API_KEY`, `GITHUB_TOKEN` opcional). El manifiesto rechaza campos con *key*, *token* o *secret*.
- Si el servidor devuelve HTML en vez del archivo (enlace caído), se aborta sin dejar archivos parciales.

## Scripts

| Script | Fuentes | Estado 2026-10-23 |
|---|---|---|
| `scripts/acquire/fetch_github_subset.py plantvillage_blueberry_healthy` | PlantVillage `raw/color/Blueberry___healthy`, commit fijado | **Ejecutado**: 1.502/1.502, 30 MB |
| `scripts/acquire/fetch_github_subset.py plantdoc_blueberry` | PlantDoc detección, solo `Blueberry leaf` + CSV filtrados con `local_filename` | **Ejecutado**: 117/117, 54 MB |
| `scripts/acquire/fetch_archive.py afzaal_strawberry` | Export de Dataset Ninja (URL del registro de dataset-tools 0.2.6) | **Falló limpio**: Dropbox «Link Temporarily Disabled» |
| `scripts/acquire/fetch_roboflow.py <ws> <project> <version> <formato>` | DrBerry (y cualquier versión de Roboflow) | **No ejecutado**: falta `ROBOFLOW_API_KEY` |

Detalles de Windows resueltos:

- nombres con `?` no permitidos;
- colisiones por mayúsculas (`blueberry-leaf.jpg` frente a `Blueberry-leaf.jpg`).

Ambos se resuelven con nombres locales `NNNNN__<nombre>` y `file_map.csv` (ruta de origen → ruta local).

## Auditoría (`scripts/audit_local_datasets.py`)

Solo lectura. Para cada dataset genera `reports/audits/<id>.json` y `<id>_images.csv`, ignorados por Git. Comprueba:

- imágenes legibles o ilegibles, extensión, modo de color, resoluciones y relaciones de aspecto;
- splits detectados por ruta (`train/valid/test`);
- duplicados exactos (SHA-256) y casi-duplicados (dHash de 64 bits, Hamming ≤ umbral);
- **fugas entre splits**;
- formatos YOLO (cajas y polígonos), COCO, LabelMe, Supervisely, VOC y CSV de cajas: clases, instancias, **imágenes por clase y por split**, coincidencia imagen↔etiqueta;
- `box_stats`: área relativa de las cajas por clase. Una mediana alta indica que se anotó la hoja o la imagen, no la lesión;
- indicios de imágenes sintéticas por nombre y variantes `.rf.` de Roboflow (aumentación);
- con `--samples N`, imágenes con las cajas dibujadas para revisión **local** (no se republican);
- con varios `--root`, coincidencias **entre datasets** (`cross__a__b.json`).

Comando ejecutado:

```bash
python scripts/audit_local_datasets.py --root data/external/plantvillage_blueberry_healthy \
       --root data/external/plantdoc_blueberry --samples 8
```

Resultados en `../reports/dataset_selection_report.md` §5.

Limitación conocida: en fondos uniformes (PlantVillage) el dHash con umbral 4 marca hojas distintas como casi-duplicadas (56 pares, 3 revisados: falsos positivos). En esos datasets se usa umbral 0 o revisión manual.

## Particiones (`scripts/make_group_splits.py`)

Union-find sobre duplicados exactos y casi-duplicados, más una clave de grupo opcional (planta o sesión). La asignación es determinista por semilla. Los manifiestos `configs/splits/*.csv` (solo rutas) se versionan.

| Manifiesto | Resultado |
|---|---|
| `plantdoc_blueberry_original.csv` | Split original 106/11: **1 grupo atraviesa train/test (fuga)** |
| `plantdoc_blueberry_seed0.csv` | 78/19/20 por grupos, 0 fugas |
| `plantvillage_blueberry_healthy_seed0.csv` | 1067/221/214, umbral 0, 0 fugas |

## Pasos para DrBerry (cuando haya API key)

```bash
# en la sesión del integrante; nunca en archivos del repo
export ROBOFLOW_API_KEY=...            # PowerShell: $env:ROBOFLOW_API_KEY="..."
python scripts/acquire/fetch_roboflow.py drberry drberry-original-data 1 yolov8
python scripts/acquire/fetch_roboflow.py drberry drberry-gen-3-20 1 yolov8
python scripts/audit_local_datasets.py --root data/external/drberry-original-data_v1_yolov8 \
       --root data/external/drberry-gen-3-20_v1_yolov8 --samples 12
python scripts/make_group_splits.py reports/audits/drberry-original-data_v1_yolov8_images.csv \
       --out configs/splits/drberry_original_original.csv --respect-original
```

Decidir con la evidencia de esa auditoría:

1. Conteo por clase y por split.
2. `box_stats`: ¿hojas o lesiones?
3. Solapamiento entre versiones.
4. Fugas en el split original.
5. Revisión manual de unas 50 imágenes por clase.
