# Contrato de datos · Vigía (monitor de cultivo de arándanos)

> El `CONTRATO_DATOS.md` original del equipo no estaba disponible ni en el
> contenedor de trabajo ni en el repositorio, así que este documento se escribió
> a partir del enunciado del reto. La versión ejecutable y la que manda es
> [`shared/src/tipos.ts`](shared/src/tipos.ts): si los dos se contradicen, gana
> el archivo de TypeScript, porque es el que compila en los dos lados.
> Los supuestos editables están en [`shared/src/config.ts`](shared/src/config.ts).

Esta es la interfaz entre `/web` y `/server`. El frontend no inventa datos: todo
lo que muestra viene de estas rutas.

## 1. Estructura del cultivo

| Nivel | Cantidad | Nota |
| --- | --- | --- |
| Bloque | `B5` | único bloque del prototipo |
| Naves | 8 | `nave = floor((cama - 1) / camasPorNave) + 1` |
| Camas por nave | 3 | numeradas 1–24 en todo el bloque |
| Plantas por cama | 100 | numeradas 1–100 |
| Plantas por celda del mapa | 2,5 | 40 celdas por cama |

La cama 14 está en la nave 5 (camas 13–15).

**Identificador de planta:** `B5-C14-P065` — bloque, cama, planta con tres
dígitos. En la interfaz se muestra abreviado: `C14-P65`.

**Celda del mapa:** `indice = floor((planta - 1) / 2,5)`, de 0 a 39. El estado
de la celda es el peor de las plantas que agrupa, con esta precedencia:
`alerta > riesgo > sin_dato > ok`.

Todas estas cifras son supuestos pendientes de confirmar con el mentor y se
cambian en un solo sitio: `shared/src/config.ts`.

## 2. Estados

```ts
type EstadoCelda = 'ok' | 'riesgo' | 'alerta' | 'sin_dato';
```

| Estado | Cuándo | Color |
| --- | --- | --- |
| `ok` | nada que reportar | verde |
| `riesgo` | humedad relativa ≥ 85 % (valor provisional) | ámbar |
| `alerta` | hallazgo visual no descartado como falsa alarma | rojo |
| `sin_dato` | sin lectura del sensor | gris |

Una planta con un hallazgo **confirmado** sigue en `alerta`. Una marcada como
**falsa alarma** vuelve a `riesgo` u `ok` según su humedad.

## 3. Hallazgos

```ts
type TipoHallazgo = 'Botrytis' | 'Alternaria' | 'Oídio';
type RevisionHallazgo = 'pendiente' | 'confirmada' | 'falsa_alarma';
type EstadoGafas = 'no_enviado' | 'enviado' | 'recibido';

interface Hallazgo {
  id: string;              // "H-0001"
  plantaId: string;        // "B5-C14-P065"
  cama: number;
  planta: number;
  nave: number;
  tipo: TipoHallazgo;
  confianza: number;       // 0–1
  bbox: { x: number; y: number; w: number; h: number };  // normalizado 0–1
  revision: RevisionHallazgo;
  detectadoEn: string;     // ISO 8601
  humedad: number;         // % en el momento de la detección
  fotoUrl: string;         // "/api/fotos/H-0001.svg"
  gafas: EstadoGafas;
  recomendacion: string;   // qué hacer, según el tipo
}
```

El `bbox` va normalizado de 0 a 1 sobre la foto, para que no dependa de la
resolución de la cámara del robot.

## 4. Rutas

Todas bajo `/api`. Fechas en ISO 8601, porcentajes de 0 a 100, confianzas de
0 a 1.

### Mapa y resumen

| Ruta | Devuelve |
| --- | --- |
| `GET /api/mapa` | `MapaRespuesta`: camas, naves, resumen, zonas húmedas y sugerencia |
| `GET /api/resumen` | `Resumen`: KPIs del bloque y estado del robot |
| `GET /api/camas` | `Cama[]` |
| `GET /api/camas/:numero` | `Cama` · 404 si no existe |

```ts
interface Resumen {
  bloque: string;
  totalPlantas: number;
  sanas: number;
  riesgo: number;
  alerta: number;
  porRevisar: number;      // plantas en alerta con revisión pendiente
  porcentajeSanas: number;
  robot: EstadoRobot;
  actualizado: string;
}
```

### Detalle de planta

`GET /api/plantas/:id` → `DetallePlanta` · 404 si no existe.

```ts
interface DetallePlanta {
  planta: Planta;
  etiqueta: string;                                  // "C14-P65"
  hallazgo: Hallazgo | null;
  serieHumedad: Array<{ hora: string; valor: number }>;  // 12 h hacia atrás
  vecinas: Array<Planta & { etiqueta: string }>;     // misma cama, ±3, incluida ella
}
```

### Revisión

`POST /api/hallazgos/:id/revision`

```jsonc
// petición
{ "revision": "confirmada" | "falsa_alarma", "nota": "opcional" }
// respuesta
{ "hallazgo": Hallazgo, "alerta": Alerta, "resumen": Resumen }
```

Efectos: cambia el estado de la planta, emite `estado_cambiado` por SSE y deja
la fila firmada en el registro. 400 si `revision` no es uno de esos dos valores.

### Envío a las gafas

`POST /api/hallazgos/:id/enviar-a-gafas`

```jsonc
{
  "hallazgoId": "H-0008",
  "gafas": "enviado",
  "dispositivo": "Meta Quest 3",
  "enviadoEn": "2026-10-24T14:32:00.000Z"
}
```

**Es una simulación de la interfaz.** El servidor cambia el estado a `enviado`
y, un segundo y medio después, a `recibido`. **No hay integración con Meta Quest
ni con ningún visor**, y no se envía nada a ninguna parte.

### Alertas, registro y configuración

| Ruta | Devuelve |
| --- | --- |
| `GET /api/alertas` | `Alerta[]` de las últimas 24 h, más reciente primero |
| `GET /api/registro` | `{ filas: FilaRegistro[], resumen: ResumenRegistro }` |
| `GET /api/registro.csv` | el mismo registro como CSV descargable |
| `GET /api/registro/movimientos` | `EntradaRegistro[]`, bitácora de acciones |
| `GET /api/configuracion` | `Configuracion` |
| `PUT /api/configuracion` | acepta `{ estructura?, umbrales? }` parciales |

```ts
interface Alerta {
  id: string;              // "A-0001"
  hallazgoId: string;
  plantaId: string;
  cama: number; planta: number; nave: number;
  tipo: TipoHallazgo;
  confianza: number;
  humedad: number;
  prioridad: 'alta' | 'media' | 'baja';
  revision: RevisionHallazgo;
  detectadoEn: string;
  fotoUrl: string;
}

interface FilaRegistro {
  id: string; fecha: string; plantaId: string; etiqueta: string;
  cama: number; nave: number;
  tipo: TipoHallazgo; confianza: number;
  decision: RevisionHallazgo;
  reviso?: string;         // vacío si sigue por revisar
}
```

La prioridad se deriva: `alta` con confianza ≥ 0,85 o humedad ≥ 90;
`media` con confianza ≥ 0,7; `baja` el resto.

### Equipos

| Ruta | Devuelve |
| --- | --- |
| `GET /api/equipos` | `{ equipos, resumen, servicio, nota }` |
| `GET /api/equipos/eventos` | `EventoEquipo[]`, la lista "Qué está pasando" |
| `POST /api/equipos/servicio` | mock: `{ tipo: "servicio" \| "catalogo" }` → mensaje |

```ts
interface Equipo {
  id: string;
  tipo: string;            // "Ventiladores de cesta"
  modelo: string;
  nave: number;
  ubicacion: string;       // "Naves 3 y 4"
  estado: 'En marcha' | 'En espera' | 'Aviso' | 'Activo';
  potencia: number;        // 0–100
  humedad: number;         // % de la nave
  ultimoDato: string;
  queEstaPasando: string;
  icono: 'fan' | 'rotate' | 'wind' | 'extract' | 'droplet' | 'cpu';
  conBarra: boolean;
  metricas: Array<{ etiqueta: string; valor: string }>;  // las dos cifras de la tarjeta
}
```

**Los datos de equipos son de ejemplo**, simulados por el prototipo. No son
lecturas reales de equipos de Agrar. El campo `nota` trae ese aviso y la
interfaz lo muestra siempre.

Regla del programador de clima: humedad ≥ 85 % en una nave enciende la
ventilación y sube los brazos mecánicos al 100 %. Los eventos de
`/api/equipos/eventos` salen de esa regla y se relacionan con las alertas del
cultivo.

### Fotos

`GET /api/fotos/:id.svg` devuelve la foto del hallazgo. Si existe
`server/fotos/<idHallazgo>.jpg` (o `.png`, `.jpeg`, `.webp`, `.svg`) sirve esa;
si no, genera un placeholder SVG con el `bbox` dibujado encima. El frontend pide
siempre la misma URL, así que cambiar a fotos reales no toca el frontend.

### Eventos en vivo

`GET /api/eventos` es un stream de Server-Sent Events. Cada mensaje es un JSON:

```ts
type EventoVivo =
  | { tipo: 'alerta_nueva'; alerta: Alerta }
  | { tipo: 'estado_cambiado'; plantaId: string; estado: EstadoCelda }
  | { tipo: 'equipos_actualizados'; eventos: EventoEquipo[] };
```

Abrir este canal es lo que arranca la cuenta atrás de la alerta del demo, por
eso el frontend solo se conecta cuando el mapa está en pantalla.

### Utilidades de la demo

| Ruta | Para qué |
| --- | --- |
| `POST /api/demo/reiniciar` | quita la alerta de C14-P65 para repetir el pitch |
| `GET /api/salud` | comprobación rápida del servidor |

### Ingesta de visión

`POST /api/observaciones`, protegida con `x-api-key`. No es parte del
contrato original (ese describe lo que consume `/web`); es el punto de
entrada para que un productor externo — el módulo `vision/`, el día que
tenga un modelo desplegado — publique hallazgos reales. Detalle del payload
y de qué pasa con clases no reconocidas: [README.md](README.md#ingesta-del-módulo-de-visión).

## 5. Datos semilla

- 7 plantas en alerta: `[cama, planta]` = `[14,60] [14,63] [13,62] [15,66]
  [5,14] [20,30] [2,50]`. La última arranca confirmada, así que quedan 6 por
  revisar.
- 48 plantas en riesgo, repartidas en las camas 13, 14 y 15 (nave 5).
- Celdas sin dato en las camas 9 y 22–24.
- Una falsa alarma reciente en `C9-P80` y 22 hallazgos ya resueltos de los días
  anteriores, para que el registro muestre la semana completa: 31 hallazgos,
  18 confirmados, 5 falsas alarmas, 78 % de precisión.
- La alerta nueva del demo llega en **C14-P65** a los 3 s de abrir el mapa.

Todo esto vive en `shared/src/config.ts`.
