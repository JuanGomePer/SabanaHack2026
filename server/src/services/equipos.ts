/**
 * Equipos de clima y eventos del programador.
 *
 * DATOS DE EJEMPLO: los estados, potencias y eventos los simula el
 * prototipo. No son lecturas reales de los equipos de Agrar.
 */
import { REGLAS_PROGRAMADOR, SERVICIO_TECNICO, UMBRALES } from '@vigia/shared/config';
import type { Equipo, EquiposRespuesta, EventoEquipo, ResumenEquipos } from '@vigia/shared/tipos';
import * as equiposRepo from '../repositories/equipos.js';
import { camasHumedas, humedadDeNave } from './mapa.js';

function nombreCorto(equipo: Omit<Equipo, 'humedad' | 'metricas'> & { nombreCorto?: string }): string {
  return equipo.nombreCorto ?? equipo.tipo;
}

function desde(iso: string): string {
  const minutos = Math.max(1, Math.round((Date.now() - Date.parse(iso)) / 60_000));
  if (minutos < 60) return `hace ${minutos} min`;
  return `hace ${Math.floor(minutos / 60)} h`;
}

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

async function resumenEquipos(equipos: Equipo[]): Promise<ResumenEquipos> {
  const enMarcha = equipos.filter((e) => e.estado === 'En marcha' || e.estado === 'Activo').length;
  const enEspera = equipos.filter((e) => e.estado === 'En espera').length;
  const conAviso = equipos.filter((e) => e.estado === 'Aviso');
  const humedadMedia =
    equipos.length === 0 ? 0 : Math.round((equipos.reduce((s, e) => s + e.humedad, 0) / equipos.length) * 10) / 10;

  const camas = await camasHumedas();
  const naves = new Set(camas.map((c) => c.nave));

  return {
    enMarcha,
    total: equipos.length,
    enEspera,
    avisos: conAviso.length,
    humedadMedia,
    camasHumedas: camas.map((c) => c.cama),
    naveCamasHumedas: naves.size === 1 ? [...naves][0] : undefined,
    avisoTexto: conAviso.length > 0 ? `${nombreCorto(conAviso[0])} de la nave ${conAviso[0].nave} sin respuesta` : undefined,
  };
}

export async function listarEquipos(): Promise<EquiposRespuesta> {
  const filas = await equiposRepo.listarEquiposDb();
  const equipos: Equipo[] = await Promise.all(
    filas.map(async (f) => {
      const humedad = await humedadDeNave(f.nave);
      const base: Equipo = { ...f, humedad, metricas: [] };
      return { ...base, metricas: calcularMetricas(base) };
    }),
  );

  return { equipos, resumen: await resumenEquipos(equipos), servicio: SERVICIO_TECNICO };
}

export async function listarEventosEquipo(): Promise<EventoEquipo[]> {
  return equiposRepo.listarEventosEquipo();
}

/** Regla del programador: humedad ≥ umbral enciende ventilación en la nave. */
export async function aplicarReglas(): Promise<EventoEquipo[]> {
  const nuevos: EventoEquipo[] = [];
  const filas = await equiposRepo.listarEquiposDb();

  for (const equipo of filas) {
    const humedad = await humedadDeNave(equipo.nave);
    if (equipo.icono === 'cpu' || equipo.estado === 'Aviso') continue;

    const debeVentilar = UMBRALES.ventilacionAutomatica && humedad >= UMBRALES.humedadAlta;
    if (debeVentilar && equipo.estado === 'En espera') {
      const potencia = equipo.tipo === 'Brazos Mecánicos®' ? 100 : 85;
      const queEstaPasando = `Encendidos por humedad de ${humedad.toFixed(0)} % en la nave ${equipo.nave}.`;
      await equiposRepo.actualizarEquipo(equipo.id, {
        estado: 'En marcha',
        potencia,
        queEstaPasando,
        ultimoDato: new Date(),
      });
      nuevos.push(
        await equiposRepo.crearEventoEquipo({
          texto: `Nave ${equipo.nave} a ${humedad.toFixed(0)} %: ${equipo.tipo.toLowerCase()} al ${potencia} %.`,
          nave: equipo.nave,
          equipoId: equipo.id,
        }),
      );
    }
  }

  return nuevos;
}

/**
 * Relaciona una alerta del cultivo con los equipos de su nave: sube la
 * ventilación de esa nave y deja la línea en "Qué está pasando".
 */
export async function responderAAlerta(nave: number, plantaId: string, cama: number): Promise<EventoEquipo[]> {
  const filas = await equiposRepo.listarEquiposDb();

  for (const equipo of filas) {
    if (equipo.nave !== nave || equipo.icono === 'cpu' || equipo.estado === 'Aviso') continue;
    await equiposRepo.actualizarEquipo(equipo.id, {
      estado: 'En marcha',
      potencia: 100,
      ultimoDato: new Date(),
      queEstaPasando: equipo.estado === 'En espera' ? `Al 100 % por humedad alta en la cama ${cama}.` : undefined,
    });
  }

  const humedad = await humedadDeNave(nave);
  const evento = await equiposRepo.crearEventoEquipo({
    texto: `Humedad de ${humedad.toFixed(0)} % en la cama ${cama}: los brazos mecánicos de la nave ${nave} subieron al 100 %.`,
    nave,
    plantaId,
  });

  return [evento];
}
