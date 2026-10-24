/** Acceso a datos de la bitácora (EntradaRegistro). Sin lógica de negocio aquí. */
import type { EntradaRegistro } from '@vigia/shared/tipos';
import { db } from '../db.js';
import type { EntradaRegistroModel as EntradaRegistroDb } from '../generated/prisma/models.js';
import { formatRegistroId } from '../ids.js';
import { tipoDbAApi, tipoApiADb } from '../mappers.js';

function aEntrada(fila: EntradaRegistroDb): EntradaRegistro {
  return {
    id: formatRegistroId(fila.id),
    fecha: fila.fecha.toISOString(),
    plantaId: fila.plantaId ?? undefined,
    cama: fila.cama ?? undefined,
    accion: fila.accion,
    tipo: fila.tipo ? tipoDbAApi(fila.tipo) : undefined,
    usuario: fila.usuario,
    nota: fila.nota,
  };
}

export async function listarRegistro(): Promise<EntradaRegistro[]> {
  const filas = await db.entradaRegistro.findMany({ orderBy: { fecha: 'desc' } });
  return filas.map(aEntrada);
}

export async function anotarRegistro(
  entrada: Omit<EntradaRegistro, 'id' | 'fecha'> & { fecha?: Date },
): Promise<EntradaRegistro> {
  const fila = await db.entradaRegistro.create({
    data: {
      fecha: entrada.fecha,
      plantaId: entrada.plantaId,
      cama: entrada.cama,
      accion: entrada.accion,
      tipo: entrada.tipo ? tipoApiADb(entrada.tipo) : undefined,
      usuario: entrada.usuario,
      nota: entrada.nota,
    },
  });
  return aEntrada(fila);
}
