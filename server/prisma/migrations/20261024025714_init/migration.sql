-- CreateEnum
CREATE TYPE "EstadoCelda" AS ENUM ('ok', 'riesgo', 'alerta', 'sin_dato');

-- CreateEnum
CREATE TYPE "TipoHallazgo" AS ENUM ('Botrytis', 'Alternaria', 'Oidio');

-- CreateEnum
CREATE TYPE "RevisionHallazgo" AS ENUM ('pendiente', 'confirmada', 'falsa_alarma');

-- CreateEnum
CREATE TYPE "EstadoGafas" AS ENUM ('no_enviado', 'enviado', 'recibido');

-- CreateEnum
CREATE TYPE "OrigenHallazgo" AS ENUM ('simulador', 'vision', 'manual');

-- CreateEnum
CREATE TYPE "EstadoEquipo" AS ENUM ('En_marcha', 'En_espera', 'Aviso', 'Activo');

-- CreateEnum
CREATE TYPE "IconoEquipo" AS ENUM ('fan', 'rotate', 'wind', 'extract', 'droplet', 'cpu');

-- CreateEnum
CREATE TYPE "AccionRegistro" AS ENUM ('confirmada', 'falsa_alarma', 'enviada_a_gafas', 'alerta_nueva', 'equipo');

-- CreateTable
CREATE TABLE "Planta" (
    "id" TEXT NOT NULL,
    "cama" INTEGER NOT NULL,
    "planta" INTEGER NOT NULL,
    "nave" INTEGER NOT NULL,
    "estado" "EstadoCelda" NOT NULL DEFAULT 'ok',
    "humedad" DOUBLE PRECISION NOT NULL,
    "temperatura" DOUBLE PRECISION NOT NULL,
    "hallazgoId" TEXT,
    "ultimaLectura" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Planta_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Hallazgo" (
    "id" TEXT NOT NULL,
    "plantaId" TEXT NOT NULL,
    "cama" INTEGER NOT NULL,
    "planta" INTEGER NOT NULL,
    "nave" INTEGER NOT NULL,
    "tipo" "TipoHallazgo" NOT NULL,
    "confianza" DOUBLE PRECISION NOT NULL,
    "bboxX" DOUBLE PRECISION NOT NULL,
    "bboxY" DOUBLE PRECISION NOT NULL,
    "bboxW" DOUBLE PRECISION NOT NULL,
    "bboxH" DOUBLE PRECISION NOT NULL,
    "revision" "RevisionHallazgo" NOT NULL DEFAULT 'pendiente',
    "detectadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "humedad" DOUBLE PRECISION NOT NULL,
    "fotoUrl" TEXT NOT NULL,
    "gafas" "EstadoGafas" NOT NULL DEFAULT 'no_enviado',
    "recomendacion" TEXT NOT NULL,
    "reviso" TEXT,
    "origen" "OrigenHallazgo" NOT NULL DEFAULT 'simulador',
    "observacionId" TEXT,

    CONSTRAINT "Hallazgo_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Observacion" (
    "id" TEXT NOT NULL,
    "fuente" TEXT NOT NULL DEFAULT 'vision',
    "payload" JSONB NOT NULL,
    "recibidaEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Observacion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EntradaRegistro" (
    "id" TEXT NOT NULL,
    "fecha" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "plantaId" TEXT,
    "cama" INTEGER,
    "accion" "AccionRegistro" NOT NULL,
    "tipo" "TipoHallazgo",
    "usuario" TEXT NOT NULL,
    "nota" TEXT NOT NULL,

    CONSTRAINT "EntradaRegistro_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Equipo" (
    "id" TEXT NOT NULL,
    "tipo" TEXT NOT NULL,
    "nombreCorto" TEXT,
    "modelo" TEXT NOT NULL,
    "nave" INTEGER NOT NULL,
    "ubicacion" TEXT NOT NULL,
    "estado" "EstadoEquipo" NOT NULL DEFAULT 'En_espera',
    "potencia" INTEGER NOT NULL DEFAULT 0,
    "ultimoDato" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "queEstaPasando" TEXT NOT NULL,
    "icono" "IconoEquipo" NOT NULL,
    "conBarra" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "Equipo_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EventoEquipo" (
    "id" TEXT NOT NULL,
    "fecha" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "texto" TEXT NOT NULL,
    "nave" INTEGER,
    "equipoId" TEXT,
    "plantaId" TEXT,

    CONSTRAINT "EventoEquipo_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Configuracion" (
    "id" INTEGER NOT NULL DEFAULT 1,
    "estructura" JSONB NOT NULL,
    "umbrales" JSONB NOT NULL,

    CONSTRAINT "Configuracion_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Planta_cama_idx" ON "Planta"("cama");

-- CreateIndex
CREATE INDEX "Planta_nave_idx" ON "Planta"("nave");

-- CreateIndex
CREATE INDEX "Planta_estado_idx" ON "Planta"("estado");

-- CreateIndex
CREATE UNIQUE INDEX "Hallazgo_observacionId_key" ON "Hallazgo"("observacionId");

-- CreateIndex
CREATE INDEX "Hallazgo_plantaId_idx" ON "Hallazgo"("plantaId");

-- CreateIndex
CREATE INDEX "Hallazgo_detectadoEn_idx" ON "Hallazgo"("detectadoEn");

-- CreateIndex
CREATE INDEX "Hallazgo_revision_idx" ON "Hallazgo"("revision");

-- CreateIndex
CREATE INDEX "EntradaRegistro_fecha_idx" ON "EntradaRegistro"("fecha");

-- CreateIndex
CREATE INDEX "EventoEquipo_fecha_idx" ON "EventoEquipo"("fecha");

-- AddForeignKey
ALTER TABLE "Hallazgo" ADD CONSTRAINT "Hallazgo_plantaId_fkey" FOREIGN KEY ("plantaId") REFERENCES "Planta"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Hallazgo" ADD CONSTRAINT "Hallazgo_observacionId_fkey" FOREIGN KEY ("observacionId") REFERENCES "Observacion"("id") ON DELETE SET NULL ON UPDATE CASCADE;
