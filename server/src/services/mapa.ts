/**
 * Mapa, camas, naves, zonas húmedas y resumen del bloque.
 *
 * Son los mismos cálculos puros que tenía `server/src/datos.ts` en el
 * prototipo en memoria, ahora alimentados por una consulta a la base de
 * datos en vez de por un `Map` del proceso.
 *
 * La estructura del cultivo (naves, camas por nave, celdas por cama) sigue
 * saliendo de `ESTRUCTURA`, la constante estática de `@vigia/shared/config`
 * — igual que en el prototipo original, `PUT /api/configuracion` con un
 * cambio de estructura no recalcula el mapa, solo queda guardado para que lo
 * lea quien consulte `/api/configuracion`. Ampliarlo (generar el cultivo a
 * partir de la estructura configurada) es trabajo aparte.
 */
import {
  CELDAS_POR_CAMA,
  ESTRUCTURA,
  TOTAL_CAMAS,
  TOTAL_PLANTAS,
  camasDeNave,
  naveDeCama,
  plantasDeCelda,
} from '@vigia/shared/config';
import { ROBOT } from '@vigia/shared/config';
import type {
  Cama,
  Celda,
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

function construirCelda(cama: number, indice: number, porPlanta: Map<number, Planta> | undefined): Celda {
  const numeros = plantasDeCelda(indice);
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

  return { indice, cama, nave: naveDeCama(cama), estado, humedad, temperatura, plantas: numeros, hallazgoId, plantaId };
}

function construirCamasDesde(plantas: Planta[]): Cama[] {
  const porCama = indexarPorCama(plantas);
  const camas: Cama[] = [];
  for (let numero = 1; numero <= TOTAL_CAMAS; numero++) {
    const porPlanta = porCama.get(numero);
    camas.push({
      numero,
      nave: naveDeCama(numero),
      celdas: Array.from({ length: CELDAS_POR_CAMA }, (_, i) => construirCelda(numero, i, porPlanta)),
    });
  }
  return camas;
}

function construirNavesDesde(plantas: Planta[]): Nave[] {
  return Array.from({ length: ESTRUCTURA.naves }, (_, i) => {
    const numero = i + 1;
    const camas = camasDeNave(numero);
    const dePlantas = plantas.filter((p) => p.nave === numero && p.estado !== 'sin_dato');
    const humedad = dePlantas.length
      ? Math.round((dePlantas.reduce((s, p) => s + p.humedad, 0) / dePlantas.length) * 10) / 10
      : 0;
    return { numero, camas, humedad };
  });
}

export function zonasHumedasDesde(plantas: Planta[]): ZonaHumeda[] {
  const umbral = configuracionActual().umbrales.humedadRiesgo;
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
        nave: naveDeCama(cama),
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
  const plantas = plantasPrecargadas ?? (await listarPlantas());
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
    bloque: ESTRUCTURA.bloque,
    totalPlantas: TOTAL_PLANTAS,
    sanas,
    riesgo,
    alerta,
    porRevisar,
    porcentajeSanas: Math.round((sanas / TOTAL_PLANTAS) * 1000) / 10,
    robot: { ...ROBOT, ultimaRonda: new Date(Date.now() - 41 * 60_000).toISOString() },
    actualizado: new Date().toISOString(),
  };
}

export async function construirCamas(): Promise<Cama[]> {
  return construirCamasDesde(await listarPlantas());
}

export async function obtenerCama(numero: number): Promise<Cama | undefined> {
  return (await construirCamas()).find((c) => c.numero === numero);
}

export async function construirMapa(): Promise<MapaRespuesta> {
  const plantas = await listarPlantas();
  return {
    bloque: ESTRUCTURA.bloque,
    camas: construirCamasDesde(plantas),
    naves: construirNavesDesde(plantas),
    resumen: await construirResumen(plantas),
    zonasHumedas: zonasHumedasDesde(plantas).slice(0, 2),
    sugerencia: sugerenciaDesde(plantas),
  };
}

/** Humedad promedio de una nave, usada por la pantalla de equipos. */
export async function humedadDeNave(nave: number): Promise<number> {
  const naves = construirNavesDesde(await listarPlantas());
  return naves.find((n) => n.numero === nave)?.humedad ?? 0;
}

export async function camasHumedas(): Promise<Array<{ cama: number; nave: number }>> {
  return camasHumedasDesde(await listarPlantas());
}

export async function saludDb(): Promise<{ plantas: number }> {
  return { plantas: await contarPlantas() };
}
