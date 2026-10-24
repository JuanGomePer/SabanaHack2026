# Imagen del frontend de Vigía para Railway.
#
# Existe porque la detección automática de Railway (Railpack) a veces arma,
# para este servicio, una imagen "solo estática" que sirve web/dist sin Node
# instalado — y como el Start Command que usamos corre con npm, el contenedor
# fallaba con "npm: command not found" en bucle. Con un Dockerfile propio el
# runtime siempre trae Node, sin importar qué detecte Railpack.
#
# Build context = la raíz del repo (es un monorepo con npm workspaces: shared
# + server + web comparten node_modules). En Railway: Settings → Build →
# Dockerfile, con "Dockerfile Path" = web/Dockerfile y Root Directory vacío.

FROM node:20-slim

WORKDIR /app

# Copiar primero los package.json (de la raíz y de los tres workspaces) deja
# que Docker cachee `npm install` entre builds mientras no cambien las
# dependencias, aunque cambie el código.
#
# `npm install` en la raíz dispara el postinstall de TODOS los workspaces,
# server incluido (`prisma generate`), aunque este Dockerfile no vaya a usar
# server para nada — por eso hace falta copiar también su schema de Prisma
# antes del install, si no el comando falla ahí mismo (no al construir web).
COPY package.json package-lock.json ./
COPY shared/package.json shared/
COPY server/package.json server/
COPY server/prisma.config.ts server/
COPY server/prisma/schema.prisma server/prisma/
COPY web/package.json web/

RUN npm install

COPY shared shared
COPY web web

RUN npm run build --workspace web

ENV NODE_ENV=production

# `serve` ya quedó instalado por el `npm install` de arriba (dependencia de
# /web); se invoca por su binario directo, no por `npm run`, para no
# depender de que el runtime tenga `npm` disponible — solo necesita `node`.
CMD ["sh", "-c", "node node_modules/.bin/serve -s web/dist -l tcp://0.0.0.0:${PORT:-4173}"]
