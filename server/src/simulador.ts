/**
 * Simulador de la demo.
 *
 * 1. A los pocos segundos de que el mapa se conecta, llega la alerta nueva
 *    en C14-P65 (el momento que se muestra en el pitch).
 * 2. Cada cierto tiempo el programador de clima deja eventos nuevos en la
 *    lista "Qué está pasando".
 */

import { ALERTA_DEMO, USUARIO } from '@vigia/shared/config';
import { aAlerta, anotar, crearHallazgo, hallazgos, plantas } from './datos';
import { aplicarReglas, responderAAlerta } from './equipos';
import { emitir } from './sse';

let programada = false;
let yaLlego = false;
let temporizador: NodeJS.Timeout | undefined;

/** Lanza la alerta del demo tras `segundos`, una sola vez por arranque. */
export function programarAlertaDemo(segundos: number): void {
  if (programada || yaLlego) return;
  programada = true;
  temporizador = setTimeout(() => {
    lanzarAlertaDemo();
  }, segundos * 1000);
}

export function lanzarAlertaDemo(): void {
  if (yaLlego) return;
  yaLlego = true;

  const hallazgo = crearHallazgo(ALERTA_DEMO.cama, ALERTA_DEMO.planta, ALERTA_DEMO.tipo, {
    confianza: 0.93,
  });

  anotar({
    plantaId: hallazgo.plantaId,
    cama: hallazgo.cama,
    accion: 'alerta_nueva',
    tipo: hallazgo.tipo,
    usuario: 'Robot X2',
    nota: `Hallazgo de ${hallazgo.tipo} con ${Math.round(hallazgo.confianza * 100)} % de confianza.`,
  });

  emitir({ tipo: 'alerta_nueva', alerta: aAlerta(hallazgo) });

  // Los equipos de la nave reaccionan a la alerta.
  const nuevos = responderAAlerta(hallazgo.nave, hallazgo.plantaId, hallazgo.cama);
  emitir({ tipo: 'equipos_actualizados', eventos: nuevos });
}

/** Reinicia el demo para poder repetir el pitch sin reiniciar el servidor. */
export function reiniciarDemo(): void {
  if (temporizador) clearTimeout(temporizador);
  temporizador = undefined;
  programada = false;
  yaLlego = false;

  // Quita la alerta del demo y devuelve la planta a su estado anterior.
  for (const [id, h] of hallazgos) {
    if (h.cama === ALERTA_DEMO.cama && h.planta === ALERTA_DEMO.planta) {
      hallazgos.delete(id);
      const planta = plantas.get(h.plantaId);
      if (planta) {
        planta.hallazgoId = undefined;
        planta.estado = planta.humedad >= 85 ? 'riesgo' : 'ok';
      }
    }
  }
}

/** Eventos periódicos del programador de clima. */
export function arrancarLatido(): NodeJS.Timeout {
  return setInterval(() => {
    const nuevos = aplicarReglas();
    if (nuevos.length > 0) {
      emitir({ tipo: 'equipos_actualizados', eventos: nuevos });
    }
  }, 20_000);
}

export const usuarioDemo = USUARIO.nombre;
