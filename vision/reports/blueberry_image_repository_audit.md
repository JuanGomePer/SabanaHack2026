# Auditoría de repositorios de imágenes de arándano

Fecha: 2026-10-24 · Rama `Sofinu` · Sin commit ni push en esta fase.
Catálogo (fuente única): `knowledge/datasets/blueberry_image_sources.yaml` · Matriz: `blueberry_image_repository_matrix.csv` · Estado local: `manifests/public_image_sources.csv` (los tres se regeneran con `scripts/build_source_tables.py`).
Convención: **[H]** ficha o artículo verificado · **[L]** auditoría local de los archivos · **[I]** hipótesis · **[S]** afirmación de un buscador no verificada.

## 1. Resumen

- **33 fuentes** investigadas: 5 descargadas y auditadas, 10 con acceso pendiente, 1 por solicitar a los autores, 5 solo como referencia visual, 2 con licencia pendiente, 4 auxiliares no descargadas, 2 no aptas por modalidad, 3 descartadas y 1 verificada como referencia ambiental.
- **Descargas nuevas:** BlueberryDCM y Blueberry YOLO (Zhang). Son escenas reales de arbustos de arándano en campo, sin etiquetas de enfermedad. Papel: `DOMAIN_GENERALIZATION`, como contexto de cultivo y para medir falsas alarmas.
- **Sigue sin existir un dataset descargable de Botrytis en arándano con etiquetas fiables.** La única pista, «DiseaseDetector» de UT Tyler, es una afirmación de un buscador que no se pudo verificar [S].
- **La fuente más prometedora** para detección temprana en arándano es **`pry20220204-drberry`**: 633 imágenes, CC BY 4.0, y la muestra pública muestra **cajas de lesión y polígonos de hoja sobre hojas unidas a la planta** [H, 1 muestra]. Está bloqueada por `ROBOFLOW_API_KEY`.
- **Trips en arándano:** no hay ninguna fuente de imágenes etiquetadas. El dataset de trampas adhesivas de ILVO (CC BY 4.0) aún no publica los datos.

## 2. Qué se descargó realmente

Todo está en `data/external/`, ignorado por Git, y cada carpeta tiene su `ACQUISITION.json`.

| Fuente | Verificación | Auditoría [L] |
|---|---|---|
| **blueberry_dcm** (Zenodo 14002517, CC BY-NC 4.0) | 107.267.412 bytes, **MD5 igual al publicado**; extracción segura de 560 archivos | 140 imágenes legibles; 140 resoluciones distintas (smartphone); 0 duplicados y 0 casi-duplicados; 17.955 cajas de fruto en VOC (`Blue_occluded` 5.252, `Blue_visible` 1.722, `Unblue_occluded` 6.839, `Unblue_visible` 4.142); mediana del área de caja 0,03–0,06 % de la imagen |
| **blueberry_yolo_zhang** (Zenodo 14014858, CC BY 4.0) | 110.236.845 bytes, MD5 igual al publicado; 935 archivos | 466 imágenes (370/66/30); export de Roboflow «blueberry-twno8 v3», **sin aumentaciones**; 2 resoluciones (1094×1216 y 1200×1333; aspecto 0,9); 27.935 cajas (`blueberry_ripe` 19.935, `blueberry_green` 8.000); 0 duplicados exactos o casi exactos, **pero** son recortes de 92 fotos de origen y 37 cruzan las particiones del autor (fuga por procedencia, corregida el 2026-10-24 con `manifests/splits/blueberry_yolo_zhang_groups.csv`) |
| Entre fuentes | — | **0 duplicados exactos o casi-duplicados** entre BlueberryDCM, Blueberry YOLO y PlantDoc |
| (previas) PlantVillage, PlantDoc, Strawberry Hybrid | — | Sin cambios respecto a `dataset_quality_report.md` |

Hallazgos de calidad:

- **Las etiquetas YOLO de BlueberryDCM no coinciden con las VOC.** El `.txt` usa los identificadores 0 y 3 sin archivo de nombres, y los conteos (10.981 y 6.974) son la suma de las clases VOC: en YOLO **se pierde la distinción visible/ocluido**. Hay que usar las etiquetas VOC o VIA, que son las originales del autor.
- **La descarga inicial de BlueberryDCM se truncó en silencio** (789 KB de 107 MB). Se detectó al extraer, y ahora `download()` verifica `Content-Length`, el tamaño y el MD5 publicados, y reintenta. Hay una prueba que cubre este caso.
- **Revisión visual** (paneles locales): escenas reales de arbustos con hojas, ramas y frutos, fondo de suelo y vegetación, luz natural y sombras. Se parecen mucho más a la vista del robot que PlantVillage o DrBerry original.

## 3. DrBerry: versiones distintas, no un único dataset

| Proyecto | Imágenes | Versiones | Clases | Anotación (muestra pública) | Licencia | Estado |
|---|---|---|---|---|---|---|
| drberry/drberry-original-data | 410 | 1 | Alternaria, Heliothis, Oidio, Sana | caja ≈ **hoja completa**, hoja **desprendida** sobre el suelo, Samsung | CC BY 4.0 | ACCESO_PENDIENTE |
| **pry20220204-drberry/enfermedades-en-hojas-de-arandanos** | **633** | **20** | **11**: Alternaria, Dano/Daño por Alternaria, Daño por Heliothis (grande/pequeño), Daño por Oídio, Heliothis, Hoja de arandano, Oídio, Oídio grande | **polígonos de hoja + cajas de LESIÓN**, hoja **en la planta**, Huawei 3120² | CC BY 4.0 | ACCESO_PENDIENTE (**prioridad 1**) |
| codelabs/drberry-leaf-detection-3hptt | 633 base (v1 = 1.647 aumentadas) | 3 | Dano por Alternaria/Heliothis/Oidio, Hoja de arandano | — (versiones tras Cloudflare) | CC BY 4.0 | ACCESO_PENDIENTE; **probable fork** del anterior [I] |
| drberry/drberry-gen-3-20 | 585 | 1 | 4 | caja grande | CC BY 4.0 | ACCESO_PENDIENTE |
| drberry/drberry-gen-3 | 2.671 | 1 | 4 | — | CC BY 4.0 | ACCESO_PENDIENTE |

Conclusiones:

- Los proyectos **no son equivalentes**. Las dos colecciones de 633 imágenes **no deben contarse como independientes** hasta comparar hashes.
- Los nombres de clase de `pry20220204` son **inconsistentes** (duplicados con y sin «ñ», tamaños «grande/pequeño»): hace falta un mapeo explícito y revisión.
- Si la auditoría con más imágenes confirma las cajas de lesión, **la tarea pasa de clasificar hojas a detectar lesiones** (cambia la decisión D-018).

## 4. Botrytis cinerea

| Fuente | Qué es | Utilidad |
|---|---|---|
| UBA Herbario Virtual | 28 imágenes, la mayoría **microscópicas** (conidios y conidióforos); sin autoría por foto; «© FAUBA», copia protegida | Solo referencia visual; pedir permiso |
| INIA Uruguay 2014; INIA Chile Boletín 48 cap. 7 | Guías técnicas en PDF con descripción de síntomas | Guía de anotación (citando) |
| Foods 2023 (Liu et al.) | Detector de anomalías **hiperespectral** en fresa y arándano; la clase «infected» no es específica de Botrytis según el resumen | No apta (otra modalidad) |
| HyperspectralBlueberries | Defectos de fruto, hiperespectral | No apta |
| Rivera et al. 2013 | Modelo de **riesgo ambiental** (> 6 h de humectación a 14–25 °C) | `ENVIRONMENTAL_RISK_REFERENCE` (implementado en `src/berryvision/env_risk.py`) |
| PRJNA984325 | Genómica | Descartada para visión |
| Mummy berry (Qu et al. 2024) | 927 imágenes de arándano (flor, hoja, fruto) con *Monilinia*, **no Botrytis** | Pedir a los autores; dominio de arándano y severidad |
| «DiseaseDetector» UT Tyler | Clase «blueberry botrytis blight», según un buscador | **No verificada** |

**Vacío confirmado:** no hay imágenes RGB de Botrytis en arándano con etiqueta confirmada a las que podamos acceder. La vía es **AGRAR** (`agrar_blueberry_data_request.md`) y, en paralelo, solicitudes a autores e instituciones (`data_requests/`).

## 5. Alternaria

Solo DrBerry y sus versiones, todas pendientes de la API key. La vía más valiosa es `pry20220204`, por sus posibles cajas de lesión. No hay otras fuentes públicas verificadas de Alternaria en arándano.

## 6. Trips: tres tareas separadas

| Tarea | Fuentes | Estado |
|---|---|---|
| 1. Insecto sobre arándano | **ninguna** | Vacío. Rutgers documenta *Frankliniella tritici* en flor y *Scirtothrips* en hoja joven (solo referencia) |
| 2. Daño compatible | **ninguna** etiquetada | Vacío. Según Rutgers, el daño se parece a deficiencias y enfermedades, así que la etiqueta debe ser `suspected` |
| 3. Trampa adhesiva | ILVO (CC BY 4.0, 4.000 cajas, 42 MP) | ACCESO_PENDIENTE: el Zenodo solo tiene el README, anunciado para septiembre de 2026 |
| Auxiliar | GreenHouse Annotations (clase *Thrips*, 504 imágenes, API key), 64mp_thrip_bb (Cloudflare), CT PestNet (IP102, 3,19 GB), Monash (microscopio, 678 MB), Thrip_Leaf (licencia restrictiva) | No descargadas: otra especie o soporte; no prueban detección en arándano |

Con la RGB-D del X2, un trips de ~1,5 mm ocupa ~3 px a 30 cm (`docs/02` §5). La tarea 1 probablemente requiere una cámara macro o trampas.

## 7. Contexto de cultivo y fuentes bloqueadas por licencia

- **AgriVision** (Scientific Data 2025): 1.195 imágenes con 51.145 frutos (DB-1), 141 mil fotogramas y 10 mil sintéticas. Es **CC BY-NC-ND 4.0**: la cláusula ND puede impedir distribuir modelos o datos derivados. Queda en **LICENCIA_PENDIENTE** y no se descarga sin consultar a los autores.
- **AerialYield-B2D** (arXiv 2026): 514 imágenes con 30.195 máscaras de madurez; CC0 según el registro de arXiv, pero sin enlace de datos localizado. ACCESO_PENDIENTE.
- **PlantDoc estandarizado** y **Plant_Village_Blueberry** son la misma colección que las originales: descartados como fuentes independientes.

## 8. Clasificación para el entrenamiento

| Papel | Fuentes |
|---|---|
| `PRIMARY_TRAINING` | pry20220204-drberry, drberry-original-data (ambos bloqueados) |
| `AUXILIARY_TRAINING` | codelabs, gen-3-20, gen-3 (tras deduplicar); GreenHouse, 64mp, ILVO (trips, pendientes); Strawberry Hybrid, Tomato, Straw5, CT PestNet (otros cultivos) |
| `DOMAIN_GENERALIZATION` | **BlueberryDCM, Blueberry YOLO** (descargados), PlantDoc, PlantVillage (control), Mummy berry y AerialYield (pendientes) |
| `VISUAL_REFERENCE_ONLY` | UBA, INIA Uruguay, INIA Chile, Rutgers |
| `ENVIRONMENTAL_RISK_REFERENCE` | Rivera et al. 2013 |
| `BLOCKED_BY_LICENSE_OR_ACCESS` | AgriVision (ND), Thrip_Leaf, DiseaseDetector (no localizado) |
| `NOT_RELEVANT_TO_CURRENT_TASK` | HSI (Foods 2023, HyperspectralBlueberries), PRJNA984325, duplicados, Monash, ViT de cucurbitáceas |

**Ninguna fuente nueva entra al conjunto principal de enfermedades.** Las de contexto se usarán para medir falsas alarmas en escenas reales de arándano y para estudiar fondos y oclusiones, nunca como «sanas».

## 9. Qué bloquea cada adquisición

| Bloqueo | Fuentes | Qué lo resuelve |
|---|---|---|
| `ROBOFLOW_API_KEY` | 5 versiones de DrBerry, GreenHouse, 64mp | Un integrante define la variable en su sesión |
| Datos bajo solicitud | Mummy berry | `data_requests/request_mummy_berry_authors.md` |
| Licencia | AgriVision (ND), Thrip_Leaf, UBA | Consulta escrita (`data_requests/request_institutions.md`) |
| Publicación pendiente | ILVO trampas, AerialYield | Revisar o escribir a los autores |
| Inexistencia pública | Botrytis y trips en arándano | **AGRAR** (`agrar_blueberry_data_request.md`) y captura propia (`blueberry_collection_protocol.md`) |
