/** Acceso a datos de la tabla Hallazgo. Sin lógica de negocio aquí. */
import type { Hallazgo, TipoHallazgo } from '@vigia/shared/tipos';
import { db } from '../db.js';
import type { HallazgoModel as HallazgoDb } from '../generated/prisma/models.js';
import { formatHallazgoId, parseHallazgoId } from '../ids.js';
import { tipoDbAApi, tipoApiADb } from '../mappers.js';

function aHallazgo(fila: HallazgoDb): Hallazgo {
  return {
    id: formatHallazgoId(fila.id),
    plantaId: fila.plantaId,
    cama: fila.cama,
    planta: fila.planta,
    nave: fila.nave,
    tipo: tipoDbAApi(fila.tipo),
    confianza: fila.confianza,
    bbox: { x: fila.bboxX, y: fila.bboxY, w: fila.bboxW, h: fila.bboxH },
    revision: fila.revision,
    detectadoEn: fila.detectadoEn.toISOString(),
    humedad: fila.humedad,
    fotoUrl: fila.fotoUrl,
    gafas: fila.gafas,
    recomendacion: fila.recomendacion,
  };
}

export async function obtenerHallazgo(id: string): Promise<Hallazgo | null> {
  const n = parseHallazgoId(id);
  if (n === null) return null;
  const fila = await db.hallazgo.findUnique({ where: { id: n } });
  return fila ? aHallazgo(fila) : null;
}

export async function listarHallazgos(): Promise<Hallazgo[]> {
  const filas = await db.hallazgo.findMany({ orderBy: { detectadoEn: 'desc' } });
  return filas.map(aHallazgo);
}

export async function listarHallazgosDesde(desde: Date): Promise<Hallazgo[]> {
  const filas = await db.hallazgo.findMany({
    where: { detectadoEn: { gte: desde } },
    orderBy: { detectadoEn: 'desc' },
  });
  return filas.map(aHallazgo);
}

export interface NuevoHallazgo {
  plantaId: string;
  cama: number;
  planta: number;
  nave: number;
  tipo: TipoHallazgo;
  confianza: number;
  bbox: { x: number; y: number; w: number; h: number };
  revision: Hallazgo['revision'];
  detectadoEn: Date;
  humedad: number;
  recomendacion: string;
  reviso?: string;
  origen: 'simulador' | 'vision' | 'manual';
  observacionId?: string;
}

export async function crearHallazgo(datos: NuevoHallazgo): Promise<Hallazgo> {
  const fila = await db.hallazgo.create({
    data: {
      plantaId: datos.plantaId,
      cama: datos.cama,
      planta: datos.planta,
      nave: datos.nave,
      tipo: tipoApiADb(datos.tipo),
      confianza: datos.confianza,
      bboxX: datos.bbox.x,
      bboxY: datos.bbox.y,
      bboxW: datos.bbox.w,
      bboxH: datos.bbox.h,
      revision: datos.revision,
      detectadoEn: datos.detectadoEn,
      humedad: datos.humedad,
      fotoUrl: '', // se completa justo después: necesita el id ya asignado.
      recomendacion: datos.recomendacion,
      reviso: datos.reviso,
      origen: datos.origen,
      observacionId: datos.observacionId,
    },
  });
  const fotoUrl = `/api/fotos/${formatHallazgoId(fila.id)}.svg`;
  const actualizada = await db.hallazgo.update({ where: { id: fila.id }, data: { fotoUrl } });
  return aHallazgo(actualizada);
}

export async function actualizarRevisionHallazgo(
  id: string,
  revision: Hallazgo['revision'],
  reviso: string,
): Promise<Hallazgo | null> {
  const n = parseHallazgoId(id);
  if (n === null) return null;
  const fila = await db.hallazgo.update({ where: { id: n }, data: { revision, reviso } });
  return aHallazgo(fila);
}

export async function actualizarGafasHallazgo(
  id: string,
  gafas: Hallazgo['gafas'],
): Promise<Hallazgo | null> {
  const n = parseHallazgoId(id);
  if (n === null) return null;
  const fila = await db.hallazgo.update({ where: { id: n }, data: { gafas } });
  return aHallazgo(fila);
}

export async function eliminarHallazgosDeDemo(cama: number, planta: number): Promise<string[]> {
  const filas = await db.hallazgo.findMany({ where: { cama, planta } });
  if (filas.length === 0) return [];
  await db.hallazgo.deleteMany({ where: { cama, planta } });
  return filas.map((f) => f.plantaId);
}

export async function contarHallazgos(): Promise<number> {
  return db.hallazgo.count();
}

export interface FilaHallazgoParaRegistro {
  id: string;
  detectadoEn: string;
  plantaId: string;
  cama: number;
  planta: number;
  nave: number;
  tipo: TipoHallazgo;
  confianza: number;
  revision: Hallazgo['revision'];
  reviso?: string;
}

/**
 * Igual que `listarHallazgos`, pero incluye `reviso` — que no es parte del
 * contrato `Hallazgo` (solo lo usa `FilaRegistro`, en el registro de
 * incidencias), así que vive en su propio tipo en vez de ensuciar `aHallazgo`.
 */
export async function listarHallazgosParaRegistro(): Promise<FilaHallazgoParaRegistro[]> {
  const filas = await db.hallazgo.findMany({ orderBy: { detectadoEn: 'desc' } });
  return filas.map((f) => ({
    id: formatHallazgoId(f.id),
    detectadoEn: f.detectadoEn.toISOString(),
    plantaId: f.plantaId,
    cama: f.cama,
    planta: f.planta,
    nave: f.nave,
    tipo: tipoDbAApi(f.tipo),
    confianza: f.confianza,
    revision: f.revision,
    reviso: f.reviso ?? undefined,
  }));
}

/** Plantas con un hallazgo pendiente de revisión (para el KPI "por revisar"). */
export async function plantaIdsConHallazgoPendiente(): Promise<Set<string>> {
  const filas = await db.hallazgo.findMany({
    where: { revision: 'pendiente' },
    select: { plantaId: true },
  });
  return new Set(filas.map((f) => f.plantaId));
}
