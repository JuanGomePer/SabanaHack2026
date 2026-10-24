-- Solo 3 enfermedades/plagas en el contrato: Botrytis, Alternaria, Trips.
-- Antes era "Oidio" (sin tilde, por las reglas de enum de Postgres).
ALTER TYPE "TipoHallazgo" RENAME VALUE 'Oidio' TO 'Trips';

-- Perfil del usuario de la demo (nombre/rol), editable desde Configuración.
ALTER TABLE "Configuracion" ADD COLUMN "perfil" JSONB;
