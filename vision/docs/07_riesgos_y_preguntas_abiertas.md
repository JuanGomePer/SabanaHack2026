# Riesgos y preguntas abiertas

## Bloqueantes

| # | Pregunta | Quién responde | Qué desbloquea |
|---|---|---|---|
| 1 | Variante exacta (X2 Ultra o Ultra nueva versión), firmware y **versión del SDK** de nuestra unidad | Organizadores / inspección en PC2 | Contenedor obligatorio (≥ v1.2.0) o no; topics vigentes |
| 2 | `rgb_camera_info` real: resolución, K, D, `distortion_model`; formato del comprimido; Hz; QoS | `inspect_rgbd_interfaces.sh` en PC2 | Preprocesamiento definitivo |
| 3 | ¿640 de entrada alcanza para lesiones tempranas? (~3 px para una lesión de 3 mm a 30 cm tras letterbox) | E3 + capturas reales | `imgsz` o recortes; viabilidad de "temprana" |
| 4 | Distancia mínima de enfoque del color de la Gemini 335 y distancia real cabeza–planta en las camas | Prueba en campo | Escala de los objetivos |
| 5 | ¿Hay imágenes de Botrytis en arándano de AGRAR o sus clientes? | AGRAR | Cualquier afirmación sobre Botrytis visual |
| 6 | ¿"Trips" es el insecto o un sistema de AGRAR? | AGRAR / equipo | Alcance |

## Bloqueantes de datos (fase de selección)

| # | Bloqueo | Qué lo resuelve |
|---|---|---|
| D1 | Sin `ROBOFLOW_API_KEY`: DrBerry (núcleo) sin descargar, sin conteos por clase y sin entrenamiento | Un integrante crea una cuenta gratuita y define la variable **en su sesión** |
| D2 | ¿Las cajas de DrBerry son hojas o lesiones? (1 muestra: hoja) | `box_stats` + revisión manual tras la descarga |
| D3 | Enlace oficial de Afzaal deshabilitado | Reintentar o usar Kaggle con credenciales propias |
| D4 | Sin imágenes de Botrytis ni de trips en arándano | Solicitud a AGRAR (informe de selección §8) |
| D5 | Cifras «80 %» y «50 %» sin fuente | AGRAR (`knowledge/claims_pending_verification.md`) |

## Riesgos de modelo descubiertos al entrenar (experimento auxiliar en fresa)

| # | Riesgo | Evidencia | Mitigación pendiente |
|---|---|---|---|
| M1 | Clase confundida con la fuente → métricas infladas | En fresa, sin síntomas = Pérez-Borrero, enfermedades = Afzaal; alerta perfecta incluso con una CNN desde cero | La clase sin síntomas de arándano debe venir del mismo dominio que las enfermas |
| M2 | Falsas alarmas masivas fuera de dominio | Alerta en el 77 % de hojas de arándano de PlantDoc | Rechazo / fuera de distribución (P5) evaluado por separado |
| M3 | Errores con confianza ≥ 0,98 | 2 errores de test | Calibración + revisión humana; no confiar solo en la confianza |
| M4 | Confusión moho gris ↔ oídio en fruto | 4 FN de oídio en fruto en test | Datos reales de Botrytis y oídio en arándano confirmados |
| M5 | Umbral sin margen | FN de alerta con P = 0,873 < 0,89 | Desempate hacia el umbral bajo (hecho) + punto de operación acordado con AGRAR |
| M6 | Varianza por pocas imágenes | Oídio en fruto: 0,95 en val y 0,75 en test, con 20 imágenes | ≥ 35–40 positivos por clase en test |

## Importantes

- Acceso a PC2: credenciales SSH (soporte técnico), quién autoriza y en qué ventana. Nunca se guardan en el repositorio.
- Versión de TensorRT montada en el contenedor de PC2, que determina dónde se construye el engine.
- Carga que ya soporta PC2 por el SDK: la latencia y memoria del detector se miden en la unidad.
- Tolerancia del X2 a HR alta y condensación (la ficha solo da -10 a 40 °C) y autonomía (~2 h caminando según la ficha) en pasillos de invernadero.
- Licencia AGPL-3.0 de Ultralytics si el prototipo pasa a producto (D-008).
- Discrepancia de QoS: la HAL documenta RELIABLE y los ejemplos compartidos usan *best effort*.
- Interfaces de Azure y Power BI, ids de sensores y mapa de camas.

## Riesgos de seguridad operativa (mitigados por diseño)

| Riesgo | Mitigación |
|---|---|
| Ejecutar algo en PC1 | `safety.assert_not_pc1`, comprobación en los scripts bash y `compute_unit: PC2` validado; verificación manual previa obligatoria |
| Saturar la red o PC2 con flujos crudos | RGB comprimido por defecto; flujos crudos solo en PC2 |
| Congestión DDS con el robot en pie | No lanzar varios nodos a la vez; inspección con comandos de una sola consulta |
| Pérdida de datos al actualizar firmware | Datos fuera de `$HOME/aimdk*` y copiados fuera del robot tras cada sesión |
| Filtrar la calibración de fábrica | Solo lectura; `.gitignore` bloquea `*factory_calib*` |

## Datos de las notas que no se usan como hechos

- "Más del 80 % de los afectados": sin población, enfermedad ni periodo.
- "50 %" en Botrytis: sin definición.
- Dimensiones de la finca: orientativas y distintas en cada cliente.
