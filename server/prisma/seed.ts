/**
 * Siembra inicial del cultivo: mismos datos deterministas que tenía
 * `server/src/datos.ts` en el prototipo en memoria, ahora escritos una sola
 * vez en la base de datos (no en cada arranque del servidor).
 *
 * `npx prisma db seed` — se corre a mano después de la primera migración, o
 * en el build de Render (ver render.yaml). Volver a correrlo sobre una base
 * ya sembrada falla a propósito: usa `npx prisma migrate reset` en local si
 * quieres empezar de cero.
 */
import {
  ALERTA_DEMO,
  EQUIPOS_SEMILLA,
  ESTRUCTURA,
  HISTORICO,
  PLANTAS_EN_ALERTA,
  RECOMENDACIONES,
  REVISORES,
  TIPOS_SEMILLA,
  TOTAL_CAMAS,
  UMBRALES,
  ZONAS_EN_RIESGO,
  ZONAS_SIN_DATO,
  idPlanta,
  naveDeCama,
} from '@vigia/shared/config';
import type { EstadoCelda, RevisionHallazgo, TipoHallazgo } from '@vigia/shared/tipos';
import { db, cerrarDb } from '../src/db.js';
import { formatHallazgoId } from '../src/ids.js';

/** Mismo generador pseudoaleatorio estable que usaba datos.ts: mismo seed → mismos datos. */
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

function humedadBase(cama: number): number {
  const nave = naveDeCama(cama);
  const sesgoNave = nave === 5 ? 6 : nave === 4 || nave === 6 ? 3 : 0;
  return 66 + sesgoNave + aleatorio() * 12;
}

interface FilaPlanta {
  id: string;
  cama: number;
  planta: number;
  nave: number;
  estado: EstadoCelda;
  humedad: number;
  temperatura: number;
  ultimaLectura: Date;
}

function construirPlantas(): FilaPlanta[] {
  const filas: FilaPlanta[] = [];
  for (let cama = 1; cama <= TOTAL_CAMAS; cama++) {
    const nave = naveDeCama(cama);
    for (let planta = 1; planta <= ESTRUCTURA.plantasPorCama; planta++) {
      const zona = ZONAS_EN_RIESGO.find((z) => z.cama === cama && planta >= z.desde && planta <= z.hasta);
      const sinDato = ZONAS_SIN_DATO.some((z) => z.cama === cama && planta >= z.desde && planta <= z.hasta);

      const humedad = zona
        ? Math.round((zona.humedad + aleatorio() * 3) * 10) / 10
        : Math.round(humedadBase(cama) * 10) / 10;

      const estado: EstadoCelda = sinDato ? 'sin_dato' : humedad >= UMBRALES.humedadRiesgo ? 'riesgo' : 'ok';

      filas.push({
        id: idPlanta(cama, planta),
        cama,
        planta,
        nave,
        estado,
        humedad,
        temperatura: Math.round((17.5 + aleatorio() * 4) * 10) / 10,
        ultimaLectura: new Date(Date.now() - Math.round(aleatorio() * 900_000)),
      });
    }
  }
  return filas;
}

interface HallazgoSemilla {
  plantaId: string;
  cama: number;
  planta: number;
  nave: number;
  tipo: TipoHallazgo;
  confianza: number;
  detectadoEn: Date;
  revision: RevisionHallazgo;
  reviso?: string;
  afectaPlanta: boolean;
}

const MINUTOS_SEMILLA = [38, 31, 44, 22, 57, 73, 96];

function construirHallazgosSemilla(): HallazgoSemilla[] {
  const filas: HallazgoSemilla[] = [];

  PLANTAS_EN_ALERTA.forEach(([cama, planta], i) => {
    const tipo = TIPOS_SEMILLA[i] ?? 'Botrytis';
    const minutos = MINUTOS_SEMILLA[i] ?? 30 + i * 11;
    const ultimo = i === PLANTAS_EN_ALERTA.length - 1;
    filas.push({
      plantaId: idPlanta(cama, planta),
      cama,
      planta,
      nave: naveDeCama(cama),
      tipo,
      confianza: Math.round((0.72 + aleatorio() * 0.24) * 100) / 100,
      detectadoEn: new Date(Date.now() - minutos * 60_000),
      revision: ultimo ? 'confirmada' : 'pendiente',
      reviso: ultimo ? REVISORES[1] : undefined,
      afectaPlanta: true,
    });
  });

  // Una falsa alarma reciente, para que la pantalla de alertas tenga los tres estados.
  filas.push({
    plantaId: idPlanta(9, 80),
    cama: 9,
    planta: 80,
    nave: naveDeCama(9),
    tipo: 'Oídio',
    confianza: 0.62,
    detectadoEn: new Date(Date.now() - 5 * 60 * 60_000),
    revision: 'falsa_alarma',
    reviso: REVISORES[0],
    afectaPlanta: true,
  });

  // Histórico: hallazgos de días anteriores, ya resueltos — no dejan la planta en alerta.
  const decisiones: RevisionHallazgo[] = [
    ...Array<RevisionHallazgo>(HISTORICO.confirmados).fill('confirmada'),
    ...Array<RevisionHallazgo>(HISTORICO.falsasAlarmas).fill('falsa_alarma'),
    ...Array<RevisionHallazgo>(HISTORICO.porRevisar).fill('pendiente'),
  ];
  const tipos: TipoHallazgo[] = ['Botrytis', 'Alternaria', 'Oídio'];

  decisiones.forEach((decision, i) => {
    const cama = 1 + Math.floor(aleatorio() * TOTAL_CAMAS);
    const planta = 1 + Math.floor(aleatorio() * ESTRUCTURA.plantasPorCama);
    const horas = 26 + Math.floor(aleatorio() * (HISTORICO.dias - 1) * 24);
    filas.push({
      plantaId: idPlanta(cama, planta),
      cama,
      planta,
      nave: naveDeCama(cama),
      tipo: tipos[i % tipos.length],
      confianza: Math.round((0.6 + aleatorio() * 0.35) * 100) / 100,
      detectadoEn: new Date(Date.now() - horas * 60 * 60_000),
      revision: decision,
      reviso: decision === 'pendiente' ? undefined : REVISORES[i % REVISORES.length],
      afectaPlanta: false,
    });
  });

  return filas;
}

async function sembrarPlantas(): Promise<Map<string, FilaPlanta>> {
  const filas = construirPlantas();
  await db.planta.createMany({
    data: filas.map((f) => ({ ...f, hallazgoId: null })),
  });
  console.log(`[seed] ${filas.length} plantas creadas.`);
  return new Map(filas.map((f) => [f.id, f]));
}

async function sembrarHallazgos(porPlanta: Map<string, FilaPlanta>): Promise<void> {
  const semillas = construirHallazgosSemilla();

  for (const s of semillas) {
    const humedad = porPlanta.get(s.plantaId)?.humedad ?? 85;
    const hallazgo = await db.hallazgo.create({
      data: {
        plantaId: s.plantaId,
        cama: s.cama,
        planta: s.planta,
        nave: s.nave,
        tipo: s.tipo === 'Oídio' ? 'Oidio' : s.tipo,
        confianza: s.confianza,
        bboxX: Math.round((0.22 + aleatorio() * 0.3) * 100) / 100,
        bboxY: Math.round((0.2 + aleatorio() * 0.28) * 100) / 100,
        bboxW: 0.3,
        bboxH: 0.3,
        revision: s.revision,
        detectadoEn: s.detectadoEn,
        humedad,
        fotoUrl: '',
        recomendacion: RECOMENDACIONES[s.tipo],
        reviso: s.reviso,
        origen: 'simulador',
      },
    });
    await db.hallazgo.update({
      where: { id: hallazgo.id },
      data: { fotoUrl: `/api/fotos/${formatHallazgoId(hallazgo.id)}.svg` },
    });

    if (s.afectaPlanta && s.revision !== 'falsa_alarma') {
      await db.planta.update({
        where: { id: s.plantaId },
        data: { estado: 'alerta', hallazgoId: formatHallazgoId(hallazgo.id) },
      });
    }
  }
  console.log(`[seed] ${semillas.length} hallazgos creados.`);
}

async function sembrarEquipos(): Promise<void> {
  const minutosUltimoDato: Record<string, number> = { 'EQ-05': 14, 'EQ-06': 6 };
  await db.equipo.createMany({
    data: EQUIPOS_SEMILLA.map((e) => ({
      id: e.id,
      tipo: e.tipo,
      nombreCorto: e.nombreCorto,
      modelo: e.modelo,
      nave: e.nave,
      ubicacion: e.ubicacion,
      estado: e.estado.replace(' ', '_') as 'En_marcha' | 'En_espera' | 'Aviso' | 'Activo',
      potencia: e.potencia,
      ultimoDato: new Date(Date.now() - (minutosUltimoDato[e.id] ?? 1) * 60_000),
      queEstaPasando: e.queEstaPasando,
      icono: e.icono,
      conBarra: e.conBarra,
    })),
  });
  console.log(`[seed] ${EQUIPOS_SEMILLA.length} equipos creados.`);
}

async function sembrarEventosEquipo(): Promise<void> {
  const minutos = (n: number) => new Date(Date.now() - n * 60_000);
  await db.eventoEquipo.createMany({
    data: [
      { texto: 'Cortinas de la nave 2 cerradas por temperatura baja.', nave: 2, fecha: minutos(60) },
      {
        texto: 'Ventiladores de las naves 3 y 4 al 40 % por humedad normal.',
        nave: 3,
        equipoId: 'EQ-01',
        fecha: minutos(32),
      },
      { texto: 'El enfriador de la nave 1 dejó de responder.', nave: 1, equipoId: 'EQ-05', fecha: minutos(14) },
      {
        texto: `Regla activada: humedad ≥ ${UMBRALES.humedadAlta} % enciende ventilación en la nave 5.`,
        nave: 5,
        equipoId: 'EQ-06',
        fecha: minutos(6),
      },
    ],
  });

  const enNave5 = await db.hallazgo.findFirst({ where: { nave: 5 } });
  if (enNave5) {
    await db.eventoEquipo.create({
      data: {
        texto: `Brazos mecánicos de la nave 5 barriendo las camas 13 a 15 desde el hallazgo en ${
          enNave5.cama === 14 ? 'la cama 14' : `la cama ${enNave5.cama}`
        }.`,
        nave: 5,
        plantaId: enNave5.plantaId,
        equipoId: 'EQ-02',
        fecha: minutos(2),
      },
    });
  }
  console.log('[seed] eventos de equipo creados.');
}

async function main(): Promise<void> {
  const yaSembrado = await db.planta.count();
  if (yaSembrado > 0) {
    console.log(`[seed] ya hay ${yaSembrado} plantas en la base — no se vuelve a sembrar.`);
    console.log('[seed] para empezar de cero: npx prisma migrate reset (local) y correr el seed de nuevo.');
    return;
  }

  console.log(`[seed] sembrando ${ESTRUCTURA.nombre}...`);
  const porPlanta = await sembrarPlantas();
  await sembrarHallazgos(porPlanta);
  await sembrarEquipos();
  await sembrarEventosEquipo();
  console.log('[seed] listo. La alerta de la demo (' + idPlanta(ALERTA_DEMO.cama, ALERTA_DEMO.planta) + ') la crea el simulador al primer cliente conectado, no la siembra.');
}

main()
  .catch((error) => {
    console.error('[seed] falló:', error);
    process.exitCode = 1;
  })
  .finally(() => cerrarDb());
