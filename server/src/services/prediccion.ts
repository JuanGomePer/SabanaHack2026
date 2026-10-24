/**
 * Modelo predictivo de humedad y temperatura (GET /api/prediccion).
 *
 * Qué hace, sin adornos:
 *
 * 1. Arma un histórico diario de humedad y temperatura del bloque.
 * 2. Le ajusta una **regresión lineal por mínimos cuadrados** (humedad contra
 *    día) y se queda con la pendiente, el R² y el error típico del ajuste.
 * 3. Proyecta los próximos días mezclando esa tendencia propia con la normal
 *    climática del mes en la Sabana de Bogotá (`CLIMA_SABANA`), con el peso de
 *    `PESO_CLIMA_SABANA`.
 * 4. Marca como "día de cuidado" los días en los que la probabilidad de pasar
 *    el umbral de humedad llega a la mitad, y señala las camas que el robot
 *    debería mirar con más detalle ese día.
 *
 * Dos advertencias que la pantalla repite tal cual:
 *
 * - El histórico es **reconstruido**. El prototipo guarda solo la última
 *   lectura de cada planta, así que la serie diaria se arma a partir del
 *   promedio actual y del ciclo conocido del invernadero (igual que la curva
 *   de la pantalla de Análisis). Con lecturas guardadas ronda a ronda, el
 *   mismo ajuste corre sobre datos medidos y no hay que cambiar nada más.
 * - El clima de la Sabana son normales de referencia, no la serie de una
 *   estación real.
 */
import {
  CLIMA_SABANA,
  DIAS_HISTORICO_PREDICCION,
  DIAS_PREDICCION,
  PESO_CLIMA_SABANA,
  climaSabanaDeMes,
  naveDeCama,
} from '@vigia/shared/config';
import type {
  CamaPrioritaria,
  DiaHistorico,
  DiaPredicho,
  ModeloPrediccion,
  PrediccionRespuesta,
} from '@vigia/shared/tipos';
import { listarHallazgosDesde } from '../repositories/hallazgos.js';
import { listarPlantas } from '../repositories/plantas.js';
import { configuracionActual } from './configuracion.js';

/** Camas que se le proponen al robot para la ronda del día de cuidado. */
const MAXIMO_CAMAS_PRIORITARIAS = 5;

function redondear(n: number, decimales = 1): number {
  const f = 10 ** decimales;
  return Math.round(n * f) / f;
}

/** Ruido estable: el mismo día siempre da el mismo valor. */
function ruido(semilla: number): number {
  const x = Math.sin(semilla * 12.9898) * 43758.5453;
  return x - Math.floor(x) - 0.5;
}

function etiquetaDia(momento: Date): string {
  const dia = momento.toLocaleDateString('es-CO', { weekday: 'short' }).replace('.', '');
  return `${dia} ${momento.getDate()}`;
}

/**
 * Aproximación de la función de distribución normal acumulada (Zelen &
 * Severo, 7.1.26 de Abramowitz-Stegun). Se usa para pasar de "a cuántos
 * puntos del umbral queda la predicción" a una probabilidad.
 */
function normalAcumulada(z: number): number {
  const signo = z < 0 ? -1 : 1;
  const x = Math.abs(z) / Math.SQRT2;
  const t = 1 / (1 + 0.3275911 * x);
  const erf =
    1 -
    ((((1.061405429 * t - 1.453152027) * t + 1.421413741) * t - 0.284496736) * t + 0.254829592) *
      t *
      Math.exp(-x * x);
  return 0.5 * (1 + signo * erf);
}

interface Recta {
  pendiente: number;
  intercepto: number;
  r2: number;
  error: number;
}

/** Mínimos cuadrados de y contra su índice: y = intercepto + pendiente · i. */
function regresionLineal(valores: number[]): Recta {
  const n = valores.length;
  if (n < 2) return { pendiente: 0, intercepto: valores[0] ?? 0, r2: 0, error: 0 };

  const mediaX = (n - 1) / 2;
  const mediaY = valores.reduce((a, v) => a + v, 0) / n;

  let sxy = 0;
  let sxx = 0;
  for (let i = 0; i < n; i++) {
    sxy += (i - mediaX) * (valores[i] - mediaY);
    sxx += (i - mediaX) ** 2;
  }

  const pendiente = sxx === 0 ? 0 : sxy / sxx;
  const intercepto = mediaY - pendiente * mediaX;

  let residual = 0;
  let total = 0;
  for (let i = 0; i < n; i++) {
    residual += (valores[i] - (intercepto + pendiente * i)) ** 2;
    total += (valores[i] - mediaY) ** 2;
  }

  return {
    pendiente,
    intercepto,
    r2: total === 0 ? 0 : Math.max(0, 1 - residual / total),
    // Error típico del ajuste: raíz del residual medio, con n-2 grados.
    error: Math.sqrt(residual / Math.max(1, n - 2)),
  };
}

/**
 * Histórico diario reconstruido: promedio actual del bloque + la curva anual
 * de la Sabana + un ruido estable por día. No son lecturas guardadas.
 */
function historicoReconstruido(
  humedadActual: number,
  temperaturaActual: number,
  dias: number,
): DiaHistorico[] {
  const hoy = new Date();
  hoy.setHours(0, 0, 0, 0);
  const normalDeHoy = climaSabanaDeMes(hoy.getMonth() + 1);

  const historico: DiaHistorico[] = [];
  for (let i = dias - 1; i >= 0; i--) {
    const dia = new Date(hoy);
    dia.setDate(dia.getDate() - i);
    const normal = climaSabanaDeMes(dia.getMonth() + 1);
    const semilla = Math.floor(dia.getTime() / 86_400_000);

    // La desviación del mes respecto al mes actual mueve la serie hacia atrás
    // según la época del año; el ruido le da la variación del día a día.
    historico.push({
      dia: dia.toISOString(),
      etiqueta: etiquetaDia(dia),
      humedad: redondear(
        humedadActual + (normal.humedad - normalDeHoy.humedad) + ruido(semilla) * 3.2,
      ),
      temperatura: redondear(
        temperaturaActual +
          (normal.temperatura - normalDeHoy.temperatura) +
          ruido(semilla + 77) * 1.4,
      ),
    });
  }
  return historico;
}

/**
 * La zona húmeda de hoy: los tramos que ya están por encima del umbral.
 *
 * Es lo que hay que proyectar para decidir si un día es de cuidado. El
 * promedio del bloque casi nunca pasa el umbral —2.400 plantas y la humedad
 * se concentra en un par de camas—, pero el hongo arranca justo ahí. Si hoy no
 * hay ninguna planta sobre el umbral, se toma el 5 % más húmedo para tener
 * algo que vigilar.
 */
function zonaCalienteDe(
  plantas: Array<{ cama: number; humedad: number }>,
  umbral: number,
): { camas: number[]; humedad: number; plantas: number } {
  let calientes = plantas.filter((p) => p.humedad >= umbral);

  if (calientes.length === 0) {
    const ordenadas = [...plantas].sort((a, b) => b.humedad - a.humedad);
    calientes = ordenadas.slice(0, Math.max(1, Math.round(ordenadas.length * 0.05)));
  }

  return {
    camas: [...new Set(calientes.map((p) => p.cama))].sort((a, b) => a - b),
    humedad: redondear(calientes.reduce((a, p) => a + p.humedad, 0) / calientes.length),
    plantas: calientes.length,
  };
}

export async function construirPrediccion(
  diasAdelante = DIAS_PREDICCION,
): Promise<PrediccionRespuesta> {
  const umbral = configuracionActual().umbrales.humedadRiesgo;
  const plantas = await listarPlantas();
  const conDato = plantas.filter((p) => p.estado !== 'sin_dato');

  const humedadActual = conDato.length
    ? conDato.reduce((a, p) => a + p.humedad, 0) / conDato.length
    : 0;
  const temperaturaActual = conDato.length
    ? conDato.reduce((a, p) => a + p.temperatura, 0) / conDato.length
    : 0;

  const zonaCaliente = zonaCalienteDe(conDato, umbral);

  const historico = historicoReconstruido(
    humedadActual,
    temperaturaActual,
    DIAS_HISTORICO_PREDICCION,
  );

  const rectaHumedad = regresionLineal(historico.map((d) => d.humedad));
  const rectaTemperatura = regresionLineal(historico.map((d) => d.temperatura));

  const hoy = new Date();
  hoy.setHours(0, 0, 0, 0);
  const normalDeHoy = climaSabanaDeMes(hoy.getMonth() + 1);
  const mediaHistorica =
    historico.reduce((a, d) => a + d.humedad, 0) / Math.max(1, historico.length);
  /** Cuánto más húmedo (o seco) va el invernadero que la región, en puntos. */
  const desviacionRegional = mediaHistorica - normalDeHoy.humedad;

  const prediccion: DiaPredicho[] = [];
  for (let k = 1; k <= diasAdelante; k++) {
    const dia = new Date(hoy);
    dia.setDate(dia.getDate() + k);
    const indice = historico.length - 1 + k;
    const normal = climaSabanaDeMes(dia.getMonth() + 1);

    // Tendencia propia del invernadero…
    const tendencia = rectaHumedad.intercepto + rectaHumedad.pendiente * indice;
    // …y lo que dice el clima de la Sabana para ese mes, corregido por lo que
    // suele desviarse este invernadero de la región.
    const regional = normal.humedad + desviacionRegional;
    const humedad = (1 - PESO_CLIMA_SABANA) * tendencia + PESO_CLIMA_SABANA * regional;

    const tendenciaT = rectaTemperatura.intercepto + rectaTemperatura.pendiente * indice;
    const regionalT = normal.temperatura + (temperaturaActual - normalDeHoy.temperatura);
    const temperatura = (1 - PESO_CLIMA_SABANA) * tendenciaT + PESO_CLIMA_SABANA * regionalT;

    /**
     * La incertidumbre crece con la distancia: el error del ajuste más un 6 %
     * por día proyectado. Sin esto, el día 14 se vería igual de seguro que el
     * día 1, y no lo es.
     */
    const margen = rectaHumedad.error * (1 + k * 0.06) * 1.96;
    const sigma = Math.max(0.5, rectaHumedad.error * (1 + k * 0.06));

    /**
     * La zona húmeda se mueve con el bloque: se le aplica el mismo cambio que
     * el modelo le da al promedio. Si el bloque sube 2 puntos, la zona que hoy
     * va en 89 % se va a 91 %.
     */
    const humedadZona = zonaCaliente.humedad + (humedad - humedadActual);
    const probabilidad = normalAcumulada((humedadZona - umbral) / sigma);

    prediccion.push({
      dia: dia.toISOString(),
      etiqueta: etiquetaDia(dia),
      humedad: redondear(humedad),
      humedadZona: redondear(humedadZona),
      temperatura: redondear(temperatura),
      margen: redondear(margen),
      probabilidad: redondear(probabilidad, 2),
      cuidado: probabilidad >= 0.5,
    });
  }

  const diaCritico = prediccion.find((d) => d.cuidado);

  // ── Camas a revisar con más detalle ese día (datos reales de hoy) ─────────
  const desde = new Date(Date.now() - 30 * 24 * 60 * 60_000);
  const hallazgos = await listarHallazgosDesde(desde);
  const hallazgosPorCama = new Map<number, number>();
  for (const h of hallazgos) hallazgosPorCama.set(h.cama, (hallazgosPorCama.get(h.cama) ?? 0) + 1);

  const porCama = new Map<number, { humedad: number; sobreUmbral: number }>();
  for (const planta of conDato) {
    const actual = porCama.get(planta.cama) ?? { humedad: 0, sobreUmbral: 0 };
    porCama.set(planta.cama, {
      humedad: Math.max(actual.humedad, planta.humedad),
      sobreUmbral: actual.sobreUmbral + (planta.humedad >= umbral ? 1 : 0),
    });
  }

  const camasPrioritarias: CamaPrioritaria[] = [...porCama.entries()]
    .map(([cama, datos]) => ({
      cama,
      nave: naveDeCama(cama),
      humedad: redondear(datos.humedad),
      plantasSobreUmbral: datos.sobreUmbral,
      hallazgos: hallazgosPorCama.get(cama) ?? 0,
    }))
    // Primero las que ya tienen plantas sobre el umbral, luego por hallazgos y
    // por el tramo más húmedo: son las que peor van a reaccionar a un día más
    // húmedo todavía.
    .sort(
      (a, b) =>
        b.plantasSobreUmbral - a.plantasSobreUmbral ||
        b.hallazgos - a.hallazgos ||
        b.humedad - a.humedad,
    )
    .slice(0, MAXIMO_CAMAS_PRIORITARIAS);

  const mesReferencia = climaSabanaDeMes(
    (diaCritico ? new Date(diaCritico.dia) : hoy).getMonth() + 1,
  );

  const modelo: ModeloPrediccion = {
    pendiente: redondear(rectaHumedad.pendiente, 3),
    intercepto: redondear(rectaHumedad.intercepto),
    r2: redondear(rectaHumedad.r2, 2),
    error: redondear(rectaHumedad.error),
    dias: historico.length,
    pesoClima: PESO_CLIMA_SABANA,
    desviacionRegional: redondear(desviacionRegional),
    zonaCaliente,
  };

  return {
    umbral,
    historico,
    prediccion,
    modelo,
    diaCritico,
    camasPrioritarias,
    climaReferencia: {
      mes: mesReferencia.nombre,
      humedad: mesReferencia.humedad,
      temperatura: mesReferencia.temperatura,
      temporada: mesReferencia.temporada,
    },
  };
}

/** Meses de referencia, por si la pantalla quiere mostrar la curva anual. */
export function climaDeReferencia() {
  return CLIMA_SABANA;
}
