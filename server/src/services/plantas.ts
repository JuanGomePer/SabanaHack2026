/** Detalle de una planta: su hallazgo activo, serie de humedad y vecinas. */
import { etiquetaPlanta } from '@vigia/shared/config';
import type { DetallePlanta } from '@vigia/shared/tipos';
import { obtenerPlanta, listarVecinas } from '../repositories/plantas.js';
import { obtenerHallazgo } from '../repositories/hallazgos.js';

/** Mismo generador pseudoaleatorio estable que datos.ts: mismo seed → misma serie. */
function prng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Serie de humedad de las últimas 12 horas para el gráfico del detalle. */
function serieHumedad(plantaId: string, humedadBase: number): Array<{ hora: string; valor: number }> {
  const serie: Array<{ hora: string; valor: number }> = [];
  const ahora = new Date();
  const ruido = prng(plantaId.length * 977 + humedadBase * 13);
  for (let i = 11; i >= 0; i--) {
    const momento = new Date(ahora.getTime() - i * 60 * 60_000);
    const hora = momento.getHours();
    // La humedad sube de noche y baja a media tarde.
    const ciclo = Math.cos(((hora - 4) / 24) * 2 * Math.PI) * 6;
    serie.push({
      hora: `${String(hora).padStart(2, '0')}:00`,
      valor: Math.round((humedadBase - 4 + ciclo + ruido() * 3) * 10) / 10,
    });
  }
  return serie;
}

export async function detallePlanta(id: string): Promise<DetallePlanta | null> {
  const planta = await obtenerPlanta(id);
  if (!planta) return null;

  const hallazgo = planta.hallazgoId ? await obtenerHallazgo(planta.hallazgoId) : null;
  const vecinas = await listarVecinas(planta.cama, planta.planta);

  return {
    planta,
    etiqueta: etiquetaPlanta(planta.cama, planta.planta),
    hallazgo,
    serieHumedad: serieHumedad(planta.id, planta.humedad),
    vecinas: vecinas.map((v) => ({ ...v, etiqueta: etiquetaPlanta(v.cama, v.planta) })),
  };
}
