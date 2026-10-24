/**
 * Acceso a Observacion: el payload crudo que manda el módulo de visión (o
 * cualquier otro cliente externo) a POST /api/observaciones, guardado tal
 * cual para trazabilidad, además del/los Hallazgo que se derivan de él.
 */
import { randomUUID } from 'node:crypto';
import { db } from '../db.js';

export async function guardarObservacion(payload: unknown, fuente: string): Promise<string> {
  const id = `OBS-${randomUUID()}`;
  await db.observacion.create({ data: { id, payload: payload as object, fuente } });
  return id;
}
