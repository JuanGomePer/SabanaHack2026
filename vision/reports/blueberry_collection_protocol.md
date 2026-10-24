# Protocolo de captura y curación de datos propios de AGRAR (arándano)

Complementa `docs/09_captura_datos_x2.md` (procedimiento técnico con el robot). Metadatos: `contracts/agrar_capture_metadata.schema.json`, validados por `src/berryvision/capture_metadata.py`. Taxonomía: `knowledge/datasets/blueberry_taxonomy.yaml`.

**Condiciones previas:**

- Autorización de AGRAR y de la finca.
- Captura con el X2 solo en PC2 y con el robot quieto u operado por personal autorizado.
- **Nunca en PC1**; ningún comando de movimiento desde este módulo.
- Se aceptan también fotos de celular de AGRAR, pero se registran con su `camera_id`, porque son **otro dominio**.

## 1. Matriz de cobertura (mínimos orientativos por sesión de campo)

| Condición | Órganos | Evidencia buscada | Mínimo orientativo de imágenes independientes* |
|---|---|---|---|
| Botrytis | flor, fruto verde y maduro, cáliz, brote | `suspected` en campo; parte `expert_confirmed` o `lab_confirmed` | 40 confirmadas para test + las de entrenamiento |
| Alternaria | hoja (manchas pequeñas), fruto | ídem | 40 confirmadas |
| Trips | flor, hoja joven; trampa adhesiva | insecto visible (si la resolución lo permite) / daño `suspected` / trampa | por tarea, no se mezclan |
| Parecidos (negativos difíciles) | todos | mummy berry, antracnosis, oídio, Heliothis, deficiencias, quemadura, daño mecánico, senescencia | 20 por tipo |
| Sin síntomas visibles | los mismos órganos | `no_visible_symptoms` | **igual o mayor** que los positivos, **en las mismas camas y sesiones** |
| Difíciles | — | sombra, contraluz, desenfoque, oclusión, bordes de cama | ≥ 15 % del total |

\* Con unos 40 positivos independientes el IC 95 % de un recall de ~0,9 tiene ±10 puntos. «Independiente» significa planta o sesión distinta, no fotogramas consecutivos.

**Si una enfermedad no tiene positivos confirmados, el vacío se documenta y se prioriza conseguirlos.** No se rellena con imágenes de otro cultivo.

## 2. Comparabilidad entre positivos y negativos (lección D-033)

- Para cada positivo, capturar al menos un **negativo pareado**: misma cama, sesión, cámara, distancia aproximada y franja de luz.
- Prohibido que todos los sanos vengan de una fuente o cámara y todos los enfermos de otra. El notebook 03 lo comprueba con la tabla de clase por cámara y sesión.
- Distinguir `no_visible_symptoms` de `confirmed_healthy`. Solo el segundo implica evaluación especializada.

## 3. Variabilidad con la cámara del robot

| Factor | Valores a cubrir |
|---|---|
| Distancia cabeza–planta | ~0,15 / 0,30 / 0,50 m (lo que permita el enfoque) |
| Vista | frontal, lateral, superior (pitch de cabeza si aplica) |
| Altura relativa | tercio inferior, medio y superior del arbusto |
| Luz | sol directo, nublado, sombra, contraluz; artificial si existe |
| Movimiento | quieto; en marcha **solo** si es seguro y autorizado |
| Fondo y densidad | camas densas y ralas, pasillo, estructura del invernadero |

Reglas:

- Se guarda la **imagen original completa sin reescalar**: el comprimido MJPEG tal cual, y el crudo solo en PC2 si se autoriza.
- Se registra en cada sesión el `CameraInfo` real, la resolución, el *encoding*, la versión del SDK y la fecha. No se inventan intrínsecos ni se toca la calibración de fábrica.

## 4. Calidad de las etiquetas

- Niveles de evidencia: `lab_confirmed` > `expert_confirmed` > `suspected`, más `no_visible_symptoms`, `confirmed_healthy` y `unknown`. Nunca se fusionan.
- Cada anotación lleva `labeled_by`, `labeled_at` y `review_round`. Si es `*_confirmed`, también un bloque `confirmation` (método, quién, fecha y referencia de informe). El validador lo exige.
- **Muestra para confirmar:** pedir a AGRAR que un especialista confirme al menos el 20–30 % de los positivos (por ejemplo, con cámara húmeda o aislamiento para Botrytis). El resto queda como `suspected`.
- **Doble anotación** de un 10–20 % aleatorio, para medir el acuerdo (kappa de Cohen por clase) antes de entrenar.

## 5. Registro espacial y ambiental

- **Ubicación:** finca → bloque → nave → cama → planta o posición; incluye si la imagen está en el borde de la cama.
- **Ambiente:** cada lectura conserva sensor, hora y distancia aproximada a la planta. La antigüedad se calcula, no se supone. Una lectura a más de 2 h de la captura no puede quedar marcada como `ok` (lo verifica el validador).
- **Prohibido** derivar una etiqueta visual del ambiente. El riesgo ambiental (`env_risk.py`) es un componente aparte que nunca diagnostica.

## 6. Almacenamiento y curación

```text
data/raw/agrar/<farm_id>/<session_id>/
    images/            originales sin reescalar (MJPEG/JPEG)
    camera_info.yaml   CameraInfo real de la sesión
    session.yaml       operador, robot/SDK, condiciones
    captures.jsonl     una línea por imagen (esquema agrar_capture_metadata)
```

- Todo `data/raw/agrar/` está fuera de Git y es confidencial. En el repositorio solo entran código, esquemas y estadísticas agregadas autorizadas.
- Antes de entrenar:
  - SHA-256 y dHash con `audit_local_datasets.py`;
  - duplicados, también entre fuentes;
  - casi-duplicados agrupados por sesión y planta (`make_group_splits.py`, `group_key` = sesión o planta);
  - validación de cajas con `capture_metadata.validate_capture`.
- **Test congelado por sesión** antes del primer entrenamiento con datos propios.
- Las aumentaciones solo se aplican en entrenamiento, nunca en validación ni test.

## 7. Herramienta de anotación

Ver `annotation_guide.md`. **CVAT** es la preferida si hay servidor (cajas y polígonos, revisión y exportación COCO). **Label Studio** es la alternativa si se necesita integrar los metadatos de evidencia como campos de formulario. En ambos casos se mantiene una versión maestra en COCO con historial de correcciones.
