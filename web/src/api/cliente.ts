/**
 * Único punto de contacto con la API.
 * Los componentes no traen datos de ningún otro sitio.
 */

import type {
  Alerta,
  Cama,
  Configuracion,
  DetallePlanta,
  EntradaRegistro,
  EquiposRespuesta,
  EventoEquipo,
  EventoVivo,
  Hallazgo,
  MapaRespuesta,
  RegistroRespuesta,
  RespuestaGafas,
  Resumen,
  RevisionHallazgo,
} from '@vigia/shared/tipos';

async function pedir<T>(ruta: string, opciones?: RequestInit): Promise<T> {
  const respuesta = await fetch(`/api${ruta}`, {
    headers: { 'Content-Type': 'application/json' },
    ...opciones,
  });
  if (!respuesta.ok) {
    throw new Error(`${respuesta.status} en ${ruta}`);
  }
  return (await respuesta.json()) as T;
}

export const api = {
  mapa: () => pedir<MapaRespuesta>('/mapa'),
  resumen: () => pedir<Resumen>('/resumen'),
  camas: () => pedir<Cama[]>('/camas'),
  planta: (id: string) => pedir<DetallePlanta>(`/plantas/${id}`),
  hallazgos: () => pedir<Hallazgo[]>('/hallazgos'),
  alertas: () => pedir<Alerta[]>('/alertas'),
  registro: () => pedir<RegistroRespuesta>('/registro'),
  movimientos: () => pedir<EntradaRegistro[]>('/registro/movimientos'),
  configuracion: () => pedir<Configuracion>('/configuracion'),

  guardarConfiguracion: (cambios: Partial<Configuracion>) =>
    pedir<Configuracion>('/configuracion', {
      method: 'PUT',
      body: JSON.stringify(cambios),
    }),

  revisar: (idHallazgo: string, revision: Exclude<RevisionHallazgo, 'pendiente'>, nota?: string) =>
    pedir<{ hallazgo: Hallazgo; alerta: Alerta; resumen: Resumen }>(
      `/hallazgos/${idHallazgo}/revision`,
      { method: 'POST', body: JSON.stringify({ revision, nota }) },
    ),

  /**
   * Envío a las gafas: el servidor solo simula el envío.
   * No hay integración real con Meta Quest.
   */
  enviarAGafas: (idHallazgo: string) =>
    pedir<RespuestaGafas>(`/hallazgos/${idHallazgo}/enviar-a-gafas`, { method: 'POST' }),

  equipos: () => pedir<EquiposRespuesta & { nota: string }>('/equipos'),
  eventosEquipos: () => pedir<EventoEquipo[]>('/equipos/eventos'),

  servicio: (tipo: 'servicio' | 'catalogo') =>
    pedir<{ ok: boolean; tipo: string; mensaje: string }>('/equipos/servicio', {
      method: 'POST',
      body: JSON.stringify({ tipo }),
    }),

  reiniciarDemo: () => pedir<{ ok: boolean }>('/demo/reiniciar', { method: 'POST' }),
};

/** Suscripción a los eventos en vivo (SSE). Devuelve la función para cerrar. */
export function escucharEventos(alRecibir: (evento: EventoVivo) => void): () => void {
  const fuente = new EventSource('/api/eventos');
  fuente.onmessage = (mensaje) => {
    try {
      alRecibir(JSON.parse(mensaje.data) as EventoVivo);
    } catch {
      // Los comentarios de latido (": latido") no son JSON; se ignoran.
    }
  };
  return () => fuente.close();
}
