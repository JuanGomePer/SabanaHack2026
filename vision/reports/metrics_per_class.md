# Métricas por clase — E4c_04_originals_ce (experimento auxiliar en FRESA)

> Generado por `scripts/report_metrics.py` a partir de los artefactos. **No son métricas de arándano ni del robot.**
> Código `93dac9fd03a79620` · manifiesto `71f6055289b4e2b6` · config `configs/experiments/aux_strawberry/E4c_04_originals_ce.yaml` · semilla 0 · mejor época 15.

## VAL — 453 imágenes originales

Exactitud 0.987 · exactitud balanceada (= recall macro) 0.978 · AUROC OvR macro 0.9991 / weighted 0.9994 / micro 0.9997 · mAP OvR macro 0.9901 · ECE 0.0173

### 8 clases (argmax)

| Clase | Soporte | TP | FN | FP | Recall | IC 95 % (Wilson) | Precisión | Especificidad | F1 | F2 |
|---|---|---|---|---|---|---|---|---|---|---|
| strawberry_asymptomatic | 86 | 86 | 0 | 0 | 1.000 | [0.96, 1.00] | 1.000 | 1.000 | 1.000 | 1.000 |
| strawberry_gray_mold | 71 | 67 | 4 | 2 | 0.944 | [0.86, 0.98] | 0.971 | 0.995 | 0.957 | 0.949 |
| strawberry_flower_blossom_blight | 31 | 31 | 0 | 0 | 1.000 | [0.89, 1.00] | 1.000 | 1.000 | 1.000 | 1.000 |
| strawberry_fruit_anthracnose_rot | 15 | 14 | 1 | 2 | 0.933 | [0.70, 0.99] | 0.875 | 0.995 | 0.903 | 0.921 |
| strawberry_fruit_powdery_mildew | 20 | 19 | 1 | 0 | 0.950 | [0.76, 0.99] | 1.000 | 1.000 | 0.974 | 0.960 |
| strawberry_leaf_angular_leafspot | 65 | 65 | 0 | 2 | 1.000 | [0.94, 1.00] | 0.970 | 0.995 | 0.985 | 0.994 |
| strawberry_leaf_powdery_mildew | 80 | 80 | 0 | 0 | 1.000 | [0.95, 1.00] | 1.000 | 1.000 | 1.000 | 1.000 |
| strawberry_leaf_spot | 85 | 85 | 0 | 0 | 1.000 | [0.96, 1.00] | 1.000 | 1.000 | 1.000 | 1.000 |

### Condicionado a enfermedad (análisis principal; sin la clase confundida con la fuente)

Recall macro 0.975 · peor clase 0.933

| Enfermedad | Soporte | Aciertos | FN (otra enfermedad) | Recall | IC 95 % |
|---|---|---|---|---|---|
| strawberry_gray_mold | 71 | 67 | 4 | 0.944 | [0.86, 0.98] |
| strawberry_flower_blossom_blight | 31 | 31 | 0 | 1.000 | [0.89, 1.00] |
| strawberry_fruit_anthracnose_rot | 15 | 14 | 1 | 0.933 | [0.70, 0.99] |
| strawberry_fruit_powdery_mildew | 20 | 19 | 1 | 0.950 | [0.76, 0.99] |
| strawberry_leaf_angular_leafspot | 65 | 65 | 0 | 1.000 | [0.94, 1.00] |
| strawberry_leaf_powdery_mildew | 80 | 80 | 0 | 1.000 | [0.95, 1.00] |
| strawberry_leaf_spot | 85 | 85 | 0 | 1.000 | [0.96, 1.00] |

## TEST — 453 imágenes originales

Exactitud 0.985 · exactitud balanceada (= recall macro) 0.959 · AUROC OvR macro 0.9993 / weighted 0.9996 / micro 0.9998 · mAP OvR macro 0.9915 · ECE 0.0090

### 8 clases (argmax)

| Clase | Soporte | TP | FN | FP | Recall | IC 95 % (Wilson) | Precisión | Especificidad | F1 | F2 |
|---|---|---|---|---|---|---|---|---|---|---|
| strawberry_asymptomatic | 86 | 86 | 0 | 0 | 1.000 | [0.96, 1.00] | 1.000 | 1.000 | 1.000 | 1.000 |
| strawberry_gray_mold | 71 | 71 | 0 | 5 | 1.000 | [0.95, 1.00] | 0.934 | 0.987 | 0.966 | 0.986 |
| strawberry_flower_blossom_blight | 31 | 31 | 0 | 0 | 1.000 | [0.89, 1.00] | 1.000 | 1.000 | 1.000 | 1.000 |
| strawberry_fruit_anthracnose_rot | 15 | 14 | 1 | 1 | 0.933 | [0.70, 0.99] | 0.933 | 0.998 | 0.933 | 0.933 |
| strawberry_fruit_powdery_mildew | 20 | 15 | 5 | 0 | 0.750 | [0.53, 0.89] | 1.000 | 1.000 | 0.857 | 0.789 |
| strawberry_leaf_angular_leafspot | 65 | 65 | 0 | 0 | 1.000 | [0.94, 1.00] | 1.000 | 1.000 | 1.000 | 1.000 |
| strawberry_leaf_powdery_mildew | 80 | 80 | 0 | 1 | 1.000 | [0.95, 1.00] | 0.988 | 0.997 | 0.994 | 0.998 |
| strawberry_leaf_spot | 85 | 84 | 1 | 0 | 0.988 | [0.94, 1.00] | 1.000 | 1.000 | 0.994 | 0.991 |

### Condicionado a enfermedad (análisis principal; sin la clase confundida con la fuente)

Recall macro 0.953 · peor clase 0.750

| Enfermedad | Soporte | Aciertos | FN (otra enfermedad) | Recall | IC 95 % |
|---|---|---|---|---|---|
| strawberry_gray_mold | 71 | 71 | 0 | 1.000 | [0.95, 1.00] |
| strawberry_flower_blossom_blight | 31 | 31 | 0 | 1.000 | [0.89, 1.00] |
| strawberry_fruit_anthracnose_rot | 15 | 14 | 1 | 0.933 | [0.70, 0.99] |
| strawberry_fruit_powdery_mildew | 20 | 15 | 5 | 0.750 | [0.53, 0.89] |
| strawberry_leaf_angular_leafspot | 65 | 65 | 0 | 1.000 | [0.94, 1.00] |
| strawberry_leaf_powdery_mildew | 80 | 80 | 0 | 1.000 | [0.95, 1.00] |
| strawberry_leaf_spot | 85 | 84 | 1 | 0.988 | [0.94, 1.00] |

### Alerta binaria al umbral congelado 0.89 (confundida con la fuente)

Recall 0.997 · precisión 1.000 · FN 1 · FP 0 · alertas por 100 imágenes 80.8

## Fuera de dominio (hojas de arándano; ninguna pertenece a las clases del modelo)

| Fuente | n | Confianza media | % con confianza ≥ 0,9 | % que dispara alerta | Clases predichas |
|---|---|---|---|---|---|
| plantvillage_blueberry_healthy | 1502 | 0.716 | 19.5 | 16.1 | {'strawberry_asymptomatic': 799, 'strawberry_fruit_powdery_mildew': 7, 'strawberry_leaf_angular_leafspot': 665, 'strawberry_leaf_powdery_mildew': 9, 'strawberry_leaf_spot': 22} |
| plantdoc_blueberry | 117 | 0.662 | 17.1 | 76.9 | {'strawberry_asymptomatic': 7, 'strawberry_gray_mold': 19, 'strawberry_fruit_anthracnose_rot': 23, 'strawberry_fruit_powdery_mildew': 22, 'strawberry_leaf_angular_leafspot': 31, 'strawberry_leaf_powdery_mildew': 10, 'strawberry_leaf_spot': 5} |
