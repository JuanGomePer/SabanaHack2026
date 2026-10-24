/**
 * Único punto de contacto con la API.
 * Los componentes no traen datos de ningún otro sitio.
 *
 * En desarrollo, `/api` lo resuelve el proxy de Vite (vite.config.ts) contra
 * el server local. En producción (el sitio estático desplegado en Render)
 * no hay proxy, así que `VITE_API_URL` — fijada en build time — apunta
 * directo a la URL pública del servicio de la API.
 */
const BASE_URL = (import.meta.env.VITE_API_URL ?? '/api').replace(/\/$/, '');

import type {
  AccionVigia,
  Alerta,
  Cama,
  Configuracion,
  ConfiguracionSms,
  DestinoSms,
  DetallePlanta,
  EntradaRegistro,
  EquiposRespuesta,
  EstadoInsight,
  EventoEquipo,
  EventoVivo,
  Hallazgo,
  MapaRespuesta,
  RegistroRespuesta,
  RespuestaGafas,
  RespuestaVigia,
  Resumen,
  RevisionHallazgo,
  SimulacionRespuesta,
  SmsRespuesta,
  VerificacionPasarela,
  VigiaInsightsRespuesta,
  VigiaRespuestaAcciones,
} from '@vigia/shared/tipos';

async function pedir<T>(ruta: string, opciones?: RequestInit): Promise<T> {
  const respuesta = await fetch(`${BASE_URL}${ruta}`, {
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
  /** URL completa del CSV, resuelta contra la misma base que el resto de la API (dev y producción). */
  registroCsvUrl: () => `${BASE_URL}/registro.csv`,
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

  // ── Avisos por SMS (canal de respaldo; el envío es simulado) ──────────────
  sms: () => pedir<SmsRespuesta>('/sms'),

  guardarSms: (cambios: Partial<Omit<ConfiguracionSms, 'destinos'>>) =>
    pedir<SmsRespuesta>('/sms', { method: 'PUT', body: JSON.stringify(cambios) }),

  agregarNumeroSms: (nombre: string, numero: string) =>
    pedir<SmsRespuesta & { destino: DestinoSms }>('/sms/destinos', {
      method: 'POST',
      body: JSON.stringify({ nombre, numero }),
    }),

  cambiarNumeroSms: (id: string, cambios: Partial<Pick<DestinoSms, 'nombre' | 'numero' | 'activo'>>) =>
    pedir<SmsRespuesta & { destino: DestinoSms }>(`/sms/destinos/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(cambios),
    }),

  quitarNumeroSms: (id: string) =>
    pedir<SmsRespuesta>(`/sms/destinos/${id}`, { method: 'DELETE' }),

  probarSms: () => pedir<SmsRespuesta & { enviados: number }>('/sms/prueba', { method: 'POST' }),

  /** Comprueba las credenciales de la pasarela sin gastar un mensaje. */
  verificarPasarela: () =>
    pedir<SmsRespuesta & { verificacion: VerificacionPasarela }>('/sms/verificar', {
      method: 'POST',
    }),

  /** Simulación de tratar vs. no tratar un hallazgo (vigIA). */
  simular: (idHallazgo: string, dias = 7) =>
    pedir<SimulacionRespuesta>(`/hallazgos/${idHallazgo}/simular`, {
      method: 'POST',
      body: JSON.stringify({ dias }),
    }),

  // ── vigIA: botones de consulta + insights automáticos ─────────────────────
  vigiaAcciones: () => pedir<VigiaRespuestaAcciones>('/vigia/acciones'),

  vigiaConsultar: (accion: AccionVigia | null, parametros?: Record<string, string>, pregunta?: string) =>
    pedir<RespuestaVigia>('/vigia/consultar', {
      method: 'POST',
      body: JSON.stringify({ accion, parametros, pregunta }),
    }),

  vigiaInsights: (estado?: EstadoInsight, limite?: number) =>
    pedir<VigiaInsightsRespuesta>(
      `/vigia/insights${estado ? `?estado=${estado}${limite ? `&limite=${limite}` : ''}` : limite ? `?limite=${limite}` : ''}`,
    ),

  marcarInsight: (id: string, estado: EstadoInsight) =>
    pedir<VigiaInsightsRespuesta['insights'][number]>(`/vigia/insights/${id}`, {
      method: 'PATCH',
      body: JSON.stringify({ estado }),
    }),
};

/** Suscripción a los eventos en vivo (SSE). Devuelve la función para cerrar. */
export function escucharEventos(alRecibir: (evento: EventoVivo) => void): () => void {
  const fuente = new EventSource(`${BASE_URL}/eventos`);
  fuente.onmessage = (mensaje) => {
    try {
      alRecibir(JSON.parse(mensaje.data) as EventoVivo);
    } catch {
      // Los comentarios de latido (": latido") no son JSON; se ignoran.
    }
  };
  return () => fuente.close();
}
