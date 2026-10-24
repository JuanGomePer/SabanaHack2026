/** Acceso a datos de Equipo y EventoEquipo. Sin lógica de negocio aquí. */
import type { Equipo, EventoEquipo } from '@vigia/shared/tipos';
import { db } from '../db.js';
import type { EquipoModel as EquipoDb, EventoEquipoModel as EventoEquipoDb } from '../generated/prisma/models.js';
import { formatEventoEquipoId } from '../ids.js';
import { estadoEquipoDbAApi, estadoEquipoApiADb } from '../mappers.js';

function aEquipo(fila: EquipoDb): Omit<Equipo, 'humedad' | 'metricas'> {
  return {
    id: fila.id,
    tipo: fila.tipo,
    modelo: fila.modelo,
    nave: fila.nave,
    ubicacion: fila.ubicacion,
    estado: estadoEquipoDbAApi(fila.estado),
    potencia: fila.potencia,
    ultimoDato: fila.ultimoDato.toISOString(),
    queEstaPasando: fila.queEstaPasando,
    icono: fila.icono,
    conBarra: fila.conBarra,
  };
}

export async function listarEquiposDb(): Promise<Array<Omit<Equipo, 'humedad' | 'metricas'>>> {
  const filas = await db.equipo.findMany({ orderBy: { id: 'asc' } });
  return filas.map(aEquipo);
}

export async function obtenerEquipo(id: string): Promise<Omit<Equipo, 'humedad' | 'metricas'> | null> {
  const fila = await db.equipo.findUnique({ where: { id } });
  return fila ? aEquipo(fila) : null;
}

export async function actualizarEquipo(
  id: string,
  datos: Partial<{ estado: Equipo['estado']; potencia: number; queEstaPasando: string; ultimoDato: Date }>,
): Promise<void> {
  await db.equipo.update({
    where: { id },
    data: {
      ...datos,
      estado: datos.estado ? estadoEquipoApiADb(datos.estado) : undefined,
    },
  });
}

export interface NuevoEquipo {
  id: string;
  tipo: string;
  nombreCorto?: string;
  modelo: string;
  nave: number;
  ubicacion: string;
  estado: Equipo['estado'];
  potencia: number;
  ultimoDato: Date;
  queEstaPasando: string;
  icono: Equipo['icono'];
  conBarra: boolean;
}

export async function crearEquipos(equipos: NuevoEquipo[]): Promise<void> {
  await db.equipo.createMany({
    data: equipos.map((e) => ({ ...e, estado: estadoEquipoApiADb(e.estado) })),
  });
}

function aEvento(fila: EventoEquipoDb): EventoEquipo {
  return {
    id: formatEventoEquipoId(fila.id),
    fecha: fila.fecha.toISOString(),
    texto: fila.texto,
    nave: fila.nave ?? undefined,
    equipoId: fila.equipoId ?? undefined,
    plantaId: fila.plantaId ?? undefined,
  };
}

/** La lista "Qué está pasando" no necesita más de 20 líneas. */
export async function listarEventosEquipo(limite = 20): Promise<EventoEquipo[]> {
  const filas = await db.eventoEquipo.findMany({ orderBy: { fecha: 'desc' }, take: limite });
  return filas.map(aEvento);
}

export async function crearEventoEquipo(datos: {
  texto: string;
  nave?: number;
  equipoId?: string;
  plantaId?: string;
  fecha?: Date;
}): Promise<EventoEquipo> {
  const fila = await db.eventoEquipo.create({ data: datos });
  return aEvento(fila);
}
