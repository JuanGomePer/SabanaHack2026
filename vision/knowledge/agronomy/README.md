# Conocimiento agronómico (para el modelo, no para diagnosticar)

| Problema | Qué se ve | Factores ambientales | Datos visuales en arándano | Fuente |
|---|---|---|---|---|
| *Botrytis cinerea* (moho gris) | Moho gris en flores y frutos; daño visible a menudo en poscosecha | ~6 h de agua libre; 12–24 °C; HR alta (Sabana: 70–85 % de día, ~90 % de noche) | **Ninguno público** | S01 |
| *Alternaria* sp. | Manchas foliares | Condensación nocturna (nota del equipo; sin fuente primaria) | DrBerry (hoja) | D01, D03, S03 |
| Oidio | Polvo blanco en hojas | — | DrBerry (hoja) | D01 |
| Heliothis | Daño de larva en hoja | — | DrBerry (hoja) | D01 |
| Trips | Insecto de 1–2 mm (orden de magnitud) y raspado foliar | — | Ninguno en arándano | D06 |

## Reglas de interpretación

- **Anomalía visual** ≠ **condición ambiental de riesgo** ≠ **enfermedad confirmada**. Las tres viajan en campos distintos del contrato (`contracts/observation.schema.json`).
- Una HR alta no se convierte en una predicción de infección. Los umbrales de S01 son contexto, no reglas universales del modelo.
- Las notas del equipo "más del 80 % de los afectados" y "50 %" en Botrytis no tienen población ni definición. No se usan como estadística.
- El sistema solo informa. No recomienda tratamientos ni acciona ventilación.

## Preguntas para el agrónomo de AGRAR

1. ¿En qué órgano y fase aparece primero la Botrytis en sus arándanos (flor, fruto verde o maduro)?
2. ¿Pueden facilitar fotos etiquetadas de casos confirmados (Botrytis, Alternaria, trips) y el criterio de confirmación?
3. ¿Qué tamaño tiene una lesión "temprana" que justificaría una alerta?
