# AGRAR Ingeniería: contexto verificado y supuesto

## Verificado

- Agrar Ingeniería SAS, Zipaquirá (Km 1 vía Zipaquirá–Ubaté, Parque Industrial Zuma), fundada el 2013-02-23, ~15 empleados (S02).
- Distribuidor autorizado de Vostermans Ventilation. Ofrece extractores, cortinas motorizadas y controladores para cultivos bajo cubierta en la Sabana de Bogotá (flores, berries, hortalizas) (S01).
- Su enfoque frente a Botrytis es preventivo: controlar la HR y el agua libre mediante ventilación (S01).

## Reportado por el equipo, sin verificar (S03)

- Ecosistema con sensores ambientales (número y ubicación según cliente), controladores locales conectados a ventiladores, Azure y Power BI.
- "Trips": ambiguo. Puede ser el insecto (thrips) o un sistema. **Hay que preguntarlo.**
- Geometría orientativa: bloques de ~0.5 ha, ~8 naves por bloque, ~3 camas por nave, camas de decenas de metros, ~2.500 plantas por 0.5 ha. Varía por cliente; no se codifica en el modelo.
- Los sensores pueden fallar o ser poco representativos en bordes y zonas alejadas.

## Jerarquía espacial que usa el contrato

Finca → bloque → nave (`greenhouse_id`) → cama (`bed_id`) → posición aproximada.

## Preguntas abiertas para AGRAR

1. ¿Qué expone Azure (API, base de datos, IoT Hub) y con qué credenciales y contratos de datos?
2. ¿Cómo se identifican los sensores y qué frecuencia, variables y marcas de tiempo tienen?
3. ¿Existe un mapa de camas con identificadores que el robot pueda usar?
4. ¿Hay red Wi-Fi en los invernaderos?
