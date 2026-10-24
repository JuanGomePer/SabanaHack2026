> **HISTÓRICO (2026-10-23).** Primera comparación, hecha antes de descargar ningún dato. La **superan** `../../reports/dataset_selection_report.md`, `catalog.yaml` (v2) y `taxonomy.yaml`. Cambios principales: DrBerry original está estirado a 1024² y su caja parece cubrir la hoja; PlantDoc `Blueberry leaf` no es "sana"; Afzaal no está disponible temporalmente; las puntuaciones se recalcularon.

# Comparación y selección de datasets

Datos estructurados en `catalog.yaml`; matriz exportable en `../../reports/dataset_selection_matrix.csv`. Consulta: 2026-10-23. **Ningún dataset se ha descargado aún**, así que los conteos por clase, la calidad de etiquetas y las fugas siguen pendientes de auditoría local.

## Ranking (puntuación orientativa sobre 100)

| # | Dataset | Especie / órgano | Clases relevantes | Imágenes | Licencia | Total | Uso |
|---|---|---|---|---|---|---|---|
| 1 | DrBerry-Original-Data v1 | arándano / hoja | Alternaria, Oidio, Heliothis, Sana | 410 | CC BY 4.0 | 80 | **Principal (Alternaria)** |
| 2 | drberry-gen-3 v1 | arándano / hoja | ídem | 2.671 | CC BY 4.0 | 76 | Auxiliar, solo train |
| 3 | Afzaal (Strawberry Disease Detection) | fresa / hoja, fruto, flor | gray_mold (476 img / 598 obj) y 6 más | 2.500 | CC BY 4.0* | 63 | **Experimental: moho gris en fresa** |
| 4 | PlantDoc detección | 13 especies; arándano solo sano | Blueberry leaf (849 cajas) | 2.581 | CC BY 4.0* | 58 | Auxiliar: negativos sanos |
| 5 | Strawberry Hybrid Augmentation | fresa | Gray Mold y 7 más | 5.610 | **CC BY-NC 4.0** | 52 | Auxiliar académico |
| 6 | PlantVillage Blueberry___healthy | arándano / hoja de laboratorio | healthy | pendiente | variable | 46 | Auxiliar con cautela |
| 7 | Thrip_Leaf_Dataset | Spathiphyllum / hoja | Megalurothrips usitatus | 5.618 | **solo académico** | 46 | **Bloqueado** |
| 8 | HyperspectralBlueberries | arándano / fruto | normal, defective | 420 frutos | CC BY 4.0 | 43 | **Descartado** (modalidad) |

\* Licencia declarada, pero parte de las imágenes proviene de internet y sus derechos originales son inciertos.

La puntuación **no** anula las condiciones excluyentes: acceso no resuelto, licencia incompatible o ausencia de etiquetas válidas.

## Decisiones

1. **Primer experimento: DrBerry-Original-Data** (Alternaria, Oidio y Heliothis en hoja de arándano, más "Sana"). Es el único dataset del cultivo objetivo con enfermedades etiquetadas, licencia abierta y acceso razonable. Riesgos: solo 410 imágenes, un único origen geográfico y split desconocido.
2. **drberry-gen-3** solo se añade a entrenamiento después de demostrar con hashes y casi-duplicados que no contamina el test de DrBerry-Original-Data. Hipótesis: es una versión aumentada del original.
3. **Afzaal**: experimento separado de segmentación o detección de `gray_mold` **en fresa**. Su resultado se reporta como "en fresa", nunca como Botrytis en arándano.
4. **PlantDoc (Blueberry leaf)**: posible fuente de negativos de hoja sana en condiciones variadas, solo si el baseline muestra falsos positivos sobre hojas sanas.
5. **PlantVillage**: no se mezcla como clase "sana" en un detector cuyas enfermedades vienen de otra fuente, porque el modelo aprendería "fondo de laboratorio = sano".
6. **Thrips**: bloqueado por tres motivos independientes: acceso por correo, licencia solo académica sin modificación ni redistribución, y resolución marginal incluso con la RGB-D del X2 (~3 px por insecto a 30 cm en la imagen original de 1280×720).
7. **HyperspectralBlueberries**: descartado; ningún robot candidato tiene sensor hiperespectral.

## Vacíos de datos

| Vacío | Impacto | Plan |
|---|---|---|
| **No hay imágenes públicas de Botrytis en arándano** | No se puede afirmar detección visual de Botrytis en arándano | Capturar imágenes en fincas de AGRAR/clientes con etiquetado y revisión agronómica; mientras tanto, Botrytis se trata como **riesgo ambiental** (HR, agua libre, temperatura), separado de la visión |
| No hay trips sobre arándano | No se puede afirmar detección de trips | Evaluar cámara auxiliar macro; trampas cromáticas fotografiadas como alternativa (hipótesis) |
| Cero imágenes del robot | Toda métrica pública sobreestima el desempeño real | Grabar rosbags en un invernadero y etiquetar unos cientos de fotogramas como **test exclusivo** |
| DrBerry: distribución por clase y split desconocidos | Riesgo de desbalance y de fuga | Auditoría local |

## Taxonomía: no mezclar

Cada clase se registra con su taxonomía de origen (`blueberry_leaf/drberry-v1`, `strawberry/afzaal-2021`…). Esto implica:

- `Alternaria` de DrBerry ≠ cualquier clase de fresa.
- `gray_mold` (fresa) **no** se renombra como `Botrytis` ni se une con arándano.
- `Sana` (DrBerry), `Blueberry leaf` (PlantDoc) y `Blueberry___healthy` (PlantVillage) no se unen sin un experimento que mida el efecto del cambio de dominio.
- Por ahora no existe la clase `Unknown Visual Anomaly`: no hay una definición operativa ni datos que la respalden.

## Apto para experimento académico frente a producto comercial

| Dataset | Experimento hackathon | Producto comercial |
|---|---|---|
| DrBerry | Sí (citar) | Sí con atribución, previa verificación de licencia |
| Afzaal | Sí | Dudoso por las ~20 % imágenes de internet |
| PlantDoc | Sí | Dudoso (imágenes de internet) |
| Hybrid Augmentation | Sí | **No** (NC) |
| Thrip_Leaf | Solo con permiso de los autores | **No** |
| PlantVillage | Sí | Verificar licencia de la fuente concreta |
