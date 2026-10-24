# Plan para conseguir datos de Botrytis y trips en arándano

Estado (2026-10-24): **no existe ningún dataset visual verificado de Botrytis ni de trips en arándano** al que tengamos acceso. Las fuentes de fresa (gray mold) y *Spathiphyllum* (trips) no validan arándano.

## Vías, por prioridad

| # | Vía | Qué pedir | Contacto / dónde | Bloqueo actual |
|---|---|---|---|---|
| 1 | **AGRAR y sus clientes** | Fotos de casos confirmados por agrónomo: Botrytis en flor, fruto verde y maduro; trips o su daño; plantas sin síntomas **de la misma finca y cámara** | Equipo AGRAR | Solicitud no enviada |
| 2 | **Captura propia con el X2 Ultra** | Sesiones según `docs/09_captura_datos_x2.md`, con el agrónomo etiquetando en sitio | PC2, con autorización | Sin acceso al robot |
| 3 | **Autores de Mummy berry (Frontiers 2024, 927 imágenes de arándano)** | Raw data «available by the authors without undue reservation» (mummy berry, no Botrytis, pero arándano real con órganos, estadios y severidad) | Autores (U. Maine / Chongqing) | Petición por correo |
| 4 | **DrBerry** (Alternaria, Oidio, Heliothis) | Ya público; requiere API key | `ROBOFLOW_API_KEY` en sesión | Sin key |
| 5 | **Investigadores colombianos** (Ciencias Hortícolas UPTC, doi 10.19053/uptc.24223719.18515) | Imágenes de enfermedades de arándano en Colombia, si las tienen | Autores / AGROSAVIA | Página bloqueada por anti-bot; no leída |
| 6 | **Trips**: GreenHouse Annotations (Roboflow, CC BY 4.0, 504 img, clase *Thrips*) | Para estudiar insectos pequeños; luego validar en arándano | API key | Sin key; cultivo no verificado |
| 7 | **Trips**: trampas cromáticas fotografiadas en la finca | Conteo en trampa (objeto plano, fondo uniforme), más fácil que el insecto en la hoja | AGRAR | Por proponer |

## Protocolo mínimo por imagen

- Cultivo, variedad, finca, bloque, nave, cama, fecha y hora.
- Órgano (flor, fruto, hoja, tallo) y estadio fenológico.
- Diagnóstico, **quién lo confirmó y cómo** (visual, incubación, laboratorio).
- Severidad si se mide.
- Cámara y distancia.
- Licencia de uso firmada (hackathon y, aparte, uso comercial futuro).

## Cuántas imágenes (orientativo, a revisar con datos reales)

Para estimar el recall de una clase con un IC 95 % de ±10 puntos cerca de 0,9 se necesitan unas **35–40 imágenes positivas independientes en test** (Wilson). Con 15 positivos, como *anthracnose* en fresa hoy, el intervalo abarca más de 30 puntos. El entrenamiento necesita varias veces más, en grupos independientes (plantas o sesiones distintas).

## Componente ambiental (separado de la visión)

Rivera, Zoffoli y Latorre (2013, *Plant Disease*, doi:10.1094/PDIS-12-12-1112-RE) proponen un algoritmo de riesgo de infección de Botrytis en arándano: **más de 6 h de humectación entre 14 y 25 °C**, con r = 0,96 frente a la incidencia en fruta almacenada en Chile. Los propios autores indican que **falta validación de campo**. Con los sensores de AGRAR (humedad relativa, temperatura y, si existe, humectación foliar) puede implementarse como **alerta de riesgo**, nunca como diagnóstico, y en un componente separado del modelo visual.
