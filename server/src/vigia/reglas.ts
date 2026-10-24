/**
 * Motor de reglas de vigIA: genera insights cuando pasa algo que vale la
 * pena anotar — una alerta nueva, una cama que repite hallazgos, una nave
 * con humedad persistente, un equipo que no responde.
 *
 * Cada regla usa una `dedupeKey` para no repetir el mismo aviso en cada
 * corrida del chequeo periódico — `crearInsightSiNuevo` no hace nada si ya
 * existe una fila con esa clave.
 */
import { RECOMENDACIONES } from '@vigia/shared/config';
import type { Alerta } from '@vigia/shared/tipos';
import { listarPlantas } from '../repositories/plantas.js';
import { crearInsightSiNuevo } from '../repositories/insights.js';
import { camasHumedasDesde } from '../services/mapa.js';
import { emitir } from '../sse.js';
import { estadoEquiposResumen, zonasRecurrentes } from './herramientas.js';

function hoyISO(): string {
  return new Date().toISOString().slice(0, 10);
}

function etiquetaDe(cama: number, planta: number): string {
  return `C${cama}-P${planta}`;
}

/** Se llama cada vez que entra una alerta nueva (demo o ingesta de visión). */
export async function generarInsightDeAlerta(alerta: Alerta): Promise<void> {
  const etiqueta = etiquetaDe(alerta.cama, alerta.planta);
  const insight = await crearInsightSiNuevo({
    tipo: 'alerta_nueva',
    titulo: `Posible ${alerta.tipo} en ${etiqueta}`,
    descripcion:
      `El robot detectó señales de ${alerta.tipo} con ${Math.round(alerta.confianza * 100)} % de ` +
      `confianza; la humedad estaba en ${alerta.humedad} % en ese momento.`,
    prioridad: alerta.prioridad,
    ubicacion: etiqueta,
    cama: alerta.cama,
    planta: alerta.planta,
    nave: alerta.nave,
    datos: { alerta },
    confianza: alerta.confianza,
    factores: [`humedad ${alerta.humedad} %`, `confianza del robot ${Math.round(alerta.confianza * 100)} %`],
    explicacion: 'Detección visual del robot, pendiente de confirmación humana.',
    recomendacion: RECOMENDACIONES[alerta.tipo],
    detalleTipo: 'planta',
    detalleId: alerta.plantaId,
    dedupeKey: `alerta:${alerta.hallazgoId}`,
  });
  if (insight) emitir({ tipo: 'insight_nuevo', insight });
}

/** Camas que acumulan hallazgos en la semana. */
async function revisarZonasRecurrentes(): Promise<void> {
  const { zonas } = await zonasRecurrentes(7, 3);
  const dia = hoyISO();

  for (const zona of zonas) {
    const insight = await crearInsightSiNuevo({
      tipo: 'zona_recurrente',
      titulo: `Cama ${zona.cama} acumula ${zona.total} hallazgos`,
      descripcion:
        `En los últimos 7 días, la cama ${zona.cama} (nave ${zona.nave}) tuvo ${zona.total} hallazgos` +
        (zona.confirmados > 0 ? `, ${zona.confirmados} ya confirmados.` : '.'),
      prioridad: zona.total >= 5 ? 'alta' : 'media',
      ubicacion: `Cama ${zona.cama}`,
      cama: zona.cama,
      nave: zona.nave,
      datos: { zona },
      factores: zona.tipos,
      explicacion: 'Varios hallazgos en la misma cama en poco tiempo suelen indicar un foco, no casos aislados.',
      recomendacion: `Prioriza la inspección física de la cama ${zona.cama}.`,
      detalleTipo: 'cama',
      detalleId: String(zona.cama),
      dedupeKey: `zona_recurrente:${zona.cama}:${dia}`,
    });
    if (insight) emitir({ tipo: 'insight_nuevo', insight });
  }
}

/** Naves con varias camas por encima del umbral de humedad. */
async function revisarHumedadPersistente(): Promise<void> {
  const plantas = await listarPlantas();
  const camasHumedas = camasHumedasDesde(plantas);
  const dia = hoyISO();

  const porNave = new Map<number, number[]>();
  for (const c of camasHumedas) {
    const lista = porNave.get(c.nave) ?? [];
    lista.push(c.cama);
    porNave.set(c.nave, lista);
  }

  for (const [nave, camas] of porNave) {
    const insight = await crearInsightSiNuevo({
      tipo: 'humedad_persistente',
      titulo: `Nave ${nave} con humedad alta`,
      descripcion: `Las camas ${camas.join(', ')} de la nave ${nave} están por encima del umbral de humedad.`,
      prioridad: camas.length >= 3 ? 'alta' : 'media',
      ubicacion: `Nave ${nave}`,
      nave,
      datos: { camas },
      explicacion: 'Humedad sostenida sobre el umbral favorece la aparición de hongos.',
      recomendacion: 'Revisa la ventilación de esa nave; el programador automático ya debería haber reaccionado.',
      detalleTipo: 'nave',
      detalleId: String(nave),
      dedupeKey: `humedad_persistente:${nave}:${dia}`,
    });
    if (insight) emitir({ tipo: 'insight_nuevo', insight });
  }
}

/** Equipos marcados "Aviso" (sin responder). */
async function revisarEquipos(): Promise<void> {
  const equipos = await estadoEquiposResumen();
  const dia = hoyISO();

  for (const eq of equipos.equipos.filter((e) => e.estado === 'Aviso')) {
    const insight = await crearInsightSiNuevo({
      tipo: 'equipo_sin_respuesta',
      titulo: `${eq.tipo} sin respuesta`,
      descripcion: `${eq.tipo} (${eq.ubicacion}) no responde: ${eq.queEstaPasando}`,
      prioridad: 'alta',
      ubicacion: eq.ubicacion,
      nave: eq.nave,
      datos: { equipo: eq },
      recomendacion: 'Pide servicio técnico desde la pantalla de Equipos.',
      detalleTipo: 'equipo',
      detalleId: eq.id,
      dedupeKey: `equipo_sin_respuesta:${eq.id}:${dia}`,
    });
    if (insight) emitir({ tipo: 'insight_nuevo', insight });
  }
}

/** Chequeo periódico completo — se llama desde el mismo latido que ya tiene equipos.ts. */
export async function revisarPatrones(): Promise<void> {
  await revisarZonasRecurrentes();
  await revisarHumedadPersistente();
  await revisarEquipos();
}
