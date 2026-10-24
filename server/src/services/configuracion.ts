/**
 * Configuración mutable del prototipo (GET/PUT /api/configuracion).
 *
 * Se guarda en la tabla Configuracion (una sola fila) y se cachea en memoria
 * para no ir a la base de datos en cada lectura de umbral — el patrón es el
 * mismo que tenía el prototipo original (un objeto mutable compartido), solo
 * que ahora sobrevive a un reinicio del proceso.
 */
import { ESTRUCTURA, UMBRALES } from '@vigia/shared/config';
import type { Configuracion } from '@vigia/shared/tipos';
import {
  crearConfiguracionDb,
  guardarConfiguracionDb,
  obtenerConfiguracionDb,
} from '../repositories/configuracion.js';

let cache: Configuracion | null = null;

/** Se llama una vez al arrancar el servidor, antes de aceptar tráfico. */
export async function cargarConfiguracion(): Promise<Configuracion> {
  const fila = await obtenerConfiguracionDb();
  if (fila) {
    cache = { estructura: fila.estructura, umbrales: fila.umbrales };
  } else {
    cache = { estructura: { ...ESTRUCTURA }, umbrales: { ...UMBRALES } };
    await crearConfiguracionDb(cache);
  }
  return cache;
}

export function configuracionActual(): Configuracion {
  if (!cache) {
    throw new Error('Configuración no cargada todavía: falta llamar a cargarConfiguracion().');
  }
  return cache;
}

export async function actualizarConfiguracion(
  cambios: Partial<Configuracion>,
): Promise<Configuracion> {
  const actual = configuracionActual();
  const nueva: Configuracion = {
    estructura: { ...actual.estructura, ...(cambios.estructura ?? {}) },
    umbrales: { ...actual.umbrales, ...(cambios.umbrales ?? {}) },
  };
  await guardarConfiguracionDb(nueva);
  cache = nueva;
  return nueva;
}
