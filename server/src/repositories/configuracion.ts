/** Acceso a la fila única (singleton) de Configuracion. Sin lógica de negocio aquí. */
import type { ConfiguracionEstructura, ConfiguracionUmbrales } from '@vigia/shared/tipos';
import { db } from '../db.js';

const ID_SINGLETON = 1;

export interface FilaConfiguracion {
  estructura: ConfiguracionEstructura;
  umbrales: ConfiguracionUmbrales;
}

export async function obtenerConfiguracionDb(): Promise<FilaConfiguracion | null> {
  const fila = await db.configuracion.findUnique({ where: { id: ID_SINGLETON } });
  if (!fila) return null;
  return {
    estructura: fila.estructura as unknown as ConfiguracionEstructura,
    umbrales: fila.umbrales as unknown as ConfiguracionUmbrales,
  };
}

export async function crearConfiguracionDb(datos: FilaConfiguracion): Promise<void> {
  await db.configuracion.create({
    data: { id: ID_SINGLETON, estructura: datos.estructura as object, umbrales: datos.umbrales as object },
  });
}

export async function guardarConfiguracionDb(datos: FilaConfiguracion): Promise<void> {
  await db.configuracion.update({
    where: { id: ID_SINGLETON },
    data: { estructura: datos.estructura as object, umbrales: datos.umbrales as object },
  });
}
