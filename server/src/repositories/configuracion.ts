/** Acceso a la fila única (singleton) de Configuracion. Sin lógica de negocio aquí. */
import type { ConfiguracionEstructura, ConfiguracionUmbrales, PerfilUsuario } from '@vigia/shared/tipos';
import { db } from '../db.js';

const ID_SINGLETON = 1;

export interface FilaConfiguracion {
  estructura: ConfiguracionEstructura;
  umbrales: ConfiguracionUmbrales;
  /** Null en filas sembradas antes de que existiera el perfil editable. */
  perfil: PerfilUsuario | null;
}

export async function obtenerConfiguracionDb(): Promise<FilaConfiguracion | null> {
  const fila = await db.configuracion.findUnique({ where: { id: ID_SINGLETON } });
  if (!fila) return null;
  return {
    estructura: fila.estructura as unknown as ConfiguracionEstructura,
    umbrales: fila.umbrales as unknown as ConfiguracionUmbrales,
    perfil: (fila.perfil as unknown as PerfilUsuario | null) ?? null,
  };
}

export async function crearConfiguracionDb(datos: Omit<FilaConfiguracion, 'perfil'> & { perfil: PerfilUsuario }): Promise<void> {
  await db.configuracion.create({
    data: {
      id: ID_SINGLETON,
      estructura: datos.estructura as object,
      umbrales: datos.umbrales as object,
      perfil: datos.perfil as object,
    },
  });
}

export async function guardarConfiguracionDb(
  datos: Omit<FilaConfiguracion, 'perfil'> & { perfil: PerfilUsuario },
): Promise<void> {
  await db.configuracion.update({
    where: { id: ID_SINGLETON },
    data: {
      estructura: datos.estructura as object,
      umbrales: datos.umbrales as object,
      perfil: datos.perfil as object,
    },
  });
}
