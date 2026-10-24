/**
 * Estado del cultivo en memoria.
 *
 * Todo se construye a partir de los supuestos de @vigia/shared/config:
 * cambiar la configuración cambia estos datos, no hay cifras sueltas aquí.
 */

import {
  ALERTA_DEMO,
  CELDAS_POR_CAMA,
  ESTRUCTURA,
  HISTORICO,
  PLANTAS_EN_ALERTA,
  REVISORES,
  RECOMENDACIONES,
  ROBOT,
  SMS,
  TIPOS_SEMILLA,
  TOTAL_CAMAS,
  TOTAL_PLANTAS,
  UMBRALES,
  ZONAS_EN_RIESGO,
  ZONAS_SIN_DATO,
  camasDeNave,
  etiquetaPlanta,
  idPlanta,
  naveDeCama,
  plantasDeCelda,
} from '@vigia/shared/config';
import type {
  Alerta,
  Cama,
  Celda,
  Configuracion,
  EntradaRegistro,
  EstadoCelda,
  FilaRegistro,
  Hallazgo,
  MapaRespuesta,
  Nave,
  Planta,
  PrioridadAlerta,
  ResumenRegistro,
  Resumen,
  RevisionHallazgo,
  TipoHallazgo,
  ZonaHumeda,
} from '@vigia/shared/tipos';

// ── Generador pseudoaleatorio estable ───────────────────────────────────────
/** Mismo seed → mismos datos en cada arranque, para que la demo sea igual. */
function prng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const aleatorio = prng(20261024);

// ── Estado en memoria ───────────────────────────────────────────────────────
export const plantas = new Map<string, Planta>();
export const hallazgos = new Map<string, Hallazgo>();
export const registro: EntradaRegistro[] = [];

export const configuracion: Configuracion = {
  estructura: { ...ESTRUCTURA },
  umbrales: { ...UMBRALES },
  sms: { ...SMS, destinos: SMS.destinos.map((destino) => ({ ...destino })) },
};

let contadorHallazgos = 0;

function nuevoIdHallazgo(): string {
  contadorHallazgos += 1;
  return `H-${String(contadorHallazgos).padStart(4, '0')}`;
}

// ── Construcción del cultivo ────────────────────────────────────────────────
function humedadBase(cama: number, planta: number): number {
  // Las naves del centro del bloque quedan algo más húmedas.
  const nave = naveDeCama(cama);
  const sesgoNave = nave === 5 ? 6 : nave === 4 || nave === 6 ? 3 : 0;
  return 66 + sesgoNave + aleatorio() * 12;
}

function construirCultivo(): void {
  for (let cama = 1; cama <= TOTAL_CAMAS; cama++) {
    const nave = naveDeCama(cama);
    for (let planta = 1; planta <= ESTRUCTURA.plantasPorCama; planta++) {
      const zona = ZONAS_EN_RIESGO.find(
        (z) => z.cama === cama && planta >= z.desde && planta <= z.hasta,
      );
      const sinDato = ZONAS_SIN_DATO.some(
        (z) => z.cama === cama && planta >= z.desde && planta <= z.hasta,
      );

      const humedad = zona
        ? // Se mantiene por encima del umbral: la zona está en riesgo por definición.
          Math.round((zona.humedad + aleatorio() * 3) * 10) / 10
        : Math.round(humedadBase(cama, planta) * 10) / 10;

      const estado: EstadoCelda = sinDato
        ? 'sin_dato'
        : humedad >= configuracion.umbrales.humedadRiesgo
          ? 'riesgo'
          : 'ok';

      const id = idPlanta(cama, planta);
      plantas.set(id, {
        id,
        cama,
        planta,
        nave,
        estado,
        humedad,
        temperatura: Math.round((17.5 + aleatorio() * 4) * 10) / 10,
        ultimaLectura: new Date(Date.now() - Math.round(aleatorio() * 900_000)).toISOString(),
      });
    }
  }
}

/** Minutos que lleva cada hallazgo semilla, para que coincida con el diseño. */
const MINUTOS_SEMILLA = [38, 31, 44, 22, 57, 73, 96];

function sembrarHallazgos(): void {
  PLANTAS_EN_ALERTA.forEach(([cama, planta], i) => {
    const tipo = TIPOS_SEMILLA[i] ?? 'Botrytis';
    const minutos = MINUTOS_SEMILLA[i] ?? 30 + i * 11;
    // El último ya lo revisó el encargado: sigue en alerta, pero no por revisar.
    const ultimo = i === PLANTAS_EN_ALERTA.length - 1;
    crearHallazgo(cama, planta, tipo, {
      detectadoEn: new Date(Date.now() - minutos * 60_000).toISOString(),
      confianza: Math.round((0.72 + aleatorio() * 0.24) * 100) / 100,
      revision: ultimo ? 'confirmada' : 'pendiente',
      reviso: ultimo ? REVISORES[1] : undefined,
    });
  });

  // Una falsa alarma reciente, para que la pantalla de alertas tenga los tres estados.
  crearHallazgo(9, 80, 'Oídio', {
    detectadoEn: new Date(Date.now() - 5 * 60 * 60_000).toISOString(),
    confianza: 0.62,
    revision: 'falsa_alarma',
    reviso: REVISORES[0],
  });
}

/**
 * Hallazgos de los días anteriores, ya resueltos. Solo salen en el registro
 * de incidencias: no dejan plantas en alerta ni aparecen en la lista de
 * alertas (que muestra las últimas 24 horas).
 */
function sembrarHistorico(): void {
  const decisiones: RevisionHallazgo[] = [
    ...Array<RevisionHallazgo>(HISTORICO.confirmados).fill('confirmada'),
    ...Array<RevisionHallazgo>(HISTORICO.falsasAlarmas).fill('falsa_alarma'),
    ...Array<RevisionHallazgo>(HISTORICO.porRevisar).fill('pendiente'),
  ];
  const tipos: TipoHallazgo[] = ['Botrytis', 'Alternaria', 'Oídio'];

  decisiones.forEach((decision, i) => {
    const cama = 1 + Math.floor(aleatorio() * TOTAL_CAMAS);
    const planta = 1 + Math.floor(aleatorio() * ESTRUCTURA.plantasPorCama);
    // Repartidos entre ayer y hace una semana.
    const horas = 26 + Math.floor(aleatorio() * (HISTORICO.dias - 1) * 24);

    crearHallazgo(cama, planta, tipos[i % tipos.length], {
      detectadoEn: new Date(Date.now() - horas * 60 * 60_000).toISOString(),
      confianza: Math.round((0.6 + aleatorio() * 0.35) * 100) / 100,
      revision: decision,
      reviso: decision === 'pendiente' ? undefined : REVISORES[i % REVISORES.length],
      afectaPlanta: false,
    });
  });
}

/** Crea un hallazgo y, si está pendiente o confirmado, pone la planta en alerta. */
export function crearHallazgo(
  cama: number,
  planta: number,
  tipo: TipoHallazgo,
  opciones: {
    detectadoEn?: string;
    confianza?: number;
    revision?: RevisionHallazgo;
    reviso?: string;
    /** Los hallazgos de días pasados ya están resueltos: no dejan la planta en alerta. */
    afectaPlanta?: boolean;
  } = {},
): Hallazgo {
  const id = nuevoIdHallazgo();
  const plantaId = idPlanta(cama, planta);
  const registroPlanta = plantas.get(plantaId);

  const hallazgo: Hallazgo = {
    id,
    plantaId,
    cama,
    planta,
    nave: naveDeCama(cama),
    tipo,
    confianza: opciones.confianza ?? Math.round((0.7 + aleatorio() * 0.25) * 100) / 100,
    bbox: {
      x: Math.round((0.22 + aleatorio() * 0.3) * 100) / 100,
      y: Math.round((0.2 + aleatorio() * 0.28) * 100) / 100,
      w: 0.3,
      h: 0.3,
    },
    revision: opciones.revision ?? 'pendiente',
    detectadoEn: opciones.detectadoEn ?? new Date().toISOString(),
    humedad: registroPlanta?.humedad ?? 85,
    fotoUrl: `/api/fotos/${id}.svg`,
    gafas: 'no_enviado',
    recomendacion: RECOMENDACIONES[tipo],
  };

  hallazgos.set(id, hallazgo);
  if (opciones.reviso) revisores.set(id, opciones.reviso);

  // Una falsa alarma, o un hallazgo ya resuelto, no deja la planta en alerta.
  if (registroPlanta && opciones.afectaPlanta !== false && hallazgo.revision !== 'falsa_alarma') {
    registroPlanta.estado = 'alerta';
    registroPlanta.hallazgoId = id;
  }

  return hallazgo;
}

/** Quién revisó cada hallazgo. */
export const revisores = new Map<string, string>();

// ── Celdas y camas del mapa ─────────────────────────────────────────────────
const PESO_ESTADO: Record<EstadoCelda, number> = {
  alerta: 3,
  riesgo: 2,
  sin_dato: 1,
  ok: 0,
};

/** El estado de la celda es el peor estado de las plantas que agrupa. */
function construirCelda(cama: number, indice: number): Celda {
  const numeros = plantasDeCelda(indice);
  const agrupadas = numeros
    .map((n) => plantas.get(idPlanta(cama, n)))
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

  // Si no hay alerta, el detalle abre la planta más húmeda de la celda.
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
    nave: naveDeCama(cama),
    estado,
    humedad,
    temperatura,
    plantas: numeros,
    hallazgoId,
    plantaId,
  };
}

export function construirCamas(): Cama[] {
  const camas: Cama[] = [];
  for (let numero = 1; numero <= TOTAL_CAMAS; numero++) {
    camas.push({
      numero,
      nave: naveDeCama(numero),
      celdas: Array.from({ length: CELDAS_POR_CAMA }, (_, i) => construirCelda(numero, i)),
    });
  }
  return camas;
}

export function construirNaves(): Nave[] {
  return Array.from({ length: ESTRUCTURA.naves }, (_, i) => {
    const numero = i + 1;
    const camas = camasDeNave(numero);
    const dePlantas = [...plantas.values()].filter((p) => p.nave === numero && p.estado !== 'sin_dato');
    const humedad = dePlantas.length
      ? Math.round((dePlantas.reduce((s, p) => s + p.humedad, 0) / dePlantas.length) * 10) / 10
      : 0;
    return { numero, camas, humedad };
  });
}

/** Humedad promedio de una nave, usada por la pantalla de equipos. */
export function humedadDeNave(nave: number): number {
  return construirNaves().find((n) => n.numero === nave)?.humedad ?? 0;
}

// ── Zonas húmedas ───────────────────────────────────────────────────────────
/**
 * Por cada cama, el tramo de plantas que está por encima del umbral y la
 * humedad media de ese tramo. Sale del dato real, no de una lista fija.
 */
export function zonasHumedas(): ZonaHumeda[] {
  const porCama = new Map<number, Planta[]>();
  for (const p of plantas.values()) {
    if (p.humedad < configuracion.umbrales.humedadRiesgo) continue;
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
        humedad:
          Math.round((lista.reduce((s, p) => s + p.humedad, 0) / lista.length) * 10) / 10,
      };
    })
    .sort((a, b) => b.humedad - a.humedad);
}

/** Camas por encima del umbral, para el KPI de la pantalla de equipos. */
export function camasHumedas(): Array<{ cama: number; nave: number }> {
  return zonasHumedas()
    .map((z) => ({ cama: z.cama, nave: z.nave }))
    .sort((a, b) => a.cama - b.cama);
}

/** Sugerencia del panel del mapa, a partir de la zona más húmeda. */
export function sugerencia(): { texto: string; nota: string } {
  const peor = zonasHumedas()[0];
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

// ── Resumen ─────────────────────────────────────────────────────────────────
export function construirResumen(): Resumen {
  let sanas = 0;
  let riesgo = 0;
  let alerta = 0;
  for (const p of plantas.values()) {
    if (p.estado === 'ok') sanas += 1;
    else if (p.estado === 'riesgo') riesgo += 1;
    else if (p.estado === 'alerta') alerta += 1;
  }

  // Solo cuentan las plantas que siguen en alerta esperando una decisión.
  const porRevisar = [...hallazgos.values()].filter(
    (h) => h.revision === 'pendiente' && plantas.get(h.plantaId)?.estado === 'alerta',
  ).length;

  return {
    bloque: ESTRUCTURA.bloque,
    totalPlantas: TOTAL_PLANTAS,
    sanas,
    riesgo,
    alerta,
    porRevisar,
    porcentajeSanas: Math.round((sanas / TOTAL_PLANTAS) * 1000) / 10,
    robot: {
      ...ROBOT,
      ultimaRonda: new Date(Date.now() - 41 * 60_000).toISOString(),
    },
    actualizado: new Date().toISOString(),
  };
}

export function construirMapa(): MapaRespuesta {
  return {
    bloque: ESTRUCTURA.bloque,
    camas: construirCamas(),
    naves: construirNaves(),
    resumen: construirResumen(),
    zonasHumedas: zonasHumedas().slice(0, 2),
    sugerencia: sugerencia(),
  };
}

// ── Alertas ─────────────────────────────────────────────────────────────────
function prioridad(h: Hallazgo): PrioridadAlerta {
  if (h.confianza >= 0.85 || h.humedad >= 90) return 'alta';
  if (h.confianza >= 0.7) return 'media';
  return 'baja';
}

export function aAlerta(h: Hallazgo): Alerta {
  return {
    id: `A-${h.id.slice(2)}`,
    hallazgoId: h.id,
    plantaId: h.plantaId,
    cama: h.cama,
    planta: h.planta,
    nave: h.nave,
    tipo: h.tipo,
    confianza: h.confianza,
    humedad: h.humedad,
    prioridad: prioridad(h),
    revision: h.revision,
    detectadoEn: h.detectadoEn,
    fotoUrl: h.fotoUrl,
  };
}

/** Horas que se consideran "alertas de hoy" en la pantalla de alertas. */
const VENTANA_ALERTAS_HORAS = 24;

export function listarAlertas(): Alerta[] {
  const desde = Date.now() - VENTANA_ALERTAS_HORAS * 60 * 60_000;
  return [...hallazgos.values()]
    .filter((h) => Date.parse(h.detectadoEn) >= desde)
    .sort((a, b) => Date.parse(b.detectadoEn) - Date.parse(a.detectadoEn))
    .map(aAlerta);
}

// ── Registro de incidencias ─────────────────────────────────────────────────
export function filasRegistro(): FilaRegistro[] {
  return [...hallazgos.values()]
    .sort((a, b) => Date.parse(b.detectadoEn) - Date.parse(a.detectadoEn))
    .map((h) => ({
      id: h.id,
      fecha: h.detectadoEn,
      plantaId: h.plantaId,
      etiqueta: etiquetaPlanta(h.cama, h.planta),
      cama: h.cama,
      nave: h.nave,
      tipo: h.tipo,
      confianza: h.confianza,
      decision: h.revision,
      reviso: revisores.get(h.id),
    }));
}

export function resumenRegistro(): ResumenRegistro {
  const filas = filasRegistro();
  const confirmados = filas.filter((f) => f.decision === 'confirmada').length;
  const falsasAlarmas = filas.filter((f) => f.decision === 'falsa_alarma').length;
  const revisados = confirmados + falsasAlarmas;

  // Rango de la semana, al estilo "17 – 24 oct 2026".
  const fechas = filas.map((f) => Date.parse(f.fecha));
  let semana = '—';
  if (fechas.length > 0) {
    const inicio = new Date(Math.min(...fechas));
    const fin = new Date(Math.max(...fechas));
    const mes = new Intl.DateTimeFormat('es-CO', { month: 'short' })
      .format(fin)
      .replace('.', '');
    semana = `${inicio.getDate()} – ${fin.getDate()} ${mes} ${fin.getFullYear()}`;
  }

  return {
    hallazgos: filas.length,
    confirmados,
    falsasAlarmas,
    porRevisar: filas.filter((f) => f.decision === 'pendiente').length,
    precision: revisados > 0 ? Math.round((confirmados / revisados) * 100) : 0,
    semana,
  };
}

/** Exportación a CSV del registro, tal y como dice la pantalla. */
export function registroCsv(): string {
  const cabecera = ['fecha', 'cama', 'planta', 'nave', 'tipo', 'confianza', 'decision', 'reviso'];
  const filas = filasRegistro().map((f) =>
    [
      f.fecha,
      f.cama,
      f.plantaId.split('-P')[1],
      f.nave,
      f.tipo,
      f.confianza.toFixed(2),
      f.decision,
      f.reviso ?? '',
    ].join(','),
  );
  return [cabecera.join(','), ...filas].join('\n');
}

// ── Registro ────────────────────────────────────────────────────────────────
let contadorRegistro = 0;

export function anotar(entrada: Omit<EntradaRegistro, 'id' | 'fecha'> & { fecha?: string }): EntradaRegistro {
  contadorRegistro += 1;
  const nueva: EntradaRegistro = {
    id: `R-${String(contadorRegistro).padStart(4, '0')}`,
    fecha: entrada.fecha ?? new Date().toISOString(),
    plantaId: entrada.plantaId,
    cama: entrada.cama,
    accion: entrada.accion,
    tipo: entrada.tipo,
    usuario: entrada.usuario,
    nota: entrada.nota,
  };
  registro.unshift(nueva);
  return nueva;
}

// ── Plantas vecinas ─────────────────────────────────────────────────────────
/**
 * Plantas vecinas: las de la misma cama, tres a cada lado, incluida la propia
 * (así el panel muestra P62 … P68 con P65 marcada, como en el diseño).
 */
export function vecinas(plantaId: string): Planta[] {
  const p = plantas.get(plantaId);
  if (!p) return [];
  const resultado: Planta[] = [];
  for (let d = -3; d <= 3; d++) {
    const vecina = plantas.get(idPlanta(p.cama, p.planta + d));
    if (vecina) resultado.push(vecina);
  }
  return resultado;
}

/** Serie de humedad de las últimas 12 horas para el gráfico del detalle. */
export function serieHumedad(plantaId: string): Array<{ hora: string; valor: number }> {
  const p = plantas.get(plantaId);
  const base = p?.humedad ?? 80;
  const serie: Array<{ hora: string; valor: number }> = [];
  const ahora = new Date();
  const ruido = prng(plantaId.length * 977 + base * 13);
  for (let i = 11; i >= 0; i--) {
    const momento = new Date(ahora.getTime() - i * 60 * 60_000);
    // La humedad sube de noche y baja a media tarde.
    const hora = momento.getHours();
    const ciclo = Math.cos(((hora - 4) / 24) * 2 * Math.PI) * 6;
    serie.push({
      hora: `${String(hora).padStart(2, '0')}:00`,
      valor: Math.round((base - 4 + ciclo + ruido() * 3) * 10) / 10,
    });
  }
  return serie;
}

// ── Arranque ────────────────────────────────────────────────────────────────
export function sembrar(): void {
  plantas.clear();
  hallazgos.clear();
  registro.length = 0;
  contadorHallazgos = 0;
  contadorRegistro = 0;

  revisores.clear();
  construirCultivo();
  sembrarHallazgos();
  sembrarHistorico();
}

/** La planta de la alerta del demo no debe estar en alerta al arrancar. */
export const PLANTA_DEMO = idPlanta(ALERTA_DEMO.cama, ALERTA_DEMO.planta);

sembrar();
