# Análisis de falsos negativos y errores — E4c_04 (FRESA, auxiliar)

Fuentes: `reports/experiments/E4c_04_originals_ce/{val,test}_predictions.npz`, notebook 02 §15–17. Los paneles con imágenes de terceros están en `reports/figures_local/` (local, no versionado). **No son errores en arándano.**

## 1. Definiciones usadas

| Término | Definición |
|---|---|
| FN de clase | imagen de la enfermedad X que el modelo asigna a otra clase |
| FN de alerta (**el más costoso**) | imagen con cualquier enfermedad cuya P(enfermedad) = 1 − P(sin síntomas) queda por debajo del umbral, así que no se emitiría alerta |
| Error de diagnóstico | se emite alerta, pero con la enfermedad equivocada (costo menor: alguien revisa, pero la etiqueta engaña) |
| FP de alerta | imagen sin síntomas que dispara alerta |

## 2. Test (abierto una vez, 453 originales, umbral congelado 0,89)

| Real → predicho | n | Confianza de la predicción | P(clase real) | Tipo |
|---|---|---|---|---|
| oídio en fruto → moho gris | 4 | 0,50 / 0,52 / 0,985 / 0,996 | 0,22 / 0,47 / 0,006 / 0,002 | diagnóstico equivocado |
| oídio en fruto → antracnosis | 1 | 0,73 | 0,15 | diagnóstico equivocado |
| antracnosis → moho gris | 1 | 0,56 | 0,19 | diagnóstico equivocado |
| mancha foliar → oídio en hoja | 1 | 0,986 | 0,004 | diagnóstico equivocado |
| **moho gris → (sin alerta)** | 1 | argmax correcto; P(enfermedad) 0,873 < 0,89 | — | **FN de alerta causado por el umbral** |

Lectura:

- **Patrón dominante: el oídio en fruto se confunde con moho gris.** Es la confusión más relevante para AGRAR, porque Botrytis produce justamente moho gris: entre síntomas blancos o grises en fruto, el modelo no discrimina bien con 20 ejemplos de evaluación y ~135 originales de oídio en fruto.
- **Dos errores con confianza ≥ 0,98**: el modelo puede equivocarse con mucha seguridad. Un umbral de confianza no basta para detectar estos errores.
- **El único FN de alerta lo causó el umbral** (empate de F2 resuelto hacia el umbral alto) y no la clasificación. La regla ya se corrigió para el futuro (D-034) y el test no se reevaluó.
- La **exactitud de 0,985 oculta** que una clase tiene un recall de 0,75. Por eso se reporta por clase con IC: con 20 imágenes, el IC 95 % de ese recall es [0,53, 0,89].

## 3. Validación (453 originales)

Errores entre enfermedades:

- moho gris → mancha angular ×2 y → antracnosis ×2;
- oídio en fruto → moho gris ×1;
- antracnosis → moho gris ×1.

**El moho gris aparece en 6 de los 6 errores de validación**, como origen o como destino. En test el oídio en fruto rindió peor que en validación (0,75 frente a 0,95): con 20 imágenes por clase la varianza es alta, y los intervalos se solapan.

## 4. Condiciones de fallo observadas (revisión de paneles locales, no confirmada por agrónomo)

- Frutos con micelio o polvo superficial poco desarrollado, donde los síntomas de oídio, moho gris y antracnosis se parecen.
- Lesiones pequeñas o en zonas parciales del fruto.
- Imágenes de internet o con encuadre distinto al de invernadero (~20 % de Afzaal).

No se confirmó ningún error de etiqueta: requiere revisión fitopatológica.

## 5. Falsas alarmas fuera de dominio (el riesgo operativo mayor)

El modelo de fresa ante hojas de arándano emite alerta en el **77 % de las hojas de PlantDoc** y en el **16 % de las hojas sanas de PlantVillage**; 665 de esas 1.502 hojas sanas las predice como *angular leafspot*. Con confianza ≥ 0,9 están el 17–20 % de las imágenes ajenas. Un clasificador cerrado no sabe decir "no sé". Antes de cualquier uso hace falta:

1. un modelo entrenado con arándano;
2. un mecanismo de rechazo o de detección de fuera de distribución, con su propia evaluación (P5);
3. la evaluación con imágenes del robot.

## 6. Qué haría falta para reducir estos FN (hipótesis para arándano)

| Problema | Acción | Evidencia necesaria |
|---|---|---|
| Confusión entre síntomas blancos o grises en fruto | Más ejemplos reales de Botrytis y de oídio en arándano, confirmados; recortes de fruto a mayor resolución | Imágenes de AGRAR (plan en `data_acquisition_plan_botrytis_thrips.md`) |
| Errores con confianza alta | Calibración por temperatura y rechazo por fuera de distribución, evaluados por separado | Conjunto de validación del dominio real |
| Umbral sin margen | Desempate hacia el umbral bajo (ya implementado) y punto de operación acordado con AGRAR (alertas aceptables por cama y día) | Costos de AGRAR |
| Pocas imágenes por clase | Test con ≥ 35–40 positivos independientes por clase | Captura por sesiones |
