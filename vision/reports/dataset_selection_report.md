# Informe de selección de datasets

Fecha: 2026-10-23 · Rama `Sofinu` · Sin commits ni push · Autoría: equipo + Claude Code
Convención: **[H]** fuente primaria · **[S]** fuente secundaria · **[L]** observación local (archivos descargados o páginas leídas) · **[I]** hipótesis · **[D]** decisión · **[P]** pendiente

Matriz: `dataset_selection_matrix.csv` (11 fuentes × 37 columnas). Catálogo: `../knowledge/datasets/catalog.yaml`. Taxonomía: `../knowledge/datasets/taxonomy.yaml`.

## 1. Resumen de decisiones

1. **[D] Primer modelo:** `blueberry_leaf_condition_v1`, que detecta hojas de arándano con su condición. Usa las cuatro clases de DrBerry: Alternaria, Oidio, Heliothis y Sana (renombrada `no_visible_symptoms`).
2. **[D] Núcleo:** DrBerry-Original-Data v1, comparado con drberry-gen-3-20 v1 antes de elegir. **Bloqueado** porque Roboflow exige una API key y no hay `ROBOFLOW_API_KEY` en el entorno.
3. **[D] Sin Botrytis ni trips en el primer modelo:** no hay datos de arándano verificados.
4. **[D] Descargas efectivas:** PlantDoc `Blueberry leaf` (117 imágenes) y PlantVillage `Blueberry___healthy` (1.502), ambas **auxiliares** y auditadas.
5. **[L] Afzaal no se pudo descargar:** el enlace oficial de Dropbox está deshabilitado temporalmente.
6. **[D] No se entrenó nada:** no se cumplen las condiciones previas (§9).

## 2. Ranking y papeles

El `rank` de la matriz es la **prioridad de preparación**: combina la puntuación (criterios del proyecto, no un resultado científico) con las condiciones excluyentes y la utilidad inmediata.

| # | Fuente | Puntos | Papel | Motivo principal |
|---|---|---|---|---|
| 1 | DrBerry-Original-Data v1 | 72 | **Núcleo inicial** | Único con enfermedades de hoja de arándano; pequeño, estirado y con caja ≈ hoja |
| 2 | drberry-gen-3-20 v1 | 72 | Núcleo (alternativo) | Mismas clases y sin estirar; relación con el original desconocida |
| 3 | drberry-gen-3 v1 | 69 | Auxiliar | 2.671 imágenes de procedencia no declarada; riesgo de fuga |
| 4 | Afzaal (fresa) | 58 | Investigación complementaria | Moho gris en fresa con polígonos; no disponible hoy |
| 5 | PlantDoc `Blueberry leaf` | 55 | Auxiliar | Variabilidad real, pero sin diagnóstico, con cajas incompletas y una fuga |
| 6 | PlantVillage `Blueberry___healthy` | 41 | Auxiliar | Sanas de laboratorio; solo para controlar el sesgo de dominio |
| 7 | PlantVillage aumentado (Mendeley) | 41 | Fuera de alcance | Aumentado y redundante |
| 8 | Plant_Village_Blueberry (derivado) | 39 | Fuera de alcance | Sin imágenes propias; 3.004 = 2 × 1.502 |
| 9 | Strawberry Hybrid | 51 | Investigación complementaria | NC, sintéticas DALL·E 3 |
| 10 | Thrip_Leaf | 44 | **Bloqueado** | Licencia solo académica, otra especie, acceso por correo |
| 11 | HyperspectralBlueberries | 42 | Fuera de alcance | Otra modalidad (462 bandas), frutos cosechados |

## 3. Respuestas a las preguntas de la fase

**Alternaria. ¿DrBerry original es accesible, pertinente y utilizable?**

- [H] Sigue publicado: v1 «data_original», 410 imágenes, split 327/40/43, cuatro clases, CC BY 4.0.
- [H] La versión aplica *Auto-Orient* y **«Stretch to 1024x1024»**: la descarga viene estirada.
- [L] La API devuelve «This method requires your API key», así que el acceso es reproducible, pero con cuenta.
- [L] La única muestra pública es una hoja **desprendida** sobre el sustrato, foto cenital de un Samsung SM-A307G a 2992×2992, y la caja cubre casi toda la hoja. Que esto valga para todo el dataset es una **hipótesis [I]** que verificarán los `box_stats`.
- ¿Basta para un baseline? Para un **baseline de clasificación de hojas** en su propio dominio, probablemente sí. Para detectar lesiones en el robot, **no**. Los conteos por clase están pendientes [P].
- Alternativa documentada: drberry-gen-3-20 v1 (585 imágenes, 408/116/61, sin preprocesamiento). [D] No se asume que sea idéntico: se descargan ambos y se comparan con `cross_dataset_duplicates`.

**Hojas sanas de arándano. ¿Sirve PlantVillage?**

- [L] 1.502 imágenes de 256×256, todas sobre fondo gris uniforme de laboratorio.
- [D] Solo como **auxiliar de control**: entrenar con "Sana" de DrBerry y evaluar si el modelo dispara con hojas de laboratorio, o al revés. No se mezcla como negativo, por el riesgo de atajo por fondo.
- [L] El derivado declara 3.004 sanas, exactamente el doble: posible doble conteo [I].

**Contexto real de campo. ¿Qué aporta PlantDoc?**

- [L] 117 imágenes de arándano y 849 cajas, una por hoja (mediana del área: 3,7 %), con 91 resoluciones distintas.
- Es la única fuente con plantas y ramas en entornos variados. Sus límites:
  - [L] La clase `Blueberry leaf` **no es "sana"**: la muestra revisada tiene hojas enrojecidas y una imagen se titula «iron-deficient».
  - [L] Hay hojas visibles sin caja.
  - [L] Hay **1 duplicado exacto entre train y test**.
  - [L] Incluye fotos de catálogos y anuncios.
- Licencia: CC BY 4.0 declarada, pero las fotos son de internet [H/L].
- [D] Papel: auxiliar, como "hoja de arándano de condición no especificada", y solo tras revisión manual.

**Botrytis cinerea. ¿Hay algún dataset visual de Botrytis en arándano?**

- **No.** Ninguna fuente seleccionada lo contiene, y la búsqueda no encontró uno público [S].
- `gray_mold` (Afzaal) y `Gray Mold` (Hybrid) son **fresa** y no equivalen a Botrytis en arándano.
- [D] El vacío se declara explícitamente. Plan de solicitud a AGRAR en §8; mientras tanto, Botrytis va como riesgo ambiental en un componente separado.

**Trips. ¿Se puede usar el dataset?**

- [H] El README limita el uso a investigación académica no comercial y prohíbe redistribuir, sublicenciar y modificar con fines no académicos. El GPL-3.0 del repositorio es la licencia del **código** y no habilita los datos.
- [H] El acceso es por contraseña pedida por correo, y no hay publicación citada.
- No es aplicable a arándano: otra especie, cámara de crecimiento y ~3 px por insecto con la RGB-D a 30 cm.
- [D] Queda fuera del primer entrenamiento. Haría falta autorización escrita de los autores para uso académico en la hackathon (nunca comercial) y, sobre todo, **imágenes propias de trips en arándano**, posiblemente con cámara macro o trampas cromáticas.

**HyperspectralBlueberries. ¿Utilidad inmediata?**

- **Ninguna.** [L] Cada escaneo mide 1600×1800 px con 462 bandas de 394 a 1011 nm, y las etiquetas van por lote de 42 frutos.
- [D] No se descargan los 27,8 GB; solo se inspeccionó un `.hdr` de 4 KB.

**Segmentación (fresa). ¿Qué se puede aprender?**

- Sirve para métodos: convertir polígonos a cajas, tratar objetos irregulares como el moho, y medir AP de máscara y de caja por tamaño.
- No aporta evidencia sobre arándano.
- Es el experimento E4, separado, cuando el enlace vuelva o haya credenciales de Kaggle.

## 4. Fuentes consultadas

Abiertas en esta fase:

- **DrBerry:** páginas de proyecto y de versión de original, gen-3-20 y gen-3.
- **Roboflow API**, sin key: error de autenticación.
- **Dataset Ninja** y el registro de dataset-tools 0.2.6.
- **Repositorios de GitHub** (API y CSV): PlantDoc (detección y clasificación), PlantVillage (spMohanty), Plant_Village_Blueberry, thrip_leaf_dataset y vicdxxx (código hiperespectral).
- **Zenodo**, API de 11200576.
- **Mendeley:** k2ptxmfjhj y tywbtsjrjv.
- **Ficha de Hugging Face** mohanty/PlantVillage.
- **Búsqueda web** sobre las cifras de Botrytis.

**No se pudieron abrir u obtener:**

- descarga de DrBerry (requiere key);
- Kaggle de Afzaal (requiere credenciales);
- el Dropbox de Afzaal (deshabilitado);
- los datos de Thrip_Leaf (contraseña);
- conteos por clase de DrBerry, que no son públicos sin key.

## 5. Auditoría de los datos descargados [L]

Comando: `python scripts/audit_local_datasets.py --root data/external/plantvillage_blueberry_healthy --root data/external/plantdoc_blueberry --samples 8`

| Métrica | PlantVillage `Blueberry___healthy` | PlantDoc `Blueberry leaf` |
|---|---|---|
| Ubicación | `data/external/plantvillage_blueberry_healthy/` (30 MB) | `data/external/plantdoc_blueberry/` (54 MB) |
| Procedencia | spMohanty@7f7ecc7e1e | pratikkayal/PlantDoc-Object-Detection-Dataset@4730a233a5 |
| Imágenes / ilegibles | 1.502 / 0 | 117 / 0 |
| Resolución | 256×256 (una sola) | 91 distintas |
| Anotación | ninguna (carpeta = clase) | `csv_boxes`: 849 cajas, 117 imágenes |
| Splits | sin split | train 106 / test 11 |
| Duplicados exactos | 0 | 1, y **cruza train/test** |
| Casi-duplicados (dHash ≤ 4) | 56 pares; 3 revisados = falsos positivos (fondo uniforme) | 0 |
| Área relativa de las cajas | — | mediana 0,037; p10 0,013; p90 0,127; 1,1 % ≥ 50 % |
| Entre datasets | 0 coincidencias | |
| Muestras visuales | — | 8 en `reports/audits/plantdoc_blueberry_samples/` (local, ignorado por Git) |

Particiones generadas: `configs/splits/plantdoc_blueberry_seed0.csv` (78/19/20, 0 fugas) y `configs/splits/plantvillage_blueberry_healthy_seed0.csv` (1067/221/214).

## 6. Licencias

| Fuente | Licencia de los datos | Hackathon | Producto AGRAR |
|---|---|---|---|
| DrBerry | CC BY 4.0 (Roboflow) | Sí, citando | Sí con atribución (verificar con los autores) |
| PlantDoc | CC BY 4.0 declarada; fotos de internet | Sí | Dudoso (derechos de terceros) |
| PlantVillage | CC BY-SA 3.0 (ficha de HF); GitHub sin LICENSE | Sí | Implica *share-alike*; revisar |
| Afzaal | CC BY 4.0; ~20 % de internet | Sí | Dudoso |
| Hybrid | **CC BY-NC 4.0** | Sí | **No** |
| Thrip_Leaf | Solo académico, sin redistribuir | Solo con permiso | **No** |
| Hyperspectral | CC BY 4.0 | Sí | Sí (pero inútil para RGB) |

## 7. Vacíos de datos

1. **Botrytis en arándano:** ninguna fuente.
2. **Trips en arándano:** ninguna fuente.
3. **Lesiones anotadas** en arándano (nivel de mancha): ninguna verificada.
4. **Imágenes del X2 Ultra:** cero.
5. **Conteos por clase de DrBerry:** pendientes de descarga.

## 8. Solicitud propuesta a AGRAR

> Para entrenar y validar la detección temprana necesitamos fotografías **confirmadas por un agrónomo** de: (1) Botrytis en flor y fruto de arándano, (2) Alternaria en hoja, (3) trips o su daño, y (4) plantas sin síntomas, de sus fincas o las de sus clientes. Por cada foto: fecha, finca, bloque, cama, órgano y criterio de confirmación. Además, autorización de uso para la hackathon (y, si aplica, para desarrollo posterior) y la posibilidad de una sesión de captura con el robot acompañados por su agrónomo. También necesitamos saber de dónde provienen las cifras «más del 80 %» y «50 % Botrytis» (ver `knowledge/claims_pending_verification.md`).

## 9. Antes del primer entrenamiento

- [ ] `ROBOFLOW_API_KEY` disponible en la sesión de un integrante.
- [ ] DrBerry original y gen-3-20 descargados, auditados y comparados.
- [ ] Decidir hoja o lesión según `box_stats` y revisión manual, y fijar los nombres de clase.
- [ ] Conteos por clase suficientes, o exclusión de las clases escasas.
- [ ] Split por grupos sin fugas, congelado.
- [ ] Decisión sobre la herramienta y su licencia (Ultralytics AGPL-3.0 o alternativa permisiva).
- [ ] `configs/experiments/e1_drberry_baseline.yaml` completado (manifiesto de split).

## 10. Plan del primer baseline

1. **E0:** descarga y auditoría de DrBerry (§9).
2. **E1:** detector ligero, `imgsz` 640, aumentación moderada que incluya compresión JPEG. Métricas por clase y por tamaño de caja, con galería de errores.
3. **E1c:** clasificador de recortes de hoja como control.
4. **E3:** 640 frente a 960 o 1280 y *tiling*, a la densidad simulada del X2.
5. **Control de dominio:** inferencia sobre PlantVillage y PlantDoc revisado. Mide la sensibilidad al fondo; no es una métrica de desempeño.
6. **E5:** test con imágenes del robot, en cuanto existan.

Ninguna métrica de los pasos 2 a 5 se presentará como desempeño en la finca.
