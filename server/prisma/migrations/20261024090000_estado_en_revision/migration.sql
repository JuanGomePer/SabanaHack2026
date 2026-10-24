-- AlterEnum
-- La planta marcada pasa por una revisión en campo antes de darse por afectada.
ALTER TYPE "EstadoCelda" ADD VALUE 'en_revision';
ALTER TYPE "EstadoCelda" ADD VALUE 'confirmada';
ALTER TYPE "RevisionHallazgo" ADD VALUE 'en_revision';
ALTER TYPE "AccionRegistro" ADD VALUE 'en_revision';
