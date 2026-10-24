/**
 * Traducción entre los enums de Prisma (sin tildes ni espacios, por las
 * reglas de Postgres) y los valores exactos del contrato en
 * `@vigia/shared/tipos` (que sí los llevan). Todo lo que sale de un
 * repositorio hacia el resto de la app ya debe estar en el formato del
 * contrato — estas funciones son la única frontera donde conviven los dos.
 */
import type { TipoHallazgo as TipoHallazgoDb, EstadoEquipo as EstadoEquipoDb } from './generated/prisma/enums.js';
import type { TipoHallazgo, EstadoEquipo } from '@vigia/shared/tipos';

const TIPO_DB_A_API: Record<TipoHallazgoDb, TipoHallazgo> = {
  Botrytis: 'Botrytis',
  Alternaria: 'Alternaria',
  Trips: 'Trips',
};

const TIPO_API_A_DB: Record<TipoHallazgo, TipoHallazgoDb> = {
  Botrytis: 'Botrytis',
  Alternaria: 'Alternaria',
  Trips: 'Trips',
};

export const tipoDbAApi = (t: TipoHallazgoDb): TipoHallazgo => TIPO_DB_A_API[t];
export const tipoApiADb = (t: TipoHallazgo): TipoHallazgoDb => TIPO_API_A_DB[t];

const ESTADO_EQUIPO_DB_A_API: Record<EstadoEquipoDb, EstadoEquipo> = {
  En_marcha: 'En marcha',
  En_espera: 'En espera',
  Aviso: 'Aviso',
  Activo: 'Activo',
};

const ESTADO_EQUIPO_API_A_DB: Record<EstadoEquipo, EstadoEquipoDb> = {
  'En marcha': 'En_marcha',
  'En espera': 'En_espera',
  Aviso: 'Aviso',
  Activo: 'Activo',
};

export const estadoEquipoDbAApi = (e: EstadoEquipoDb): EstadoEquipo => ESTADO_EQUIPO_DB_A_API[e];
export const estadoEquipoApiADb = (e: EstadoEquipo): EstadoEquipoDb => ESTADO_EQUIPO_API_A_DB[e];
