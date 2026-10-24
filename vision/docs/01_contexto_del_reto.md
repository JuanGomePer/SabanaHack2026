# Contexto del reto: AGRAR Berry Good Idea (Sabana Hack 2026)

## Pregunta central

¿Cómo puede un robot inspeccionar un cultivo de arándanos cama por cama, identificar señales visuales compatibles con enfermedades o plagas, localizar cada hallazgo y generar una alerta documentada que ayude al responsable agronómico a inspeccionar a tiempo?

## Qué resuelve la visión por computadora

Convierte una imagen capturada por el robot en **hallazgos visuales con evidencia**: clase validada, región, confianza del modelo, imagen y versión del modelo. Junto con la ubicación (finca → bloque → nave → cama → posición), esto permite **priorizar la inspección humana**. No diagnostica, no prescribe y no actúa.

## Lo que ya tiene AGRAR (ver `../knowledge/agrar/README.md`)

- Ventilación y control climático para cultivos bajo cubierta (extractores, cortinas, controladores), con un enfoque preventivo contra Botrytis basado en HR y agua libre (fuente primaria S01).
- Según el equipo, sin verificar: sensores ambientales por cliente, Azure y Power BI.

El robot **complementa** a los sensores fijos: ve la planta, y los sensores miden el ambiente. Sus datos se guardan juntos, pero no se confunden.

## Objetivos fitosanitarios y realidad de los datos

| Objetivo | ¿Hay datos visuales en arándano? | Tratamiento en esta fase |
|---|---|---|
| Alternaria | Sí (DrBerry, 410 imágenes) | Clase visual candidata |
| Oidio, Heliothis | Sí (DrBerry) | Clases visuales candidatas (vienen en el mismo dataset) |
| Botrytis cinerea | **No** | Riesgo ambiental; experimento separado en fresa |
| Trips | No (solo en Spathiphyllum, con acceso restringido) | Bloqueado; marginal incluso con la RGB-D del X2 (~3 px a 30 cm) |

## Restricción funcional

**Solo informar.** El módulo no escribe en controladores ni en ventilación, no modifica el riego, no aplica tratamientos y no envía órdenes de movimiento al robot.
