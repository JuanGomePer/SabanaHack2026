/**
 * Simulador de la demo.
 *
 * 1. A los pocos segundos de que el mapa se conecta, llega la alerta nueva
 *    en C14-P65 (el momento que se muestra en el pitch).
 * 2. Cada cierto tiempo el programador de clima deja eventos nuevos en la
 *    lista "Qué está pasando".
 */
import { ALERTA_DEMO } from '@vigia/shared/config';
import * as hallazgosRepo from '../repositories/hallazgos.js';
import * as plantasRepo from '../repositories/plantas.js';
import { anotarRegistro } from '../repositories/registro.js';
import { emitir } from '../sse.js';
import { aAlerta, crearHallazgo } from './hallazgos.js';
import { aplicarReglas, responderAAlerta } from './equipos.js';

let programada = false;
let yaLlego = false;
let temporizador: NodeJS.Timeout | undefined;

/** Lanza la alerta del demo tras `segundos`, una sola vez por arranque del proceso. */
export function programarAlertaDemo(segundos: number): void {
  if (programada || yaLlego) return;
  programada = true;
  temporizador = setTimeout(() => {
    lanzarAlertaDemo().catch((error) => console.error('[demo] no se pudo lanzar la alerta:', error));
  }, segundos * 1000);
}

export async function lanzarAlertaDemo(): Promise<void> {
  if (yaLlego) return;
  yaLlego = true;

  const hallazgo = await crearHallazgo(ALERTA_DEMO.cama, ALERTA_DEMO.planta, ALERTA_DEMO.tipo, {
    confianza: 0.93,
  });

  await anotarRegistro({
    plantaId: hallazgo.plantaId,
    cama: hallazgo.cama,
    accion: 'alerta_nueva',
    tipo: hallazgo.tipo,
    usuario: 'Robot X2',
    nota: `Hallazgo de ${hallazgo.tipo} con ${Math.round(hallazgo.confianza * 100)} % de confianza.`,
  });

  emitir({ tipo: 'alerta_nueva', alerta: aAlerta(hallazgo) });

  const nuevos = await responderAAlerta(hallazgo.nave, hallazgo.plantaId, hallazgo.cama);
  emitir({ tipo: 'equipos_actualizados', eventos: nuevos });
}

/** Reinicia el demo para poder repetir el pitch sin reiniciar el servidor. */
export async function reiniciarDemo(): Promise<void> {
  if (temporizador) clearTimeout(temporizador);
  temporizador = undefined;
  programada = false;
  yaLlego = false;

  const plantaIds = await hallazgosRepo.eliminarHallazgosDeDemo(ALERTA_DEMO.cama, ALERTA_DEMO.planta);
  for (const plantaId of plantaIds) {
    const planta = await plantasRepo.obtenerPlanta(plantaId);
    if (!planta) continue;
    const estado = planta.humedad >= 85 ? 'riesgo' : 'ok';
    await plantasRepo.actualizarEstadoPlanta(plantaId, { estado, hallazgoId: null });
  }
}

/** Eventos periódicos del programador de clima. */
export function arrancarLatido(): NodeJS.Timeout {
  return setInterval(() => {
    aplicarReglas()
      .then((nuevos) => {
        if (nuevos.length > 0) emitir({ tipo: 'equipos_actualizados', eventos: nuevos });
      })
      .catch((error) => console.error('[latido] aplicarReglas falló:', error));
  }, 20_000);
}
