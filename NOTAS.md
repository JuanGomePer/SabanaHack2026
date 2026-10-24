# NOTAS · Vigía, Monitor de cultivo

Sabana Hack 2026 · reto **Berry Good Idea** · mentor Agrar Ingeniería.
Registro corto de qué se hizo, con qué herramientas y qué dependencias se
agregaron, para la ficha técnica.

## Herramientas e IA usadas

| Herramienta | Para qué |
| --- | --- |
| **Claude Code (modelo Opus 5), de Anthropic** | Generación y edición del código del monorepo (frontend, backend y tipos compartidos), y comparación de cada pantalla con el diseño. |
| **Figma MCP Server** (`get_variable_defs`, `get_design_context`, `get_screenshot`, `get_metadata`) | Extracción de los tokens del sistema de diseño y lectura pantalla por pantalla del archivo `gXK6Jx10f9MaokdPTfssOc` como fuente de verdad visual. |
| **Playwright + Chromium** | Levantar la app, capturarla a 1440×1000 y compararla con los screenshots de Figma; además verifica el flujo de revisión de punta a punta. |
| **Figma** (diseño propio del equipo) | Diseño de las 13 pantallas y del sistema de diseño. |

El código lo escribió Claude Code a partir del diseño del equipo y de los
supuestos acordados; las decisiones de alcance, datos y textos son del equipo.

## Qué se construyó

1. **Tokens y componentes base.** Los colores, radios, tipografías y sombras
   salen de las variables de Figma (`get_variable_defs`) y viven en
   `web/src/estilos/tokens.css`. Ningún componente escribe un color suelto.
   Componentes del sistema de diseño implementados: chip de estado (3:17),
   botón (3:63), ítem de navegación (3:120), tarjeta KPI (3:145), interruptor
   (3:150) y mapa de arándanos (20:702).
2. **API en Node.js** (`/server`) con datos semilla en memoria, simulador de la
   alerta nueva en C14-P65 y eventos en vivo por Server-Sent Events.
3. **Frontend React + TypeScript** (`/web`) que consume únicamente esa API con
   `fetch` tipado. No hay datos de cultivo escritos dentro de los componentes.
4. **Tipos compartidos** (`/shared`) usados por los dos lados, más un único
   archivo de supuestos editable (`shared/src/config.ts`).
5. **Pantallas**: 09 Login, 10 Bienvenida, 01 Mapa, 02 Alerta nueva, 03 Detalle
   de planta, 03b/03c Gafas, 04 Alertas, 11 Equipos y servicios, 07 Registro de
   incidencias, 05/06 Configuración y 08 Cómo llega una alerta.

## Dependencias agregadas

Raíz:

- `concurrently` 9.1.2 — un solo `npm run dev` levanta frontend y backend.
- `typescript` 5.7.3.

`/server`:

- `express` 4.21.2, `cors` 2.8.5 — API HTTP.
- `tsx` 4.19.2 — ejecuta TypeScript en desarrollo con recarga.
- `@types/express`, `@types/cors`, `@types/node`.

`/web`:

- `react` 18.3.1, `react-dom` 18.3.1.
- `vite` 6.0.7, `@vitejs/plugin-react` 4.3.4.
- `lucide-react` 0.469.0 — los iconos del diseño (map, bell, wind, clipboard,
  sliders, leaf, bot, search…) son de Lucide, así que se usan desde el paquete
  en lugar de exportarlos como SVG sueltos.
- `@types/react`, `@types/react-dom`.

Sin base de datos: todo el estado vive en memoria en el proceso del servidor.

Tipografías **Plus Jakarta Sans** y **Figtree** se cargan desde Google Fonts en
`web/index.html`.

## Sobre el contrato de datos

El `CONTRATO_DATOS.md` original del equipo no apareció: no estaba ni en el
contenedor de trabajo ni en el repositorio. **Los tipos de
`shared/src/tipos.ts` se escribieron a partir del enunciado del reto**, y
[`CONTRATO_DATOS.md`](CONTRATO_DATOS.md) los documenta.

En la carpeta local de trabajo apareció después otra implementación del
proyecto con su propio `CONTRATO_DATOS.md`, pero **ese también está
reconstruido del brief** ("el CONTRATO_DATOS.md original no estaba disponible en
esta máquina"), así que no hay una versión original que mande sobre la otra. Si
el contrato original aparece, hay que contrastarlo con los tipos: los nombres de
campos pueden no coincidir.

## Decisiones que conviene saber

- **Los iconos vienen de `lucide-react`**, no de archivos exportados: los
  nombres de las capas del Figma (`icono/map`, `icono/bell`, `icono/wind`…)
  coinciden con los de Lucide, así que el resultado es el mismo y el proyecto
  no arrastra SVGs sueltos. Los puntos de color de los chips y KPIs se dibujan
  con CSS en vez de como imagen, porque en el diseño son círculos planos.
- **Las fotos del robot son placeholders SVG** generados por el servidor
  (`server/src/fotos.ts`), con la caja del hallazgo dibujada encima. Para usar
  fotos reales basta con dejar el archivo en `server/fotos/<idHallazgo>.jpg`:
  la misma ruta `/api/fotos/<id>.svg` la sirve y el frontend no cambia.
- **El envío a las gafas es una simulación de la interfaz.** El servidor solo
  cambia un estado (`no_enviado → enviado → recibido`) y responde. **No hay
  ninguna integración real con Meta Quest** ni con ningún visor, y la propia
  pantalla lo dice.
- **Los datos de la pantalla de equipos son de ejemplo**, simulados por el
  prototipo. No son lecturas reales de los equipos de Agrar y la nota "Datos de
  ejemplo" queda visible en pantalla. Los botones de servicio técnico y
  catálogo son mock: muestran una confirmación y no envían nada.
- **Las cifras de estructura, umbrales y equipos son supuestos** pendientes de
  confirmar con el mentor. Están todas en `shared/src/config.ts`.

## Diferencias con el Figma (conocidas y asumidas)

El diseño tiene algunos números que no cuadran entre sí entre pantallas. La app
calcula los suyos a partir del dato real del API, así que en estos puntos no
coincide con el mockup:

- **Plantas sanas**: el diseño dice `2.345 · 97,7 %`; la app muestra `2.267 ·
  94,5 %`, porque descuenta las ~78 plantas en estado "sin dato" (las celdas
  grises que el propio mapa del diseño dibuja en las camas 9 y 22–24).
- **Equipos en marcha**: el diseño dice `5 de 6` con `1 en espera · 1 con
  aviso` (suma 7 de 6). La app muestra `4 de 6` con `1 en espera · 1 con
  aviso`, que sí suma 6.
- **Zonas más húmedas**: el diseño lista `Cama 14` y `Cama 5`; la app lista las
  dos camas realmente por encima del umbral (`Cama 14` y `Cama 13`), porque las
  camas con humedad alta son las de la nave 5 (13, 14 y 15), que es lo que hace
  que el KPI "Camas con humedad alta" dé 3 como en el diseño.
- **Orden de "Por revisar"**: la app ordena de más reciente a más antigua; el
  diseño usa otro orden que no es ni el de tiempo ni el de humedad.
- **Plantas vecinas**: en el diseño P67 y P68 salen verdes; en la app salen en
  riesgo, porque la zona húmeda de la cama 14 llega hasta la planta 80.
- El control de capas del mapa aparece recortado en el diseño ("Temperatura"
  queda cortado); en la app se ve completo.

Lo demás (estructura, tipografías, colores, radios, sombras, textos y flujo) se
sigue del archivo de Figma.

## Cómo se verificó

- `npx tsc --noEmit` en los tres paquetes: sin errores.
- Captura de las 12 pantallas con Playwright a 1440×1000 y comparación con los
  screenshots de Figma, pantalla por pantalla.
- Prueba del flujo de revisión de punta a punta: la alerta llega a los ~3 s de
  entrar al mapa; **Confirmar** baja "por revisar" de 7 a 6 y sube
  "confirmados" del registro de 18 a 19; **Falsa alarma** baja "plantas en
  alerta" de 8 a 7, devuelve la planta a "en riesgo" y sube "falsas alarmas" de
  5 a 6. El registro queda firmado por "Samuel R.".
- Sin errores en la consola del navegador en ninguna pantalla.
