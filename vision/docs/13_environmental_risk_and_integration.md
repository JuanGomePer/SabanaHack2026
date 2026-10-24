# Riesgo ambiental e integración con sensores de AGRAR (separado de la visión)

## Principio

Dos evidencias distintas que **nunca se mezclan en una etiqueta**:

| Evidencia | Pregunta | Componente | Salida |
|---|---|---|---|
| Visual | ¿Qué se ve en esta planta? | modelo de visión (`berryvision.training`) | hallazgo visual con confianza y ubicación |
| Ambiental | ¿Las condiciones favorecen la infección? | `berryvision.env_risk` | **evento de riesgo** por sensor y periodo; nunca un diagnóstico |

La alerta que vea el usuario puede **mostrar ambas juntas** (hallazgo visual en la cama C2 + riesgo ambiental del sensor más cercano), pero cada una conserva su fuente, su hora y su incertidumbre.

## Qué se implementó (sin datos reales de AGRAR)

- `src/berryvision/env_risk.py`:
  - eventos de riesgo de Botrytis según Rivera, Zoffoli y Latorre (2013): **más de 6 h de humectación entre 14 y 25 °C**;
  - usa el sensor de humectación foliar si existe; si no, **HR ≥ 90 % como sustituto declarado (`proxy_rh`), no validado**;
  - un hueco de datos rompe la continuidad del periodo; `data_gaps()` lista los huecos por sensor;
  - pruebas con series sintéticas en `tests/test_capture_and_env.py`.
- `contracts/agrar_capture_metadata.schema.json` y `capture_metadata.py`: cada lectura ambiental unida a una imagen guarda sensor, hora, distancia y calidad. Se marca como desactualizada si está a más de 2 h de la captura.
- Contrato de observación v0.2.0 (`contracts/observation.schema.json`): `environmental_context` como lista de lecturas con sensor y fecha.

## Qué NO sabemos todavía (preguntas a AGRAR)

| Pregunta | Por qué importa |
|---|---|
| ¿Qué variables miden sus sensores (T, HR, humectación foliar, punto de rocío) y con qué frecuencia? | El algoritmo necesita humectación; HR es solo un sustituto |
| ¿Cómo se identifican los sensores y dónde están respecto a las camas? | Atribuir una lectura a una planta exige distancia o zona |
| ¿Qué expone Azure (API, base de datos, IoT Hub) y Power BI (solo visualización)? ¿Con qué credenciales y permisos de **solo lectura**? | Integración sin tocar controladores |
| ¿Se registra el estado y la duración de la ventilación? | Contexto (no se controla) |
| ¿Hay historial de incidencias de Botrytis por cama y fecha? | Única forma de validar el modelo de riesgo localmente |

## Restricciones

- Solo lectura de datos ambientales. **Prohibido** escribir en controladores, encender o apagar ventiladores, o recomendar acciones automáticas.
- Una condición favorable **no** convierte una imagen en `botrytis_confirmed` (lo rechaza el validador).
- El umbral de humedad relativa y la ventana de temperatura son hipótesis de la literatura chilena. Antes de afirmar utilidad, hay que validarlos con datos de AGRAR (Sabana de Bogotá).
