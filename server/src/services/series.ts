/**
 * Series para la pantalla de análisis: cómo se ha movido el clima del bloque y
 * cuántos hallazgos han salido.
 *
 * De dónde sale cada cosa, que no es lo mismo:
 *
 * - **Hallazgos por día**: datos reales de la base. Cada hallazgo guarda su
 *   `detectadoEn`, así que el conteo por día y por tipo es el de verdad.
 * - **Clima por nave**: real también, calculado de la última lectura que tiene
 *   cada planta.
 * - **Serie de clima en el tiempo**: *reconstruida*. El prototipo no guarda un
 *   histórico de lecturas (cada planta solo conserva la última), así que la
 *   curva se arma a partir del promedio actual y del ciclo diario conocido del
 *   invernadero: fresco y húmedo de madrugada, cálido y seco a media tarde.
 *   Es una reconstrucción, no una medición, y la pantalla lo dice.
 */
import { ESTRUCTURA, naveDeCama } from '@vigia/shared/config';
import type {
  ClimaDeNave,
  HallazgosDelDia,
  PuntoClima,
  RangoSerie,
  SeriesRespuesta,
} from '@vigia/shared/tipos';
import { listarHallazgos } from '../repositories/hallazgos.js';
import { listarPlantas } from '../repositories/plantas.js';
import { configuracionActual } from './configuracion.js';

const RANGOS: Record<RangoSerie, { puntos: number; pasoHoras: number }> = {
  '24h': { puntos: 24, pasoHoras: 1 },
  '7d': { puntos: 28, pasoHoras: 6 },
  '30d': { puntos: 30, pasoHoras: 24 },
};

export function esRango(valor: unknown): valor is RangoSerie {
  return valor === '24h' || valor === '7d' || valor === '30d';
}

function redondear(n: number, decimales = 1): number {
  const f = 10 ** decimales;
  return Math.round(n * f) / f;
}

/** Ruido estable: el mismo momento siempre da el mismo valor. */
function ruido(semilla: number): number {
  const x = Math.sin(semilla * 12.9898) * 43758.5453;
  return x - Math.floor(x) - 0.5;
}

/**
 * Ciclo diario del invernadero, en desviación sobre el promedio del día.
 * La humedad sube de madrugada y cae a media tarde; la temperatura, al revés.
 */
function cicloDiario(hora: number): { humedad: number; temperatura: number } {
  const fase = ((hora - 5 + 24) % 24) / 24; // 0 a las 5 a. m.
  const onda = Math.cos(fase * Math.PI * 2);
  return { humedad: onda * 6.5, temperatura: -onda * 3.2 };
}

function etiquetaDe(momento: Date, rango: RangoSerie): string {
  if (rango === '24h') {
    return `${String(momento.getHours()).padStart(2, '0')}:00`;
  }
  const dia = momento.toLocaleDateString('es-CO', { weekday: 'short' }).replace('.', '');
  if (rango === '7d') {
    return `${dia} ${String(momento.getHours()).padStart(2, '0')}h`;
  }
  return `${dia} ${momento.getDate()}`;
}

export async function construirSeries(rango: RangoSerie): Promise<SeriesRespuesta> {
  const { puntos, pasoHoras } = RANGOS[rango];
  const plantas = await listarPlantas();
  const conDato = plantas.filter((p) => p.estado !== 'sin_dato');

  const humedadActual = conDato.length
    ? conDato.reduce((a, p) => a + p.humedad, 0) / conDato.length
    : 0;
  const temperaturaActual = conDato.length
    ? conDato.reduce((a, p) => a + p.temperatura, 0) / conDato.length
    : 0;

  // ── Clima en el tiempo (reconstruido) ────────────────────────────────────
  const ahora = new Date();
  const clima: PuntoClima[] = [];
  for (let i = puntos - 1; i >= 0; i--) {
    const momento = new Date(ahora.getTime() - i * pasoHoras * 3_600_000);
    const ciclo = cicloDiario(momento.getHours());
    const semilla = Math.floor(momento.getTime() / 3_600_000);

    clima.push({
      momento: momento.toISOString(),
      etiqueta: etiquetaDe(momento, rango),
      humedad: redondear(humedadActual + ciclo.humedad + ruido(semilla) * 2.4),
      temperatura: redondear(temperaturaActual + ciclo.temperatura + ruido(semilla + 99) * 1.1),
    });
  }

  // ── Clima por nave (real) ────────────────────────────────────────────────
  const umbral = configuracionActual().umbrales.humedadRiesgo;
  const porNave: ClimaDeNave[] = [];
  for (let nave = 1; nave <= ESTRUCTURA.naves; nave++) {
    const suyas = conDato.filter((p) => naveDeCama(p.cama) === nave);
    if (suyas.length === 0) continue;

    const camas = [...new Set(suyas.map((p) => p.cama))];
    const camasEnRiesgo = camas.filter((cama) => {
      const deLaCama = suyas.filter((p) => p.cama === cama);
      const media = deLaCama.reduce((a, p) => a + p.humedad, 0) / deLaCama.length;
      return media >= umbral;
    }).length;

    porNave.push({
      nave,
      humedad: redondear(suyas.reduce((a, p) => a + p.humedad, 0) / suyas.length),
      temperatura: redondear(suyas.reduce((a, p) => a + p.temperatura, 0) / suyas.length),
      camasEnRiesgo,
    });
  }

  // ── Hallazgos por día (real) ─────────────────────────────────────────────
  const dias = rango === '24h' ? 1 : rango === '7d' ? 7 : 30;
  const todos = await listarHallazgos();
  const porDia = new Map<string, HallazgosDelDia>();

  for (let i = dias - 1; i >= 0; i--) {
    const dia = new Date(ahora);
    dia.setHours(0, 0, 0, 0);
    dia.setDate(dia.getDate() - i);
    porDia.set(dia.toISOString(), {
      dia: dia.toISOString(),
      etiqueta: `${dia.toLocaleDateString('es-CO', { weekday: 'short' }).replace('.', '')} ${dia.getDate()}`,
      total: 0,
      Botrytis: 0,
      Alternaria: 0,
      Oidio: 0,
    });
  }

  for (const hallazgo of todos) {
    const dia = new Date(hallazgo.detectadoEn);
    dia.setHours(0, 0, 0, 0);
    const fila = porDia.get(dia.toISOString());
    if (!fila) continue;
    fila.total += 1;
    if (hallazgo.tipo === 'Botrytis') fila.Botrytis += 1;
    else if (hallazgo.tipo === 'Alternaria') fila.Alternaria += 1;
    else fila.Oidio += 1;
  }

  const hallazgos = [...porDia.values()];
  const humedades = clima.map((p) => p.humedad);
  const temperaturas = clima.map((p) => p.temperatura);

  return {
    rango,
    clima,
    porNave,
    hallazgos,
    resumen: {
      humedadMedia: redondear(humedades.reduce((a, v) => a + v, 0) / humedades.length),
      humedadMaxima: redondear(Math.max(...humedades)),
      temperaturaMedia: redondear(temperaturas.reduce((a, v) => a + v, 0) / temperaturas.length),
      temperaturaMaxima: redondear(Math.max(...temperaturas)),
      horasSobreUmbral: humedades.filter((v) => v >= umbral).length * pasoHoras,
      umbralHumedad: umbral,
      totalHallazgos: hallazgos.reduce((a, d) => a + d.total, 0),
    },
  };
}
