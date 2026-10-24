# Booster K1: registro de evidencia (DESCARTADO)

> **Histórico.** El 2026-10-23 el equipo confirmó que la plataforma es el AgiBot X2 Ultra (ver `agibot_x2.md`). Esta página se conserva solo como registro de la investigación previa; no debe usarse para decisiones de diseño.

Aquí se registra de dónde sale cada dato.

| Afirmación | Tipo | Fuente | Nota |
|---|---|---|---|
| Cámara estéreo de profundidad, IMU 9 ejes | Hecho, fuente primaria | S10, S11 | Sin modelo ni resolución |
| Ediciones Geek 48 / Education 117 / Professional 200 TOPS | Hecho, fuente primaria | S10, S11 | S12 las llama Geek / Basic EDU / Pro EDU |
| Education = Orin NX 8GB; Professional = AGX Orin 32GB | Hecho, fuente primaria | S11 | Coincide con S13 |
| Batería Geek 2 Ah, ~20 min | Hecho, fuente primaria | S11 | **Contradice S12** (5 Ah, 80 min): discrepancia registrada, no resuelta |
| HR de operación 5–90 % sin condensación | Hecho, fuente primaria | S11 | Riesgo en invernadero con HR nocturna ~90 % (S01) |
| Módulo D-Robotics 544×488, 105°×94° | Dato secundario | S13 | Equipo RoboCup, enero 2026 |
| Topics `/StereoNetNode/...`, fx = 206.45 | Dato de código del fabricante | S14 | Configuración de la demo, no de nuestro robot |
| ROS 2 Humble, JetPack 6.2, TensorRT 10.3 | Inferencia | S14 | Por dependencias y nombres de archivo |
| `booster_robotics_sdk_python` en PyPI, `booster_ros2` | Dato secundario, no verificado | búsqueda web (roboticscenter.ai) | Verificar en fuentes oficiales |
| Otros equipos cambian la cámara (ZED 2i, RealSense D455) | Dato secundario | ficha HTWK citada por el equipo; topics comentados en S14 | Nuestro robot podría tener otra cámara |

## Discrepancias abiertas

1. ~~¿K1 o X2?~~ Resuelto: X2 Ultra (D-010).
2. Batería y autonomía de la edición Geek (S11 frente a S12).
3. Resolución de la imagen rectificada (cx y cy de la demo sugieren unos 450×485 frente a 544×488).
