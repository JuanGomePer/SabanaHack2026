# Estrategia de datos (fase de selección, 2026-10-23)

Detalle y evidencia en `../reports/dataset_selection_report.md`; datos en `../knowledge/datasets/catalog.yaml` y `taxonomy.yaml`.

## 1. Qué entrenaremos primero

**Modelo `blueberry_leaf_condition_v1`**: detección de **hojas de arándano y su condición visible**, con las cuatro clases de DrBerry:

- `blueberry_leaf_alternaria`
- `blueberry_leaf_powdery_mildew`
- `blueberry_leaf_heliothis_damage`
- `blueberry_leaf_no_visible_symptoms`

La fuente es **DrBerry** (núcleo), comparando la versión original v1 con gen-3-20 v1 antes de elegir.

Esto es más modesto que "detectar lesiones":

- La muestra pública de DrBerry sugiere que las cajas encierran la **hoja completa**. Si la auditoría lo confirma, el modelo localiza hojas con síntomas, no manchas.
- Las fotos son de **hojas sueltas** sobre el suelo, con celular y de cerca. El robot verá plantas en pie a 15–50 cm. La validez en el robot solo se medirá con imágenes del X2 (`09_captura_datos_x2.md`).

**Estado: BLOQUEADO** hasta que alguien del equipo defina `ROBOFLOW_API_KEY` en su sesión. La key **no** se guarda en archivos. Mientras tanto no se entrena nada.

## 2. Qué NO podemos afirmar todavía

| Capacidad | Por qué no |
|---|---|
| Detección de Botrytis en arándano | No hay ningún dataset visual verificado; `strawberry_gray_mold` no equivale a Botrytis en arándano |
| Detección de trips en arándano | Datos bloqueados por licencia, de otra especie y a ~3 px por insecto con la cámara del robot |
| Localización de lesiones (manchas) | Ningún dataset de arándano verificado anota lesiones |
| Desempeño en la finca o en el robot | Cero imágenes del X2 |
| Probabilidad de infección | `confidence` no está calibrada ni es diagnóstica |

## 3. Papeles de cada fuente

| Papel | Fuentes |
|---|---|
| **Núcleo inicial** | DrBerry-Original-Data v1; drberry-gen-3-20 v1 (alternativa, tras comparar) |
| **Auxiliar** | drberry-gen-3 v1 (solo train, tras deduplicar); PlantDoc `Blueberry leaf` (hoja de condición no especificada, revisión manual); PlantVillage `Blueberry___healthy` (solo control de sesgo de dominio) |
| **Investigación complementaria** | Afzaal (segmentación de moho gris en fresa, E4); Strawberry Hybrid (aumentación; NC) |
| **Bloqueado** | Thrip_Leaf_Dataset |
| **Fuera de alcance inicial** | HyperspectralBlueberries; Plant_Village_Blueberry (derivado, posible doble conteo); PlantVillage aumentado de Mendeley |

## 4. Reglas de combinación

1. Una clase canónica no mezcla cultivo, órgano, condición ni nivel de anotación (`taxonomy.yaml`).
2. PlantVillage **no** se usa como negativos en el mismo modelo. El fondo gris de laboratorio permitiría aprender "fondo uniforme = sano".
3. PlantDoc `Blueberry leaf` **no** se trata como "sana": la auditoría encontró hojas decoloradas y una con deficiencia de hierro, además de cajas incompletas.
4. Fresa y Spathiphyllum no entran en el modelo de arándano.
5. Se aplican aumentaciones e imágenes sintéticas solo en train, nunca en validación ni test.
6. No se crea una clase `other_or_unknown`: sin definición ni datos, sería ruido. La incertidumbre se gestiona con umbrales y revisión humana.

## 5. Tarea, tamaño de entrada y particiones

- **Tarea:** detección (DrBerry trae cajas), con un **control de clasificación** sobre recortes de hoja (E1c). Si las cajas resultan ser hojas completas, el control dirá si la detección aporta algo más que "encontrar la hoja y clasificarla".
- **No** se convierten etiquetas de imagen en cajas de imagen completa para luego afirmar que el modelo localiza lesiones.
- **Tamaño de entrada:** 640 sigue como nominal, sin declararlo óptimo. E3 compara 640, 960 o 1280 y recortes (*tiling*), midiendo el recall por tamaño de caja en px y la latencia. Una entrada mayor cuesta más cómputo en PC2.
- **Particiones:** `scripts/make_group_splits.py` agrupa duplicados exactos y casi-duplicados y asigna grupos completos. Con DrBerry hay que comparar además su split original (327/40/43) contra la versión de grupos. Las imágenes del robot se reservan para el test, separadas **por sesión**.

## 6. Plan para cerrar el vacío de Botrytis (y de trips)

Solicitud a AGRAR, con plantilla en el informe §8:

- fotos de casos confirmados por un agrónomo (Botrytis en flor y fruto; Alternaria; trips), con fecha, finca, cama y criterio de confirmación;
- permiso de uso para la hackathon y, por separado, para un uso futuro;
- acompañamiento en una sesión de captura con el X2 según `09`.

Mientras tanto, Botrytis se trata como **riesgo ambiental** (HR, agua libre, temperatura), en un componente separado de la visión.
