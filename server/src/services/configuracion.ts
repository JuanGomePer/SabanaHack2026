/**
 * Configuración mutable del prototipo (GET/PUT /api/configuracion).
 *
 * Se guarda en la tabla Configuracion (una sola fila) y se cachea en memoria
 * para no ir a la base de datos en cada lectura de umbral — el patrón es el
 * mismo que tenía el prototipo original (un objeto mutable compartido), solo
 * que ahora sobrevive a un reinicio del proceso.
 */
import { ESTRUCTURA, UMBRALES, USUARIO } from '@vigia/shared/config';
import type { Configuracion, PerfilUsuario } from '@vigia/shared/tipos';
import {
  crearConfiguracionDb,
  guardarConfiguracionDb,
  obtenerConfiguracionDb,
} from '../repositories/configuracion.js';

const PERFIL_DEFECTO: PerfilUsuario = {
  nombre: USUARIO.nombre,
  firma: USUARIO.firma,
  rol: USUARIO.rol,
};

let cache: Configuracion | null = null;

/** Se llama una vez al arrancar el servidor, antes de aceptar tráfico. */
export async function cargarConfiguracion(): Promise<Configuracion> {
  const fila = await obtenerConfiguracionDb();
  if (fila) {
    cache = { estructura: fila.estructura, umbrales: fila.umbrales, perfil: fila.perfil ?? PERFIL_DEFECTO };
  } else {
    cache = { estructura: { ...ESTRUCTURA }, umbrales: { ...UMBRALES }, perfil: { ...PERFIL_DEFECTO } };
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
    perfil: { ...actual.perfil, ...(cambios.perfil ?? {}) },
  };
  await guardarConfiguracionDb(nueva);
  cache = nueva;
  return nueva;
}
