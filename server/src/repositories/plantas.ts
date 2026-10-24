/** Acceso a datos de la tabla Planta. Sin lógica de negocio aquí. */
import type { Planta } from '@vigia/shared/tipos';
import { db } from '../db.js';
import type { PlantaModel as PlantaDb } from '../generated/prisma/models.js';

function aPlanta(fila: PlantaDb): Planta {
  return {
    id: fila.id,
    cama: fila.cama,
    planta: fila.planta,
    nave: fila.nave,
    estado: fila.estado,
    humedad: fila.humedad,
    temperatura: fila.temperatura,
    hallazgoId: fila.hallazgoId ?? undefined,
    ultimaLectura: fila.ultimaLectura.toISOString(),
  };
}

export async function obtenerPlanta(id: string): Promise<Planta | null> {
  const fila = await db.planta.findUnique({ where: { id } });
  return fila ? aPlanta(fila) : null;
}

/** Todo el cultivo. ~2.400 filas en el tamaño de referencia: una sola consulta, sin paginar. */
export async function listarPlantas(): Promise<Planta[]> {
  const filas = await db.planta.findMany({ orderBy: [{ cama: 'asc' }, { planta: 'asc' }] });
  return filas.map(aPlanta);
}

export async function listarPlantasDeCama(cama: number): Promise<Planta[]> {
  const filas = await db.planta.findMany({ where: { cama }, orderBy: { planta: 'asc' } });
  return filas.map(aPlanta);
}

/** Vecinas: misma cama, hasta 3 plantas a cada lado, incluida ella. */
export async function listarVecinas(cama: number, planta: number): Promise<Planta[]> {
  const filas = await db.planta.findMany({
    where: { cama, planta: { gte: planta - 3, lte: planta + 3 } },
    orderBy: { planta: 'asc' },
  });
  return filas.map(aPlanta);
}

export async function actualizarEstadoPlanta(
  id: string,
  datos: { estado: Planta['estado']; hallazgoId: string | null },
): Promise<void> {
  await db.planta.update({ where: { id }, data: datos });
}

export async function contarPlantas(): Promise<number> {
  return db.planta.count();
}

/** Solo para la siembra inicial. */
export async function crearPlantas(
  filas: Array<Omit<Planta, 'hallazgoId' | 'ultimaLectura'> & { ultimaLectura: Date }>,
): Promise<void> {
  await db.planta.createMany({
    data: filas.map((f) => ({ ...f, hallazgoId: null })),
  });
}
