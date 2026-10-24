# Resumen ejecutivo: módulo de visión

**Qué resolverá.** Convertir imágenes del **AgiBot X2 Ultra** en hallazgos visuales con evidencia y ubicación para priorizar la inspección agronómica humana. Solo informa: no actúa sobre ventilación, riego ni el robot.

**Plataforma (desde 2026-10-23).**

- Robot: AgiBot X2 Ultra; el Booster K1 queda descartado.
- Cámara: RGB-D frontal Orbbec Gemini 335.
- Inferencia prevista en **PC2** (Jetson Orin NX 16 GB, 157 TOPS), dentro del contenedor.
- **PC1 (10.0.1.40) está prohibido**, y el módulo lo bloquea por código.

**Estado.**

- Hecho y probado (48 pruebas): investigación, **selección de datasets** (`11_dataset_strategy.md`), adquisición y auditoría reproducibles (`12`), particiones por grupo, configuración `configs/x2_vision.yaml` validada, preprocesamiento (letterbox y CameraInfo), lector de calibración de solo lectura, guardia de PC1, contrato v0.2.0 y scripts de inspección y captura.
- **Sin acceso al robot todavía:** no se ha leído `CameraInfo` ni la calibración, ni se ha capturado nada.
- **Datos:** descargados y auditados PlantVillage `Blueberry___healthy` (1.502) y PlantDoc `Blueberry leaf` (117), ambos auxiliares. **DrBerry (núcleo) está bloqueado por falta de `ROBOFLOW_API_KEY`**, y Afzaal por un enlace de Dropbox deshabilitado. No hay modelos entrenados.

**Fase de entrenamiento (2026-10-24):** manifiesto unificado con particiones sin fugas; **experimento auxiliar en FRESA** (9 variantes; seleccionado ResNet-18). En test, recall condicionado entre enfermedades de 0,953, con el peor caso en el oídio en fruto (0,75), confundido con moho gris. Hallazgos: el split publicado de fresa tiene fuga, la clase sin síntomas está confundida con la fuente, y el modelo dispara alerta en el 77 % de hojas de arándano ajenas. **No hay modelo de arándano.** Ver `../reports/experiment_report.md`.

**Hallazgos que cambian decisiones:**

1. La HAL documenta el RGB a **1280×720 rgb8, 30 Hz**, y el comprimido en **MJPEG**. La profundidad está a 1280×720 16UC1 (mm), **sin sincronizar ni alinear** con el RGB desde el SDK v1.1.0.
2. Con la RGB-D, una lesión de 3 mm a 30 cm ocupa ~6 px, unas 2,9 veces más que con el K1. **Pero con `imgsz=640` queda en ~3 px.** E3 decide entre 640, 1280 o recortes.
3. Sigue sin existir un dataset público de Botrytis en arándano; trips sigue bloqueado (licencia y especie). El primer modelo será `blueberry_leaf_condition_v1`: **hojas** de arándano con Alternaria, Oidio, Heliothis o sin síntomas visibles (DrBerry). DrBerry original v1 está **estirado a 1024²** y su caja parece cubrir la hoja, no la lesión.
4. PlantDoc `Blueberry leaf` **no** es "sana" (hojas decoloradas, cajas incompletas, 1 fuga train/test).
5. QoS documentada como **RELIABLE**, no *best effort*; suscribirse solo desde PC2; contenedor obligatorio desde el SDK v1.2.0.

**Siguiente paso:** definir `ROBOFLOW_API_KEY` en la sesión de un integrante → descargar y auditar DrBerry original y gen-3-20 (`12`) → E1. En paralelo: acceso a PC2 para la inspección, y pedir a AGRAR imágenes confirmadas (informe de selección §8).

Detalle: `../reports/dataset_selection_report.md` (datos), `../reports/x2_update_report.md` (actualización X2) y `../reports/initial_research_report.md` (investigación inicial).
