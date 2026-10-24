# Informe de experimentos — fase de entrenamiento inicial

Fecha: 2026-10-24 · Rama `Sofinu` · Sin commits ni push.

## 0. Qué se entrenó y qué NO

- **No se entrenó ningún modelo de arándano.** DrBerry, la única fuente con enfermedades de arándano, sigue bloqueada porque `ROBOFLOW_API_KEY` no está definida. No se simuló ni se sustituyó.
- Se entrenó el **experimento auxiliar E4c en FRESA** (8 clases de imagen completa, Strawberry Disease Detection *traditional augmentation*, CC BY-NC 4.0, uso académico). Su propósito es validar el pipeline completo con etiquetas reales de enfermedad: partición por grupos, red residual, pérdidas, optimizadores, umbrales, falsos negativos, test congelado y fuera de dominio.
- **Nada aquí es evidencia sobre Botrytis, Alternaria o trips en arándano, ni sobre la cámara del X2 Ultra.**

## 1. Entorno

| Elemento | Valor |
|---|---|
| Equipo | Windows 11, Python 3.11.9, RTX 4050 Laptop 6 GiB (cc 8.9) |
| Bibliotecas (`vision/.venv`) | torch 2.14.1+cu126, torchvision 0.29.1, scikit-learn 1.9.1 |
| Python global | sin tocar (torch CPU) |
| Datos | `data/processed/manifest_v1.csv`, sha256 `71f6055289b4e2b6…` |
| Código | hash del árbol `src/berryvision` registrado en cada `run_info.json` (no hay commits: el hash sustituye a la versión de Git) |

## 2. Diseño experimental (controlado: cada variante cambia un factor respecto a `_base.yaml`)

| ID | Cambia | Modelo / init | Datos de train | Pérdida | Optimizador | imgsz |
|---|---|---|---|---|---|---|
| E4c_00 | referencia sin transferencia | SmallCNN (4×Conv-BN-ReLU), aleatoria | orig + aug (3.197) | CE | AdamW 1e-3 | 224 |
| E4c_01 | *linear probe* | ResNet-18 congelada, ImageNet | orig + aug | CE | AdamW 1e-3 | 224 |
| E4c_02 | **base** | ResNet-18 ajuste fino, ImageNet | orig + aug | CE | AdamW 3e-4 | 224 |
| E4c_03 | optimizador | ídem | orig + aug | CE | SGD Nesterov 1e-2 | 224 |
| E4c_04 | datos | ídem | **solo originales (2.122, desbalance real)** | CE | AdamW 3e-4 | 224 |
| E4c_05 | pérdida | ídem | solo originales | **CE ponderada** (N/(K·n_c), [0,25, 4]) | AdamW | 224 |
| E4c_06 | pérdida | ídem | solo originales | **Focal γ=2** | AdamW | 224 |
| E4c_07 | resolución | ídem | orig + aug | CE | AdamW | **384** (lote 32) |
| E4c_08 | BatchNorm | ídem, **BN congelada** | orig + aug | CE | AdamW | 224 |

Comunes:

- semilla 0, scheduler coseno con 1 época de calentamiento, *weight decay* 1e-4, *dropout* 0,2;
- AMP fp16, lote 64, *early stopping* con paciencia 5 (8 en E4c_00), checkpoint por el recall macro de enfermedades en val;
- aumentación moderada: volteos, ±15°, color leve, JPEG 60–95 y desenfoque leve.

## 3. Resultados en VALIDACIÓN (453 originales; test sin abrir)

Salida de `scripts/select_experiment.py`, en `reports/experiments/selection.json`:

| ID | Recall macro condicionado entre enfermedades | Peor recall (clase) | Exactitud 8 clases | ECE | Mejor época | Minutos |
|---|---|---|---|---|---|---|
| E4c_02 AdamW CE | **0.982** | 0.933 (anthracnose) | 0.989 | 0.011 | 14 | 6.2 |
| E4c_07 384 px | 0.981 | 0.933 (anthracnose) | 0.993 | 0.012 | 14 | 18.4 |
| E4c_08 BN congelada | 0.977 | 0.933 (anthracnose) | 0.989 | 0.010 | 12 | 8.9 |
| **E4c_04 originales CE** | 0.975 | 0.933 (anthracnose) | 0.987 | 0.017 | 15 | 5.1 |
| E4c_06 originales Focal | 0.974 | 0.933 (anthracnose) | 0.985 | 0.027 | 15 | 7.2 |
| E4c_05 originales CE ponderada | 0.971 | 0.915 (gray_mold) | 0.982 | 0.021 | 8 | 8.0 |
| E4c_03 SGD | 0.970 | 0.915 (gray_mold) | 0.980 | 0.013 | 7 | 5.2 |
| E4c_01 linear probe | 0.897 | 0.676 (gray_mold) | 0.918 | 0.041 | 13 | 6.4 |
| E4c_00 SmallCNN | 0.875 | 0.650 (powdery fruit) | 0.918 | 0.040 | 17 | 10.0 |

Todas las variantes tienen **0 FN y 0 FP** en la alerta binaria al umbral elegido por F2: la tarea "enfermedad vs. sin síntomas" está confundida con la fuente (ver §5).

## 4. Lo que muestran las comparaciones (en validación, con cautela por el tamaño)

1. **La transferencia de aprendizaje importa.**
   - Ajustar la ResNet-18 completa (0,97–0,98) supera con claridad al *linear probe* (0,90) y a la CNN desde cero (0,88), cuyo peor recall cae a 0,65–0,68.
   - Las conexiones residuales y BatchNorm no son la causa aislada: la CNN pequeña también tiene BN. La diferencia viene de **preentrenamiento + capacidad + ajuste fino**.
2. **AdamW frente a SGD:** 0,982 frente a 0,970, con el mismo scheduler. La diferencia equivale a unas pocas imágenes y no es concluyente con este tamaño. Ninguno es "óptimo universal".
3. **Pérdidas con desbalance real** (solo originales): CE 0,975, Focal 0,974 y CE ponderada 0,971. **Ni la ponderación ni Focal redujeron los falsos negativos aquí.** Es coherente con que el desbalance de originales es moderado (97–574 por clase) y la red ya separa bien las clases mayoritarias. No se generaliza: con un desbalance severo, como el que se espera en arándano, hay que repetir la comparación.
4. **Aumentadas del autor frente a solo originales:** 0,982 frente a 0,975; no hay diferencia relevante. Las aumentadas cuestan más tiempo y no aportan evidencia clara.
5. **Resolución 384 frente a 224:** 0,981 frente a 0,982 en recall, con exactitud de 0,993 frente a 0,989; tarda unas 3 veces más (18 min frente a 6). **En fresa, con primeros planos de 640 px, subir la resolución no mejoró los FN.** Esto no responde la pregunta del robot (lesiones de pocos píxeles a 1280×720): ese es el experimento E3 pendiente con datos de arándano.
6. **BN congelada:** 0,977 frente a 0,982; no hay inestabilidad con lote 64, así que congelar BN no hizo falta en este régimen.
7. **Sobreajuste:** la pérdida de validación siguió bajando junto con la de train y el *early stopping* eligió épocas 12–15 (7–8 en SGD y CE ponderada). Las curvas están en `reports/figures/train_curves_all.png`. La pérdida de train se mide con aumentación y *dropout*, por lo que no es directamente comparable con la de validación.

## 5. Sesgo crítico descubierto: clase confundida con la fuente

El 100 % de `strawberry_asymptomatic` (574 originales) viene de Pérez-Borrero (2020, nombres numéricos) y el 100 % de las 7 enfermedades viene de Afzaal (2021). Hasta la CNN desde cero separa "enfermedad vs. sin síntomas" sin errores. Esa separación **no** demuestra reconocimiento de síntomas: por eso la selección y el análisis de FN se basan en el **recall condicionado entre enfermedades** (misma fuente).

Lección para arándano: la clase sin síntomas debe venir de las mismas fincas, cámaras y sesiones que las enfermas.

## 6. Selección y test

- **Regla** (fijada antes de ver resultados, `src/berryvision/training/selection.py`):
  1. recall macro condicionado;
  2. peor recall;
  3. FN de alerta;
  4. alertas por 100 imágenes;
  5. latencia.

  Las dos primeras se redondean a 0,01.
- **Seleccionado: E4c_04_originals_ce.** Empató con E4c_02 en los cuatro primeros criterios tras redondear y ganó por latencia (4,14 frente a 4,18 ms, una diferencia de ruido de medición). **Los modelos de cabeza son indistinguibles en validación**; no se cambió la regla después de verla.
- **Test** (abierto una sola vez, `scripts/evaluate_final.py`, umbral congelado 0,89):

| Métrica (test, 453 originales) | Valor |
|---|---|
| Exactitud / exactitud balanceada | 0.985 / 0.959 |
| Recall macro condicionado entre enfermedades | **0.953**; peor clase **0.750** (oídio en fruto, 15/20, IC 95 % [0,53, 0,89]) |
| Errores de test (argmax) | oídio fruto→moho gris ×4, oídio fruto→antracnosis ×1, antracnosis→moho gris ×1, mancha foliar→oídio hoja ×1 |
| AUROC OvR macro / mAP OvR macro / ECE | 0.9993 / 0.9915 / 0.009 |
| Alerta binaria @0,89 (confundida con la fuente) | recall 0.997, FN 1, FP 0. El FN es un moho gris **bien clasificado por argmax** pero con P(enfermedad)=0,873 < 0,89: lo provocó el umbral (ver §6 bis) |

Detalle por clase en `metrics_per_class.md`; errores en `error_analysis.md`.

## 6 bis. Lección sobre el umbral

El umbral 0,89 salió de un **empate en F2 = 1,0** en validación (todos los umbrales entre ~0,1 y 0,89 daban F2 perfecto) que la regla resolvía hacia el umbral **más alto**. En test, ese margen nulo produjo el único FN de alerta. Se cambió el desempate por defecto al umbral **más bajo** (`metrics.choose_threshold`, prueba `test_f2_ties_prefer_lowest_threshold_by_default`). **No se reevaluó test con la regla nueva** (sería ajustar a posteriori); aplica a experimentos futuros (D-034).

## 7. Fuera de dominio: el modelo de fresa ante hojas de arándano

| Fuente (ninguna es una clase del modelo) | Confianza media | ≥ 0,9 | Dispara alerta |
|---|---|---|---|
| PlantVillage (hojas sanas de laboratorio, 1.502) | 0,72 | 19,5 % | 16,1 % (665 predichas *angular leafspot*) |
| PlantDoc (hojas de arándano en escenas variadas, 117) | 0,66 | 17,1 % | **76,9 %** (*gray mold*, *anthracnose*…) |

Un clasificador cerrado siempre responde una de sus clases. **Sin un mecanismo de rechazo, el sistema generaría falsas alarmas masivas en un dominio nuevo.** Es un requisito para arándano (experimento P5 de `pending_experiments_before_deployment.md`).

## 8. Respuestas a las preguntas de la fase

| Pregunta | Respuesta con la evidencia actual |
|---|---|
| ¿Qué clases puede reconocer? | En fresa y en su dominio: las 7 enfermedades de Afzaal, con un recall en test de 0,75–1,00 |
| ¿Qué no puede reconocer todavía? | Ninguna enfermedad de arándano; Botrytis y trips en arándano no tienen datos |
| ¿Cuántos FN por clase? | Test: oídio en fruto 5/20, *anthracnose* 1/15, *leaf spot* 1/85, el resto 0 (`metrics_per_class.md`) |
| ¿Qué síntomas se escapan? | Oídio en fruto confundido con moho gris (4 de 5 FN; polvo blanco frente a micelio gris) |
| ¿En qué condiciones falla más? | Frutos con síntomas parecidos entre enfermedades; imágenes de otro dominio (arándano) → falsas alarmas |
| ¿Cómo cambia con la resolución? | En fresa (224 frente a 384) no cambia; pendiente en arándano con la densidad del robot |
| ¿Cómo se comporta con otras fuentes? | Mal: alerta en el 77 % de las hojas de PlantDoc |
| ¿Costo de bajar el umbral? | En fresa no hay compromiso visible por la confusión con la fuente; la curva está en `figures/threshold_sweep_selected.png` |
| ¿Datos adicionales? | `data_acquisition_plan_botrytis_thrips.md` |
| ¿Es útil en la finca? | **No hay evidencia.** No es un modelo de arándano y no se probó con imágenes del robot |

## 9. Reproducir

```bash
cd vision
python scripts/build_manifest.py --seed 0 --near-threshold 4
bash scripts/run_aux_experiments.sh                 # 9 experimentos, ~80 min en RTX 4050
python scripts/select_experiment.py                  # solo validación
python scripts/evaluate_final.py E4c_04_originals_ce --selected-because "..."   # una sola vez
python scripts/report_metrics.py
jupyter nbconvert --execute --inplace notebooks/0{1,2}_*.ipynb
```
