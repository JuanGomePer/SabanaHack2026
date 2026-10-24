/** Acceso a datos de Insight (los hallazgos de vigIA, no los del robot). */
import type { EstadoInsight, Insight, PrioridadInsight, TipoInsight } from '@vigia/shared/tipos';
import { db } from '../db.js';
import type { InsightModel } from '../generated/prisma/models.js';

function aInsight(fila: InsightModel): Insight {
  return {
    id: fila.id,
    tipo: fila.tipo,
    titulo: fila.titulo,
    descripcion: fila.descripcion,
    prioridad: fila.prioridad,
    fecha: fila.fecha.toISOString(),
    ubicacion: fila.ubicacion ?? undefined,
    cama: fila.cama ?? undefined,
    planta: fila.planta ?? undefined,
    nave: fila.nave ?? undefined,
    datos: fila.datos as Record<string, unknown>,
    factores: (fila.factores as string[] | null) ?? undefined,
    confianza: fila.confianza ?? undefined,
    explicacion: fila.explicacion ?? undefined,
    recomendacion: fila.recomendacion ?? undefined,
    detalleTipo: (fila.detalleTipo as Insight['detalleTipo']) ?? undefined,
    detalleId: fila.detalleId ?? undefined,
    estado: fila.estado,
  };
}

export async function listarInsights(opciones: {
  estado?: EstadoInsight;
  limite?: number;
} = {}): Promise<Insight[]> {
  const filas = await db.insight.findMany({
    where: opciones.estado ? { estado: opciones.estado } : undefined,
    orderBy: { fecha: 'desc' },
    take: opciones.limite ?? 50,
  });
  return filas.map(aInsight);
}

export async function contarInsightsNuevos(): Promise<number> {
  return db.insight.count({ where: { estado: 'nuevo' } });
}

export interface NuevoInsight {
  tipo: TipoInsight;
  titulo: string;
  descripcion: string;
  prioridad: PrioridadInsight;
  ubicacion?: string;
  cama?: number;
  planta?: number;
  nave?: number;
  datos: Record<string, unknown>;
  factores?: string[];
  confianza?: number;
  explicacion?: string;
  recomendacion?: string;
  detalleTipo?: Insight['detalleTipo'];
  detalleId?: string;
  /** Si ya existe un insight con esta clave, no se crea otro — se devuelve `null`. */
  dedupeKey?: string;
}

/** Crea el insight, o `null` si ya existía uno con la misma `dedupeKey`. */
export async function crearInsightSiNuevo(datos: NuevoInsight): Promise<Insight | null> {
  if (datos.dedupeKey) {
    const existente = await db.insight.findUnique({ where: { dedupeKey: datos.dedupeKey } });
    if (existente) return null;
  }

  try {
    const fila = await db.insight.create({
      data: {
        tipo: datos.tipo,
        titulo: datos.titulo,
        descripcion: datos.descripcion,
        prioridad: datos.prioridad,
        ubicacion: datos.ubicacion,
        cama: datos.cama,
        planta: datos.planta,
        nave: datos.nave,
        datos: datos.datos as object,
        factores: datos.factores as object | undefined,
        confianza: datos.confianza,
        explicacion: datos.explicacion,
        recomendacion: datos.recomendacion,
        detalleTipo: datos.detalleTipo,
        detalleId: datos.detalleId,
        dedupeKey: datos.dedupeKey,
      },
    });
    return aInsight(fila);
  } catch (error) {
    // Carrera rara (dos disparadores a la vez): otro proceso ya lo creó.
    if (datos.dedupeKey && esErrorDeUnicidad(error)) return null;
    throw error;
  }
}

function esErrorDeUnicidad(error: unknown): boolean {
  return typeof error === 'object' && error !== null && 'code' in error && error.code === 'P2002';
}

export async function actualizarEstadoInsight(
  id: string,
  estado: EstadoInsight,
): Promise<Insight | null> {
  try {
    const fila = await db.insight.update({ where: { id }, data: { estado } });
    return aInsight(fila);
  } catch {
    return null;
  }
}
