/**
 * Mapa, camas, naves, zonas húmedas y resumen del bloque.
 *
 * Son los mismos cálculos puros que tenía `server/src/datos.ts` en el
 * prototipo en memoria, ahora alimentados por una consulta a la base de
 * datos en vez de por un `Map` del proceso.
 *
 * La forma del mapa (naves, camas por nave, cuadros por cama, nombre del
 * bloque) sale de la estructura GUARDADA en Configuración, no de la constante
 * de `@vigia/shared/config`: lo que el encargado guarda ahí se ve aquí. Las
 * plantas siguen siendo las que hay en la base, así que si la estructura
 * crece, los cuadros nuevos salen "sin dato" hasta que el robot pase por
 * ellos; si se encoge, las plantas que quedan fuera dejan de contarse.
 */
import {
  camasDeNaveEn,
  celdasPorCamaEn,
  naveDeCamaEn,
  plantasDeCeldaEn,
  totalCamasEn,
  totalPlantasEn,
} from '@vigia/shared/config';
import { ROBOT } from '@vigia/shared/config';
import type {
  Cama,
  Celda,
  ConfiguracionEstructura,
  EstadoCelda,
  MapaRespuesta,
  Nave,
  Planta,
  Resumen,
  ZonaHumeda,
} from '@vigia/shared/tipos';
import { listarPlantas, contarPlantas } from '../repositories/plantas.js';
import { plantaIdsConHallazgoPendiente } from '../repositories/hallazgos.js';
import { configuracionActual } from './configuracion.js';

/**
 * Qué estado manda cuando una celda agrupa plantas distintas. Lo confirmado en
 * campo pesa más que lo que nadie ha mirado, y una alerta sin revisar pesa más
 * que una que ya tiene a alguien encima.
 */
const PESO_ESTADO: Record<EstadoCelda, number> = {
  confirmada: 4,
  alerta: 3,
  en_revision: 2.5,
  riesgo: 2,
  sin_dato: 1,
  ok: 0,
};

/** La estructura que el encargado tiene guardada en Configuración. */
function estructuraActual(): ConfiguracionEstructura {
  return configuracionActual().estructura;
}

/**
 * Plantas que caen dentro de la estructura guardada. Si alguien reduce el
 * bloque, las plantas que quedan fuera no se dibujan ni se cuentan — pero
 * siguen en la base, así que volver a ampliarlo las recupera.
 */
function dentroDeLaEstructura(plantas: Planta[], estructura: ConfiguracionEstructura): Planta[] {
  const camas = totalCamasEn(estructura);
  return plantas.filter((p) => p.cama <= camas && p.planta <= estructura.plantasPorCama);
}

function indexarPorCama(plantas: Planta[]): Map<number, Map<number, Planta>> {
  const porCama = new Map<number, Map<number, Planta>>();
  for (const p of plantas) {
    let deLaCama = porCama.get(p.cama);
    if (!deLaCama) {
      deLaCama = new Map();
      porCama.set(p.cama, deLaCama);
    }
    deLaCama.set(p.planta, p);
  }
  return porCama;
}

function construirCelda(
  cama: number,
  indice: number,
  porPlanta: Map<number, Planta> | undefined,
  estructura: ConfiguracionEstructura,
): Celda {
  const numeros = plantasDeCeldaEn(indice, estructura);
  const agrupadas = numeros
    .map((n) => porPlanta?.get(n))
    .filter((p): p is Planta => Boolean(p));

  let estado: EstadoCelda = 'ok';
  let hallazgoId: string | undefined;
  let plantaId: string | undefined;

  for (const p of agrupadas) {
    if (PESO_ESTADO[p.estado] > PESO_ESTADO[estado]) estado = p.estado;
    if (p.estado === 'alerta' && !hallazgoId) {
      hallazgoId = p.hallazgoId;
      plantaId = p.id;
    }
  }

  if (!plantaId && agrupadas.length > 0) {
    plantaId = [...agrupadas].sort((a, b) => b.humedad - a.humedad)[0].id;
  }

  const humedad = agrupadas.length
    ? Math.round((agrupadas.reduce((s, p) => s + p.humedad, 0) / agrupadas.length) * 10) / 10
    : 0;
  const temperatura = agrupadas.length
    ? Math.round((agrupadas.reduce((s, p) => s + p.temperatura, 0) / agrupadas.length) * 10) / 10
    : 0;

  return {
    indice,
    cama,
    nave: naveDeCamaEn(cama, estructura),
    estado,
    humedad,
    temperatura,
    plantas: numeros,
    hallazgoId,
    plantaId,
  };
}

function construirCamasDesde(plantas: Planta[], estructura = estructuraActual()): Cama[] {
  const porCama = indexarPorCama(plantas);
  const celdas = celdasPorCamaEn(estructura);
  const camas: Cama[] = [];
  for (let numero = 1; numero <= totalCamasEn(estructura); numero++) {
    const porPlanta = porCama.get(numero);
    camas.push({
      numero,
      nave: naveDeCamaEn(numero, estructura),
      celdas: Array.from({ length: celdas }, (_, i) =>
        construirCelda(numero, i, porPlanta, estructura),
      ),
    });
  }
  return camas;
}

function construirNavesDesde(plantas: Planta[], estructura = estructuraActual()): Nave[] {
  return Array.from({ length: estructura.naves }, (_, i) => {
    const numero = i + 1;
    const camas = camasDeNaveEn(numero, estructura);
    const dePlantas = plantas.filter(
      (p) => naveDeCamaEn(p.cama, estructura) === numero && p.estado !== 'sin_dato',
    );
    const humedad = dePlantas.length
      ? Math.round((dePlantas.reduce((s, p) => s + p.humedad, 0) / dePlantas.length) * 10) / 10
      : 0;
    return { numero, camas, humedad };
  });
}

export function zonasHumedasDesde(plantas: Planta[]): ZonaHumeda[] {
  const umbral = configuracionActual().umbrales.humedadRiesgo;
  const estructura = estructuraActual();
  const porCama = new Map<number, Planta[]>();
  for (const p of plantas) {
    if (p.humedad < umbral) continue;
    const lista = porCama.get(p.cama) ?? [];
    lista.push(p);
    porCama.set(p.cama, lista);
  }

  return [...porCama.entries()]
    .map(([cama, lista]) => {
      const numeros = lista.map((p) => p.planta).sort((a, b) => a - b);
      return {
        cama,
        nave: naveDeCamaEn(cama, estructura),
        desde: numeros[0],
        hasta: numeros[numeros.length - 1],
        humedad: Math.round((lista.reduce((s, p) => s + p.humedad, 0) / lista.length) * 10) / 10,
      };
    })
    .sort((a, b) => b.humedad - a.humedad);
}

export function camasHumedasDesde(plantas: Planta[]): Array<{ cama: number; nave: number }> {
  return zonasHumedasDesde(plantas)
    .map((z) => ({ cama: z.cama, nave: z.nave }))
    .sort((a, b) => a.cama - b.cama);
}

function sugerenciaDesde(plantas: Planta[]): { texto: string; nota: string } {
  const peor = zonasHumedasDesde(plantas)[0];
  if (!peor) {
    return {
      texto: 'Ninguna nave pasa del umbral de humedad. Mantén la ventilación como está.',
      nota: 'La decisión final es del agrónomo.',
    };
  }
  return {
    texto:
      `Ventila la nave ${peor.nave} antes de las 6:00 p. m.: la humedad ronda ` +
      `${peor.humedad.toFixed(0)} % y el rocío está a 1,3 °C de la temperatura.`,
    nota: 'La decisión final es del agrónomo.',
  };
}

export async function construirResumen(plantasPrecargadas?: Planta[]): Promise<Resumen> {
  const estructura = estructuraActual();
  const plantas = dentroDeLaEstructura(plantasPrecargadas ?? (await listarPlantas()), estructura);
  const totalPlantas = totalPlantasEn(estructura);
  let sanas = 0;
  let riesgo = 0;
  let alerta = 0;
  for (const p of plantas) {
    if (p.estado === 'ok') sanas += 1;
    else if (p.estado === 'riesgo') riesgo += 1;
    else if (p.estado === 'alerta') alerta += 1;
  }

  const enAlertaIds = new Set(plantas.filter((p) => p.estado === 'alerta').map((p) => p.id));
  const pendientes = await plantaIdsConHallazgoPendiente();
  let porRevisar = 0;
  for (const id of pendientes) if (enAlertaIds.has(id)) porRevisar += 1;

  return {
    bloque: estructura.bloque,
    totalPlantas,
    sanas,
    riesgo,
    alerta,
    porRevisar,
    porcentajeSanas: totalPlantas === 0 ? 0 : Math.round((sanas / totalPlantas) * 1000) / 10,
    robot: { ...ROBOT, ultimaRonda: new Date(Date.now() - 41 * 60_000).toISOString() },
    actualizado: new Date().toISOString(),
  };
}

export async function construirCamas(): Promise<Cama[]> {
  const estructura = estructuraActual();
  return construirCamasDesde(dentroDeLaEstructura(await listarPlantas(), estructura), estructura);
}

export async function obtenerCama(numero: number): Promise<Cama | undefined> {
  return (await construirCamas()).find((c) => c.numero === numero);
}

export async function construirMapa(): Promise<MapaRespuesta> {
  const estructura = estructuraActual();
  const plantas = dentroDeLaEstructura(await listarPlantas(), estructura);
  return {
    bloque: estructura.bloque,
    nombre: estructura.nombre,
    camas: construirCamasDesde(plantas, estructura),
    naves: construirNavesDesde(plantas, estructura),
    resumen: await construirResumen(plantas),
    zonasHumedas: zonasHumedasDesde(plantas).slice(0, 2),
    sugerencia: sugerenciaDesde(plantas),
  };
}

/** Humedad promedio de una nave, usada por la pantalla de equipos. */
export async function humedadDeNave(nave: number): Promise<number> {
  const naves = construirNavesDesde(dentroDeLaEstructura(await listarPlantas(), estructuraActual()));
  return naves.find((n) => n.numero === nave)?.humedad ?? 0;
}

export async function camasHumedas(): Promise<Array<{ cama: number; nave: number }>> {
  return camasHumedasDesde(await listarPlantas());
}

export async function saludDb(): Promise<{ plantas: number }> {
  return { plantas: await contarPlantas() };
}
