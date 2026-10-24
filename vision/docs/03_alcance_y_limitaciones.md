# Alcance y limitaciones

## Dentro del alcance (fase 1)

- Investigación, catálogo de fuentes y selección razonada de datasets.
- Auditoría local de datasets descargados legalmente (`scripts/audit_local_datasets.py`).
- Primer baseline de detección sobre DrBerry (fase 2, cuando la auditoría lo habilite).
- Contrato de salida de una observación (`contracts/observation.schema.json`).
- Protocolo de evaluación, incluido un test exclusivo con imágenes del robot.

## Fuera del alcance

- Control de ventiladores, controladores, riego o tratamientos (por diseño, nunca).
- Comandos de movimiento o navegación del robot.
- Diagnóstico agronómico definitivo.
- Integración de producción con Azure o Power BI sin interfaces documentadas.
- Crecimiento, fenología o madurez de la planta (el equipo lo excluyó).
- Fotogrametría o reconstrucción 3D: no es necesaria para localizar una mancha en la imagen.

## Lo que el prototipo podrá demostrar y lo que no

| Podrá demostrar (si los experimentos salen bien) | No podrá demostrar |
|---|---|
| Detección de Alternaria, Oidio y Heliothis en hojas de arándano **con imágenes de tipo DrBerry** | Detección de Botrytis en arándano |
| Flujo imagen → hallazgo → registro con ubicación declarada | Detección de trips |
| Moho gris en **fresa** (experimento aparte) | Desempeño en la cámara real del robot hasta capturar imágenes |
| Separación entre hallazgo visual y contexto ambiental | Probabilidad calibrada de infección |

## Limitaciones conocidas

1. **Resolución**: con la RGB-D del X2 a 1280×720, una lesión de 3 mm ocupa ~6 px a 30 cm, y ~3 px si se reduce a una entrada de 640 (`docs/02_robot_agibot_x2_ultra.md`).
2. **Cambio de dominio**: las fotos de celular de DrBerry no se parecen a las del robot.
3. **Tamaño**: 410 imágenes de un solo origen geográfico.
4. **Condensación**: el X2 declara operación entre -10 y 40 °C; su tolerancia a HR alta y condensación no está documentada (pendiente), y la HR nocturna en la Sabana llega a ~90 %.
5. **Bordes**: las detecciones en bordes de cama y en zonas lejanas de los sensores tienen contexto ambiental más incierto; el contrato guarda la distancia al sensor solo si se conoce.
6. **Profundidad**: no se usa en la primera versión (sin alinear con el RGB desde el SDK v1.1.0; ver `docs/10_profundidad_y_localizacion_3d.md`).
