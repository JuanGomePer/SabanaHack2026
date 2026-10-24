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

Necesitas Postgres corriendo (local o en la nube) antes del primer `npm run dev`.

```bash
npm install                          # instala las tres piezas del monorepo
cp server/.env.example server/.env   # pon tu DATABASE_URL ahí
npm run db:migrate:dev --workspace server
npm run db:seed --workspace server   # siembra el cultivo de ejemplo (una sola vez)
npm run dev
```

Un solo comando (`npm run dev`) levanta las dos piezas:

- API en <http://localhost:3001>
- Aplicación en <http://localhost:5173>

El frontend habla con la API a través del proxy de Vite (`/api` → `:3001`), así
que basta con abrir la aplicación.

## Base de datos

Postgres vía Prisma (`server/prisma/schema.prisma`). El estado del cultivo ya
no se regenera en cada arranque del servidor — se siembra una vez
(`npm run db:seed --workspace server`) y a partir de ahí sobrevive a
reinicios y despliegues. Comandos útiles, todos desde la raíz:

| Comando | Para qué |
| --- | --- |
| `npm run db:migrate:dev --workspace server` | Nueva migración en desarrollo (compara el schema con la base y aplica el cambio) |
| `npm run db:migrate:deploy --workspace server` | Aplica las migraciones pendientes sin generar una nueva (lo usa Render) |
| `npm run db:seed --workspace server` | Siembra los datos de ejemplo — no hace nada si ya hay datos |
| `npm run db:studio --workspace server` | Abre Prisma Studio para mirar/editar las tablas a mano |

## Desplegar en Render

El repo trae un blueprint (`render.yaml`) con los tres recursos: Postgres +
la API (`vigia-api`) + el sitio estático del frontend (`vigia-web`).

1. En el dashboard de Render: **New → Blueprint** → selecciona este repositorio.
2. Render crea la base de datos, migra el esquema y siembra los datos antes
   de servir tráfico (`preDeployCommand` en `render.yaml`) — no hay que
   correr nada a mano.
3. Copia la `ROBOT_API_KEY` que Render genera para `vigia-api` (Settings →
   Environment) y pásasela a quien vaya a mandar observaciones del módulo de
   visión a `POST /api/observaciones`.
4. Si renombras `vigia-api` o `vigia-web` al crear el blueprint, actualiza a
   mano `CORS_ORIGIN` (en `vigia-api`) y `VITE_API_URL` (en `vigia-web`) en
   `render.yaml` o desde el dashboard — Render no resuelve esas referencias
   cruzadas solo.

## Desplegar en Railway

Railway no tiene un blueprint declarativo único como Render (no provisiona
Postgres ni resuelve variables cruzadas entre servicios solo desde un
archivo), así que esta parte sí es manual desde el dashboard — el repo trae
`railway.api.json` y `railway.web.json` con el build/start/healthcheck de
cada servicio, pero hay que crear los servicios y las variables a mano:

1. **New Project → Deploy from GitHub repo** → selecciona este repositorio.
   Railway va a crear un primer servicio; bórralo o reusalo para la API
   (el paso 3 lo configura).
2. **+ New → Database → Add PostgreSQL** en el mismo proyecto.
3. Para la API: en el servicio, **Settings → Config-as-code** → pon la ruta
   `/railway.api.json` (con la barra inicial — Railway no sigue el Root
   Directory para este archivo, pide la ruta absoluta desde la raíz del
   repo). Deja el **Root Directory** vacío (es un monorepo con npm
   workspaces, los comandos ya corren desde la raíz).
4. En **Variables** del servicio de la API, agrega:
   - `DATABASE_URL` → `${{Postgres.DATABASE_URL}}` (la referencia a la base
     que creaste en el paso 2; Railway te autocompleta el nombre).
   - `ROBOT_API_KEY` → genera un valor random (lo vas a necesitar para
     `POST /api/observaciones`).
   - `NODE_ENV` → `production`.
   - `CORS_ORIGIN` → la URL pública del servicio web (puedes dejarla
     pendiente y volver a este paso después de crear el servicio del web en
     el paso 6, cuando ya sepas la URL).
5. En **Settings → Networking** de la API, genera un dominio público
   (`Generate Domain`) — esa URL es la que necesitas para `VITE_API_URL` más
   abajo.
6. Para el frontend: **+ New → GitHub repo** otra vez, mismo repositorio, para
   crear un SEGUNDO servicio en el mismo proyecto. **Settings →
   Config-as-code** → `/railway.web.json`. En **Variables**:
   `VITE_API_URL` → `https://<dominio-de-la-api>/api`. Genera también su
   dominio público en **Networking**.
7. Vuelve al paso 4 y completa `CORS_ORIGIN` con el dominio del web que
   acabas de generar — si no, el navegador bloquea las peticiones por CORS.
8. Cada deploy de la API corre `preDeployCommand` (migraciones + siembra)
   antes de servir tráfico, igual que en Render — no hay que correrlo a
   mano. El seed es idempotente, así que repetirlo en cada deploy no
   duplica nada.

## Estructura

```
/shared    Tipos del contrato de datos + supuestos editables (config.ts)
/server    API en Node.js + Express, persistida en Postgres con Prisma
/web       Frontend React + TypeScript con Vite
/vision    Módulo de visión por computador (Python) — investigación aparte, sin API desplegada todavía
```

- `shared/src/tipos.ts` — la interfaz entre frontend y backend.
- `shared/src/config.ts` — **todos los supuestos en un solo sitio**: estructura
  del bloque, umbrales, datos semilla y catálogo de equipos. Cambiar un número
  aquí cambia el backend y el frontend.
- `web/src/estilos/tokens.css` — los tokens del sistema de diseño de Figma.

### Arquitectura de `server/`

Tres capas, cada una habla solo con la de al lado:

```
routes/        Capa HTTP: parsea el request, llama al servicio, responde. Sin lógica de negocio.
services/      Reglas del negocio y efectos (SSE, bitácora del registro, reacción de los equipos).
repositories/  Lo único que toca Prisma. Traduce entre las filas de la base y los tipos del contrato.
```

`db.ts` (el cliente de Prisma), `sse.ts` (los eventos en vivo) y `fotos.ts`
(las fotos placeholder) son infraestructura compartida entre capas.
`prisma/schema.prisma` es el modelo de datos; `prisma/seed.ts` siembra el
cultivo de ejemplo una sola vez (es idempotente: si ya hay plantas, no hace
nada). Ver `src/mappers.ts` para la traducción entre los enums de Prisma
(sin tildes ni espacios, por Postgres) y los valores exactos del contrato.

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
| `GET /api/salud` | Chequeo de salud (lo usa Render). |
| `POST /api/observaciones` | Ingesta del módulo de visión — ver abajo. |

## Ingesta del módulo de visión

`POST /api/observaciones`, protegida con el header `x-api-key` (variable
`ROBOT_API_KEY`). Es el puente entre `vision/` (que a la fecha no tiene un
modelo entrenado para arándano ni un servicio de inferencia corriendo — ver
`vision/CLAUDE.md`) y el resto de la app: el día que haya un clasificador
desplegado, manda sus detecciones aquí y se convierten en hallazgos con las
mismas reglas que usa el resto del sistema (recomendación, prioridad, alerta,
registro, SSE).

La forma del payload está inspirada en la propuesta de contrato de visión
(`vision/contracts/observation.schema.json`, todavía una propuesta, no una
API implementada), simplificada a lo mínimo que este backend necesita —
sobre todo, pide `location.plant_number` explícito porque ese contrato
todavía no baja a nivel de planta individual:

```jsonc
// POST /api/observaciones  (header: x-api-key: <ROBOT_API_KEY>)
{
  "location": { "bed_id": 14, "plant_number": 65 },
  "visual_findings": [
    { "class_name": "Botrytis", "confidence": 0.91, "bbox_xyxy": [0.3, 0.28, 0.6, 0.58] }
  ],
  "environmental_context": [{ "variable": "humidity", "value": 93 }]
}
```

`class_name` solo reconoce `Botrytis`, `Alternaria` y `Oídio` (y variantes de
mayúsculas/español/inglés) — cualquier otra clase se audita pero no abre un
hallazgo, justamente para no confundir, por ejemplo, el `gray_mold` de fresa
del experimento auxiliar de `vision/` con Botrytis de arándano. La
observación completa se guarda igual, se haya podido mapear o no, en la
tabla `Observacion`, para trazabilidad.

## Fotos reales

Las fotos son placeholders SVG generados por el servidor. Para usar fotos
reales del robot, deja el archivo en `server/fotos/<idHallazgo>.jpg` (también
sirve `.png`, `.jpeg`, `.webp` o `.svg`). La ruta `/api/fotos/<id>.svg` la sirve
automáticamente y no hay que tocar el frontend.
