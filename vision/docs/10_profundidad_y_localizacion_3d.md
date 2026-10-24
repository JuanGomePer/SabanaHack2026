# Profundidad y localización 3D (fase posterior, documentada y no implementada)

> Se implementará cuando haya un detector RGB evaluado y la calibración se haya verificado en la unidad. Hasta entonces `inference.use_depth: false`, `enable_3d_projection: false`, y los campos `depth_m` y `point_xyz_m` del contrato van en `null`.

## Por qué no es trivial en el X2 Ultra

- Desde el SDK **v1.1.0** la profundidad **ya no se publica alineada** con el RGB. `depth_registration` viene desactivado y la aplicación tiene que registrar por su cuenta.
- RGB y profundidad **no están sincronizados**.
- La calibración de fábrica tiene intrínsecos para `head_rgbd_rgb`, pero ninguna sección propia para la cámara de profundidad. Los intrínsecos de profundidad vienen de `depth_camera_info` y la relación entre ambas de la TF estática `rgbd_head_front` → `rgbd_depth_head_front`.
- La cabeza se mueve: la calibración guarda `head_yaw` y `head_pitch` del momento de calibrar, y la pose actual sale de la cadena cinemática (URDF + `joint_states`). El procedimiento oficial está pendiente.

## Flujo propuesto

1. **Emparejar por tiempo**: para cada RGB, la profundidad con la marca de tiempo más cercana dentro de una tolerancia (p. ej. ≤ 1/2 periodo, ~16 ms a 30 Hz). Si no hay pareja, la detección queda sin profundidad.
2. **Intrínsecos**: `K_rgb` de `rgb_camera_info` (contrastado con `head_rgbd_rgb`) y `K_depth` de `depth_camera_info`. Verificar que coinciden con la resolución de cada imagen.
3. **Extrínsecos**: `T_rgb←depth` de `/tf_static`. Comprobar el sentido de la transformación.
4. **Proyección**: retroproyectar los píxeles de profundidad válidos a 3D con `K_depth`, transformarlos al frame RGB y proyectarlos con `K_rgb`. Así se obtiene un mapa de profundidad registrado (solo en los píxeles con medida). La alternativa es proyectar la caja RGB al dominio de profundidad.
5. **Distancia de la detección**: dentro de la caja o la máscara, tomar los píxeles válidos (≠ 0 en 16UC1), erosionar los bordes, descartar valores fuera de rango y usar la **mediana** o un percentil bajo, porque la hoja suele ser lo más cercano. Si hay pocos píxeles válidos (umbral por definir), `depth_m = null`.
6. **Casos inválidos**: profundidad 0, reflejos, superficies húmedas, oclusión, bordes de hoja y fondo mezclado. Se registran como "sin medida", nunca con un valor por defecto.
7. **Marco de referencia**: punto en `rgbd_head_front` → `base_link` mediante TF y la pose de la cabeza → mapa de la finca. Esto último depende de la localización del robot, que no es parte de este módulo.

## Criterios de validación (antes de activarla)

- Error de distancia contra una cinta métrica en una escena de prueba (objetos a 0.2, 0.3 y 0.5 m).
- Porcentaje de detecciones con profundidad válida en imágenes reales del cultivo.
- Registro RGB-profundidad comprobado visualmente (superposición) en varias distancias.
