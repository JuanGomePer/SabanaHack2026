# Informe de calidad de datos (manifiesto v1.0.0)

Fecha: 2026-10-24 · Rama `Sofinu` · Fuente: `notebooks/01_dataset_eda_and_preprocessing.ipynb` (ejecutado) y `manifests/manifest_v1.meta.json`.
Convención: **[L]** observación local automática · **[M]** confirmado manualmente sobre una muestra · **[I]** hipótesis · **[D]** decisión.

## 1. Manifiesto unificado

| Elemento | Valor |
|---|---|
| Script | `scripts/build_manifest.py --seed 0 --near-threshold 4` |
| Completo (no versionado) | `data/processed/manifest_v1.csv`, 7.228 filas, sha256 `71f6055289b4e2b6…` (idéntico en dos reconstrucciones: determinista) |
| Vista versionada | `manifests/manifest_v1_splits.csv` (identidad, etiqueta canónica, grupo, partición, exclusión) |
| Campos | fuente y versión, ruta original, SHA-256, dHash, tamaño, cultivo, órgano, etiqueta original y canónica, tarea, tipo de anotación, nº de instancias, cajas normalizadas o referencia COCO, split original, imagen base, grupo, partición, aumentada, sintética, estado de revisión, licencia, uso permitido, motivo de exclusión |

## 2. Inventario [L]

| Fuente | Imágenes | Instancias | Anotación | Resolución | Papel |
|---|---|---|---|---|---|
| `plantvillage_blueberry_healthy` | 1.502 | 1.502 | etiqueta de imagen | 256×256 | control de dominio |
| `plantdoc_blueberry` | 117 | 849 | cajas de hoja | 91 distintas | auxiliar (revisión manual) |
| `strawberry_traditional` | 4.591 | 8.693 | polígonos de lesión/órgano | 640×640 (reescaladas por el autor) | experimento auxiliar E4c |
| `strawberry_hybrid_synthetic` | 1.018 | — | — | 640×640 | **excluidas** (DALL·E 3) |

Ninguna imagen ilegible. Duplicados exactos: 1 en PlantDoc (train↔test), 0 entre fuentes.

## 3. Hallazgos de calidad

| # | Hallazgo | Tipo | Consecuencia |
|---|---|---|---|
| Q1 | **El split publicado de Strawberry Hybrid tiene fuga**: 360 grupos (imagen base + aumentaciones/casi-duplicados) cruzan train/valid/test y hay 314 aumentadas en valid/test | [L] | Métricas sobre el split original estarían infladas; se rehace la partición |
| Q2 | **La clase `strawberry_asymptomatic` viene 100 % de otra fuente** (nombres numéricos, Pérez-Borrero 2020) y las 7 enfermedades 100 % de Afzaal 2021 | [L] (por patrón de nombre) | "Enfermedad vs. sin síntomas" está confundida con la fuente; solo las confusiones entre enfermedades son interpretables |
| Q3 | El equilibrio de ~700 por clase es artificial: originales desde 97 (*anthracnose*) hasta 574 | [L] | Experimentos con originales solamente para estudiar el desbalance real |
| Q4 | Nombres inconsistentes entre variantes (`Healthy` vs `Asymptomatic`; errata `Powderly`) | [M] | Mapeo explícito a clases canónicas |
| Q5 | 6 imágenes multiclase y una categoría `fruit` (Pérez-Borrero) | [L] | Excluidas de la clasificación de imagen completa |
| Q6 | Sintéticas identificadas por imagen base ausente en *traditional* (1.018, = README) | [L] | Excluidas de cualquier partición |
| Q7 | Grupos de hasta 9 imágenes base casi idénticas (fotos consecutivas, p. ej. `blossom_blight179…186`) | [L] dHash ≤ 4 | Se mantienen juntos (237 de 2.688 grupos tienen >1 base) |
| Q8 | PlantDoc: hojas decoloradas etiquetadas igual, cajas incompletas | [M] muestra | `needs_manual_review`; nunca "sana" |
| Q9 | PlantVillage: 56 pares dHash ≤ 4 = falsos positivos por fondo uniforme | [M] 3 pares | Umbral 0 en esa fuente |
| Q10 | Brillo, saturación y nitidez difieren entre fuentes | [L] 150 imágenes por fuente | Una fuente por tarea; identidad de fuente conservada |

## 4. Partición final (sin fugas) [L]

`strawberry_traditional`: train 3.197 (originales + aumentadas del autor) · val 453 · test 453 (solo originales) · 488 excluidas (482 aumentadas de imágenes de evaluación, 6 multiclase). **0 grupos compartidos; 0 aumentadas o sintéticas en evaluación**, comprobado con aserciones en el notebook 01 §12, que además verifica 25 hashes.

| Clase | train | val | test |
|---|---|---|---|
| asymptomatic | 402 | 86 | 86 |
| blossom_blight | 402 | 31 | 31 |
| anthracnose_rot | 383 | **15** | **15** |
| powdery_mildew (fruto) | 408 | 20 | 20 |
| gray_mold | 399 | 71 | 71 |
| angular_leafspot | 407 | 65 | 65 |
| powdery_mildew (hoja) | 397 | 80 | 80 |
| leaf_spot | 399 | 85 | 85 |

Con 15–20 originales en val/test, el recall por clase tiene intervalos amplios: se reporta con IC 95 % de Wilson.

## 5. Exclusiones (no destructivas, registradas en el manifiesto)

Solo por: aumentadas de imágenes de evaluación, imágenes multiclase, sintéticas. **Ninguna** por ser rara o difícil. Los originales no se modifican.

## 6. Lo que este informe no puede evaluar

- La calidad de DrBerry: bloqueado por la API key.
- La correspondencia con las imágenes del robot: no hay capturas.
- La corrección agronómica de las etiquetas, que requiere un fitopatólogo.
