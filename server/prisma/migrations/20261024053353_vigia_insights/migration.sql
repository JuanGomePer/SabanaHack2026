-- CreateEnum
CREATE TYPE "PrioridadInsight" AS ENUM ('alta', 'media', 'baja');

-- CreateEnum
CREATE TYPE "EstadoInsight" AS ENUM ('nuevo', 'revisado', 'descartado');

-- CreateEnum
CREATE TYPE "TipoInsight" AS ENUM ('alerta_nueva', 'zona_recurrente', 'humedad_persistente', 'cambio_ambiental', 'equipo_sin_respuesta', 'resumen_ronda');

-- CreateTable
CREATE TABLE "Insight" (
    "id" TEXT NOT NULL,
    "tipo" "TipoInsight" NOT NULL,
    "titulo" TEXT NOT NULL,
    "descripcion" TEXT NOT NULL,
    "prioridad" "PrioridadInsight" NOT NULL,
    "fecha" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ubicacion" TEXT,
    "cama" INTEGER,
    "planta" INTEGER,
    "nave" INTEGER,
    "datos" JSONB NOT NULL,
    "factores" JSONB,
    "confianza" DOUBLE PRECISION,
    "explicacion" TEXT,
    "recomendacion" TEXT,
    "detalleTipo" TEXT,
    "detalleId" TEXT,
    "estado" "EstadoInsight" NOT NULL DEFAULT 'nuevo',
    "dedupeKey" TEXT,

    CONSTRAINT "Insight_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Insight_dedupeKey_key" ON "Insight"("dedupeKey");

-- CreateIndex
CREATE INDEX "Insight_fecha_idx" ON "Insight"("fecha");

-- CreateIndex
CREATE INDEX "Insight_estado_idx" ON "Insight"("estado");

-- CreateIndex
CREATE INDEX "Insight_tipo_idx" ON "Insight"("tipo");
