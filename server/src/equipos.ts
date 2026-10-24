/**
 * Equipos de clima y eventos del programador.
 *
 * DATOS DE EJEMPLO: los estados, potencias y eventos los simula el prototipo.
 * No son lecturas reales de los equipos de Agrar.
 */

import {
  EQUIPOS_SEMILLA,
  REGLAS_PROGRAMADOR,
  SERVICIO_TECNICO,
  UMBRALES,
} from '@vigia/shared/config';
import type {
  Equipo,
  EquiposRespuesta,
  EventoEquipo,
  ResumenEquipos,
} from '@vigia/shared/tipos';
import { camasHumedas, hallazgos, humedadDeNave } from './datos';

/** Minutos desde la última lectura de cada equipo, para que la demo arranque poblada. */
const MINUTOS_ULTIMO_DATO: Record<string, number> = {
  'EQ-05': 14,
  'EQ-06': 6,
};

const equipos: Equipo[] = EQUIPOS_SEMILLA.map((semilla) => ({
  id: semilla.id,
  tipo: semilla.tipo,
  modelo: semilla.modelo,
  nave: semilla.nave,
  ubicacion: semilla.ubicacion,
  estado: semilla.estado,
  potencia: semilla.potencia,
  humedad: humedadDeNave(semilla.nave),
  ultimoDato: new Date(
    Date.now() - (MINUTOS_ULTIMO_DATO[semilla.id] ?? 1) * 60_000,
  ).toISOString(),
  queEstaPasando: semilla.queEstaPasando,
  icono: semilla.icono,
  conBarra: semilla.conBarra,
  metricas: [],
}));

/** Las dos cifras de la tarjeta dependen del tipo de equipo. */
function calcularMetricas(equipo: Equipo): Array<{ etiqueta: string; valor: string }> {
  if (equipo.icono === 'cpu') {
    return [
      { etiqueta: 'Reglas activas', valor: String(REGLAS_PROGRAMADOR) },
      { etiqueta: 'Última acción', valor: desde(equipo.ultimoDato) },
    ];
  }
  if (equipo.estado === 'Aviso') {
    return [
      { etiqueta: 'Potencia', valor: '—' },
      { etiqueta: 'Último dato', valor: desde(equipo.ultimoDato) },
    ];
  }
  return [
    { etiqueta: 'Potencia', valor: `${equipo.potencia} %` },
    { etiqueta: 'Humedad nave', valor: `${equipo.humedad.toFixed(0)} %` },
  ];
}

function nombreCorto(id: string): string {
  const semilla = EQUIPOS_SEMILLA.find((e) => e.id === id);
  return semilla?.nombreCorto ?? semilla?.tipo ?? 'Equipo';
}

function desde(iso: string): string {
  const minutos = Math.max(1, Math.round((Date.now() - Date.parse(iso)) / 60_000));
  if (minutos < 60) return `hace ${minutos} min`;
  return `hace ${Math.floor(minutos / 60)} h`;
}

export const eventos: EventoEquipo[] = [];
let contadorEventos = 0;

export function anotarEvento(
  texto: string,
  extra: { nave?: number; equipoId?: string; plantaId?: string; fecha?: string } = {},
): EventoEquipo {
  contadorEventos += 1;
  const evento: EventoEquipo = {
    id: `E-${String(contadorEventos).padStart(4, '0')}`,
    fecha: extra.fecha ?? new Date().toISOString(),
    texto,
    nave: extra.nave,
    equipoId: extra.equipoId,
    plantaId: extra.plantaId,
  };
  eventos.unshift(evento);
  // La lista "Qué está pasando" no necesita más de 20 líneas.
  if (eventos.length > 20) eventos.length = 20;
  return evento;
}

/** Regla del programador: humedad ≥ umbral enciende ventilación en la nave. */
export function aplicarReglas(): EventoEquipo[] {
  const nuevos: EventoEquipo[] = [];

  for (const equipo of equipos) {
    equipo.humedad = humedadDeNave(equipo.nave);
    if (equipo.icono === 'cpu' || equipo.estado === 'Aviso') continue;

    const debeVentilar = UMBRALES.ventilacionAutomatica && equipo.humedad >= UMBRALES.humedadAlta;

    if (debeVentilar && equipo.estado === 'En espera') {
      equipo.estado = 'En marcha';
      equipo.potencia = equipo.tipo === 'Brazos Mecánicos®' ? 100 : 85;
      equipo.ultimoDato = new Date().toISOString();
      equipo.queEstaPasando = `Encendidos por humedad de ${equipo.humedad.toFixed(0)} % en la nave ${equipo.nave}.`;
      nuevos.push(
        anotarEvento(
          `Nave ${equipo.nave} a ${equipo.humedad.toFixed(0)} %: ${equipo.tipo.toLowerCase()} al ${equipo.potencia} %.`,
          { nave: equipo.nave, equipoId: equipo.id },
        ),
      );
    }
  }

  return nuevos;
}

/**
 * Relaciona una alerta del cultivo con los equipos de su nave: sube la
 * ventilación de esa nave y deja la línea en "Qué está pasando".
 */
export function responderAAlerta(nave: number, plantaId: string, cama: number): EventoEquipo[] {
  const nuevos: EventoEquipo[] = [];

  for (const equipo of equipos) {
    if (equipo.nave !== nave || equipo.icono === 'cpu' || equipo.estado === 'Aviso') continue;
    // Los que ya estaban en marcha conservan su descripción; los demás arrancan.
    if (equipo.estado === 'En espera') {
      equipo.queEstaPasando = `Al 100 % por humedad alta en la cama ${cama}.`;
    }
    equipo.estado = 'En marcha';
    equipo.potencia = 100;
    equipo.ultimoDato = new Date().toISOString();
  }

  const humedad = humedadDeNave(nave);
  nuevos.push(
    anotarEvento(
      `Humedad de ${humedad.toFixed(0)} % en la cama ${cama}: los brazos mecánicos de la nave ${nave} subieron al 100 %.`,
      { nave, plantaId },
    ),
  );

  return nuevos;
}

export function construirResumenEquipos(): ResumenEquipos {
  const enMarcha = equipos.filter((e) => e.estado === 'En marcha' || e.estado === 'Activo').length;
  const enEspera = equipos.filter((e) => e.estado === 'En espera').length;
  const conAviso = equipos.filter((e) => e.estado === 'Aviso');
  const humedadMedia =
    Math.round((equipos.reduce((s, e) => s + e.humedad, 0) / equipos.length) * 10) / 10;

  const camas = camasHumedas();
  const naves = new Set(camas.map((c) => c.nave));

  return {
    enMarcha,
    total: equipos.length,
    enEspera,
    avisos: conAviso.length,
    humedadMedia,
    camasHumedas: camas.map((c) => c.cama),
    naveCamasHumedas: naves.size === 1 ? [...naves][0] : undefined,
    avisoTexto:
      conAviso.length > 0
        ? `${nombreCorto(conAviso[0].id)} de la nave ${conAviso[0].nave} sin respuesta`
        : undefined,
  };
}

export function listarEquipos(): EquiposRespuesta {
  for (const equipo of equipos) {
    equipo.humedad = humedadDeNave(equipo.nave);
    equipo.metricas = calcularMetricas(equipo);
  }
  return {
    equipos: equipos.map((e) => ({ ...e })),
    resumen: construirResumenEquipos(),
    servicio: SERVICIO_TECNICO,
  };
}

/** Eventos iniciales, para que la lista no arranque vacía en la demo. */
export function sembrarEventos(): void {
  const minutos = (n: number) => new Date(Date.now() - n * 60_000).toISOString();

  anotarEvento('Cortinas de la nave 2 cerradas por temperatura baja.', {
    nave: 2,
    fecha: minutos(60),
  });
  anotarEvento('Ventiladores de las naves 3 y 4 al 40 % por humedad normal.', {
    nave: 3,
    equipoId: 'EQ-01',
    fecha: minutos(32),
  });
  anotarEvento('El enfriador de la nave 1 dejó de responder.', {
    nave: 1,
    equipoId: 'EQ-05',
    fecha: minutos(14),
  });
  anotarEvento(
    `Regla activada: humedad ≥ ${UMBRALES.humedadAlta} % enciende ventilación en la nave 5.`,
    { nave: 5, equipoId: 'EQ-06', fecha: minutos(6) },
  );

  const enNave5 = [...hallazgos.values()].find((h) => h.nave === 5);
  if (enNave5) {
    anotarEvento(
      `Brazos mecánicos de la nave 5 barriendo las camas 13 a 15 desde el hallazgo en ${enNave5.cama === 14 ? 'la cama 14' : `la cama ${enNave5.cama}`}.`,
      { nave: 5, plantaId: enNave5.plantaId, equipoId: 'EQ-02', fecha: minutos(2) },
    );
  }
}

sembrarEventos();
