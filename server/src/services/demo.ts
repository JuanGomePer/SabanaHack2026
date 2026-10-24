/**
 * Simulador de la demo.
 *
 * 1. A los pocos segundos de que el mapa se conecta llega la primera alerta
 *    (C14-P65, el momento que se muestra en el pitch) y detrás van cayendo
 *    las demás del guion. No esperan a que nadie las revise: el robot sigue
 *    su ronda pase lo que pase, y en pantalla se apilan.
 * 2. Cada cierto tiempo el programador de clima deja eventos nuevos en la
 *    lista "Qué está pasando".
 */
import { ALERTA_DEMO, GUION_ALERTAS_DEMO } from '@vigia/shared/config';
import * as hallazgosRepo from '../repositories/hallazgos.js';
import * as plantasRepo from '../repositories/plantas.js';
import { anotarRegistro } from '../repositories/registro.js';
import { emitir } from '../sse.js';
import { aAlerta, crearHallazgo } from './hallazgos.js';
import { aplicarReglas, responderAAlerta } from './equipos.js';
import { avisarPorSms, reiniciarSms } from './sms.js';
import { generarInsightDeAlerta, revisarPatrones } from '../vigia/reglas.js';

let programada = false;
/** Pasos del guion ya lanzados, por índice. */
const lanzados = new Set<number>();
let temporizadores: NodeJS.Timeout[] = [];

/**
 * Programa toda la tanda de alertas, una sola vez por arranque del proceso.
 * `segundos` es la demora de la primera (la configurable); las demás usan los
 * tiempos del guion. Ninguna espera a que se revise la anterior.
 */
export function programarAlertaDemo(segundos: number): void {
  if (programada) return;
  programada = true;

  GUION_ALERTAS_DEMO.forEach((paso, indice) => {
    const espera = indice === 0 ? segundos : paso.segundos;
    temporizadores.push(
      setTimeout(() => {
        lanzarPaso(indice).catch((error) =>
          console.error('[demo] no se pudo lanzar la alerta:', error),
        );
      }, espera * 1000),
    );
  });
}

/** Lanza la primera alerta del guion a mano (la del pitch). */
export async function lanzarAlertaDemo(): Promise<void> {
  await lanzarPaso(0);
}

async function lanzarPaso(indice: number): Promise<void> {
  if (lanzados.has(indice)) return;
  lanzados.add(indice);

  const paso = GUION_ALERTAS_DEMO[indice];
  if (!paso) return;

  const hallazgo = await crearHallazgo(paso.cama, paso.planta, paso.tipo, {
    confianza: paso.confianza,
  });

  await anotarRegistro({
    plantaId: hallazgo.plantaId,
    cama: hallazgo.cama,
    accion: 'alerta_nueva',
    tipo: hallazgo.tipo,
    usuario: 'Robot X2',
    nota: `Hallazgo de ${hallazgo.tipo} con ${Math.round(hallazgo.confianza * 100)} % de confianza.`,
  });

  const alerta = aAlerta(hallazgo);
  emitir({ tipo: 'alerta_nueva', alerta });

  // Canal de respaldo: si toca, el aviso sale también al celular.
  await avisarPorSms(alerta).catch((error) =>
    console.error('[demo] no se pudo avisar por SMS:', error),
  );

  // vigIA anota el hallazgo como insight, para el chat y el historial.
  await generarInsightDeAlerta(alerta).catch((error) =>
    console.error('[demo] vigIA no pudo generar el insight:', error),
  );

  const nuevos = await responderAAlerta(hallazgo.nave, hallazgo.plantaId, hallazgo.cama);
  emitir({ tipo: 'equipos_actualizados', eventos: nuevos });
}

/** Reinicia el demo para poder repetir el pitch sin reiniciar el servidor. */
export async function reiniciarDemo(): Promise<void> {
  for (const temporizador of temporizadores) clearTimeout(temporizador);
  temporizadores = [];
  programada = false;
  lanzados.clear();
  reiniciarSms();

  // Se borran todas las del guion, no solo la primera.
  for (const paso of GUION_ALERTAS_DEMO) {
    const plantaIds = await hallazgosRepo.eliminarHallazgosDeDemo(paso.cama, paso.planta);
    for (const plantaId of plantaIds) {
      const planta = await plantasRepo.obtenerPlanta(plantaId);
      if (!planta) continue;
      const estado = planta.humedad >= 85 ? 'riesgo' : 'ok';
      await plantasRepo.actualizarEstadoPlanta(plantaId, { estado, hallazgoId: null });
    }
  }
}

/** Eventos periódicos del programador de clima + chequeo de patrones de vigIA. */
export function arrancarLatido(): NodeJS.Timeout {
  return setInterval(() => {
    aplicarReglas()
      .then((nuevos) => {
        if (nuevos.length > 0) emitir({ tipo: 'equipos_actualizados', eventos: nuevos });
      })
      .catch((error) => console.error('[latido] aplicarReglas falló:', error));

    revisarPatrones().catch((error) => console.error('[latido] vigIA.revisarPatrones falló:', error));
  }, 20_000);
}
