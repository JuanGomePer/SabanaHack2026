# Vigía · Monitor de cultivo de arándanos

Prototipo del reto **Berry Good Idea** (Sabana Hack 2026, Universidad de La
Sabana), con mentoría de Agrar Ingeniería.

Aplicación web para el encargado de un cultivo de arándanos: monitoreo cama por
cama, hallazgos detectados por un robot (Botrytis, Alternaria, Oídio), alertas,
registro de incidencias y estado de los equipos de clima.

> **Prototipo con datos simulados.** Las cifras, estados y fotos son de ejemplo:
> no son lecturas reales de ningún cultivo ni de equipos de Agrar, y este
> prototipo no es un producto de Agrar. El envío a las gafas es una simulación
> de la interfaz: **no hay integración con Meta Quest**.

## Arrancar

```bash
npm install
npm run dev
```

Un solo comando levanta las dos piezas:

- API en <http://localhost:3001>
- Aplicación en <http://localhost:5173>

El frontend habla con la API a través del proxy de Vite (`/api` → `:3001`), así
que basta con abrir la aplicación.

## Estructura

```
/shared    Tipos del contrato de datos + supuestos editables (config.ts)
/server    API en Node.js + Express, datos en memoria y simulador
/web       Frontend React + TypeScript con Vite
```

- `shared/src/tipos.ts` — la interfaz entre frontend y backend.
- `shared/src/config.ts` — **todos los supuestos en un solo sitio**: estructura
  del bloque, umbrales, datos semilla y catálogo de equipos. Cambiar un número
  aquí cambia el backend y el frontend.
- `web/src/estilos/tokens.css` — los tokens del sistema de diseño de Figma.

## Flujo de la demo

1. **Login** → **Bienvenida** → **Mapa**.
2. A los 3 s de entrar al mapa llega una alerta nueva en **C14-P65** (lo manda
   el simulador por Server-Sent Events).
3. Tocar el aviso, o el arándano marcado del mapa, abre el **detalle de la
   planta**.
4. **Confirmar alerta** o **Falsa alarma** actualiza el mapa, la lista de
   alertas y el registro al momento.
5. En el detalle, **Gafas Meta** → **Enviar a las gafas** muestra los estados
   "Enviado" y "Recibido" (simulados).
6. **Equipos** abre el estado de los equipos de clima y la lista "Qué está
   pasando", que se actualiza sola.

Los segundos que tarda la alerta se cambian en Configuración → Alertas y
umbrales, o en `shared/src/config.ts` (`UMBRALES.segundosAlertaDemo`).
Para repetir el pitch sin reiniciar el servidor: `POST /api/demo/reiniciar`.

## API

| Método y ruta | Qué devuelve |
| --- | --- |
| `GET /api/mapa` | Camas, naves, resumen, zonas húmedas y sugerencia. |
| `GET /api/resumen` | KPIs del bloque y estado del robot. |
| `GET /api/camas` · `GET /api/camas/:numero` | Celdas del mapa. |
| `GET /api/plantas/:id` | Detalle: planta, hallazgo, serie de humedad y vecinas. |
| `GET /api/hallazgos` · `GET /api/hallazgos/:id` | Hallazgos del robot. |
| `POST /api/hallazgos/:id/revision` | `{ revision: "confirmada" \| "falsa_alarma", nota? }`. |
| `POST /api/hallazgos/:id/enviar-a-gafas` | Envío simulado al visor. |
| `GET /api/alertas` | Alertas de las últimas 24 h. |
| `GET /api/registro` | Filas del registro de incidencias + resumen de la semana. |
| `GET /api/registro.csv` | El mismo registro en CSV. |
| `GET /api/configuracion` · `PUT /api/configuracion` | Estructura y umbrales. |
| `GET /api/equipos` | Equipos, resumen y bloque de servicio técnico. |
| `GET /api/equipos/eventos` | Lista "Qué está pasando". |
| `POST /api/equipos/servicio` | Mock de "Pedir servicio técnico" / "Ver catálogo". |
| `GET /api/fotos/:id.svg` | Foto del hallazgo (placeholder o la real, si existe). |
| `GET /api/eventos` | Canal de eventos en vivo (SSE). |
| `POST /api/demo/reiniciar` | Reinicia la alerta de la demo. |

## Fotos reales

Las fotos son placeholders SVG generados por el servidor. Para usar fotos
reales del robot, deja el archivo en `server/fotos/<idHallazgo>.jpg` (también
sirve `.png`, `.jpeg`, `.webp` o `.svg`). La ruta `/api/fotos/<id>.svg` la sirve
automáticamente y no hay que tocar el frontend.
