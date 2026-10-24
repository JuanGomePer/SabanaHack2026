/**
 * Simulación de "tratar vs. no tratar" un hallazgo.
 *
 * Es una proyección determinista con reglas simples (probabilidad de
 * contagio por tipo de hongo, ajustada por humedad) — NO es un modelo
 * epidemiológico real ni una predicción clínica. Sirve para mostrar en la
 * demo el contraste entre actuar rápido y dejarlo pasar; el texto de la
 * respuesta lo deja explícito.
 */
import { etiquetaPlanta } from '@vigia/shared/config';
import type { EstadoSimuladoDia, SimulacionRespuesta, TipoHallazgo } from '@vigia/shared/tipos';
import { parseHallazgoId } from '../ids.js';
import { obtenerHallazgo } from '../repositories/hallazgos.js';
import { listarPlantasDeCama } from '../repositories/plantas.js';

/** Probabilidad diaria de que una planta vecina sana se contagie si NO se trata. */
const PROB_CONTAGIO_DIARIA: Record<TipoHallazgo, number> = {
  Botrytis: 0.22,
  Alternaria: 0.14,
  Trips: 0.18,
};

/** Cuántas plantas a cada lado se consideran "vecinas" para el contagio. */
const RADIO_VECINAS = 5;

/** Días que tarda en resolverse si se trata a tiempo. */
const DIAS_RESOLUCION = 2;

/** Generador pseudoaleatorio estable: mismo hallazgo → misma proyección. */
function prng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export async function simularEvolucion(
  hallazgoIdTexto: string,
  dias = 7,
): Promise<SimulacionRespuesta | null> {
  const hallazgo = await obtenerHallazgo(hallazgoIdTexto);
  if (!hallazgo) return null;

  const numero = parseHallazgoId(hallazgo.id) ?? 1;
  const aleatorio = prng(numero * 7919 + dias);

  const vecinas = (await listarPlantasDeCama(hallazgo.cama)).filter(
    (p) => p.id !== hallazgo.plantaId && Math.abs(p.planta - hallazgo.planta) <= RADIO_VECINAS,
  );

  const factorHumedad = hallazgo.humedad >= 85 ? 1.4 : 1;
  const probBase = Math.min(0.9, PROB_CONTAGIO_DIARIA[hallazgo.tipo] * factorHumedad);

  // Rama tratada: se resuelve en DIAS_RESOLUCION días, sin contagio adicional.
  const tratada: EstadoSimuladoDia[] = [];
  for (let dia = 1; dia <= dias; dia++) {
    const resuelto = dia >= DIAS_RESOLUCION;
    tratada.push({
      dia,
      sanas: resuelto ? vecinas.length + 1 : vecinas.length,
      riesgo: 0,
      alerta: resuelto ? 0 : 1,
      nuevasAfectadas: [],
    });
  }

  // Rama sin tratar: cada vecina sana puede pasar a "riesgo" y luego a "alerta".
  const noTratada: EstadoSimuladoDia[] = [];
  const estadoVecinas = new Map<string, 'sana' | 'riesgo' | 'alerta'>(vecinas.map((v) => [v.id, 'sana']));

  for (let dia = 1; dia <= dias; dia++) {
    const nuevas: string[] = [];
    for (const [id, estado] of estadoVecinas) {
      if (estado === 'sana' && aleatorio() < probBase) {
        estadoVecinas.set(id, 'riesgo');
      } else if (estado === 'riesgo' && aleatorio() < probBase * 1.5) {
        estadoVecinas.set(id, 'alerta');
        nuevas.push(id);
      }
    }
    let sanas = 0;
    let riesgo = 0;
    let alertaVecinas = 0;
    for (const estado of estadoVecinas.values()) {
      if (estado === 'sana') sanas += 1;
      else if (estado === 'riesgo') riesgo += 1;
      else alertaVecinas += 1;
    }
    noTratada.push({ dia, sanas, riesgo, alerta: alertaVecinas + 1, nuevasAfectadas: nuevas });
  }

  const afectadasFinal = (noTratada.at(-1)?.alerta ?? 1) - 1;
  const etiqueta = etiquetaPlanta(hallazgo.cama, hallazgo.planta);

  return {
    hallazgoId: hallazgo.id,
    plantaId: hallazgo.plantaId,
    etiqueta,
    tipo: hallazgo.tipo,
    cama: hallazgo.cama,
    dias,
    tratada,
    noTratada,
    resumen: {
      tratada: `Tratada a tiempo: se resuelve en ${DIAS_RESOLUCION} días y no contagia plantas vecinas.`,
      noTratada:
        afectadasFinal > 0
          ? `Sin tratar: hasta ${afectadasFinal} planta${afectadasFinal === 1 ? '' : 's'} vecina${afectadasFinal === 1 ? '' : 's'} más podría${afectadasFinal === 1 ? '' : 'n'} llegar a alerta en ${dias} días.`
          : `Sin tratar: con la humedad actual el modelo no proyecta contagio a vecinas en ${dias} días, pero ${etiqueta} sigue afectada.`,
    },
    nota:
      'Proyección estimada con reglas simples (tipo de hongo + humedad), no un modelo epidemiológico validado. ' +
      'Sirve para mostrar el contraste entre tratar y no tratar, no como predicción clínica.',
  };
}
