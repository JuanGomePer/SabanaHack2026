/**
 * Creación y revisión de hallazgos, alertas y el registro de incidencias.
 * Puerto de la lógica que tenía `server/src/datos.ts` + los handlers de
 * `/api/hallazgos/*` en `index.ts`, ahora contra la base de datos.
 */
import {
  DISPOSITIVO_GAFAS,
  RECOMENDACIONES,
  USUARIO,
  etiquetaPlanta,
  idPlanta,
  naveDeCama,
} from '@vigia/shared/config';
import type {
  Alerta,
  BBox,
  FilaRegistro,
  Hallazgo,
  PrioridadAlerta,
  ResumenRegistro,
  RevisionHallazgo,
  TipoHallazgo,
} from '@vigia/shared/tipos';
import { formatAlertaId, parseHallazgoId } from '../ids.js';
import * as hallazgosRepo from '../repositories/hallazgos.js';
import * as plantasRepo from '../repositories/plantas.js';
import { anotarRegistro } from '../repositories/registro.js';
import { emitir } from '../sse.js';
import { configuracionActual } from './configuracion.js';

export interface OpcionesCrearHallazgo {
  detectadoEn?: Date;
  confianza?: number;
  bbox?: BBox;
  revision?: RevisionHallazgo;
  reviso?: string;
  /** Los hallazgos de días pasados ya están resueltos: no dejan la planta en alerta. */
  afectaPlanta?: boolean;
  /** Humedad de referencia; si no se da, se toma la de la planta en ese momento. */
  humedad?: number;
  origen?: 'simulador' | 'vision' | 'manual';
  observacionId?: string;
}

/** Crea un hallazgo y, si corresponde, pone la planta en alerta. */
export async function crearHallazgo(
  cama: number,
  planta: number,
  tipo: TipoHallazgo,
  opciones: OpcionesCrearHallazgo = {},
): Promise<Hallazgo> {
  const plantaId = idPlanta(cama, planta);
  const nave = naveDeCama(cama);
  const registroPlanta = await plantasRepo.obtenerPlanta(plantaId);

  const confianza = opciones.confianza ?? Math.round((0.7 + Math.random() * 0.25) * 100) / 100;
  const bbox: BBox = opciones.bbox ?? {
    x: Math.round((0.22 + Math.random() * 0.3) * 100) / 100,
    y: Math.round((0.2 + Math.random() * 0.28) * 100) / 100,
    w: 0.3,
    h: 0.3,
  };
  const revision = opciones.revision ?? 'pendiente';

  const hallazgo = await hallazgosRepo.crearHallazgo({
    plantaId,
    cama,
    planta,
    nave,
    tipo,
    confianza,
    bbox,
    revision,
    detectadoEn: opciones.detectadoEn ?? new Date(),
    humedad: opciones.humedad ?? registroPlanta?.humedad ?? 85,
    recomendacion: RECOMENDACIONES[tipo],
    reviso: opciones.reviso,
    origen: opciones.origen ?? 'simulador',
    observacionId: opciones.observacionId,
  });

  const afectaPlanta = registroPlanta && opciones.afectaPlanta !== false && revision !== 'falsa_alarma';
  if (afectaPlanta) {
    await plantasRepo.actualizarEstadoPlanta(plantaId, { estado: 'alerta', hallazgoId: hallazgo.id });
  }

  return hallazgo;
}

// ── Alertas ─────────────────────────────────────────────────────────────────
function prioridad(h: Hallazgo): PrioridadAlerta {
  if (h.confianza >= 0.85 || h.humedad >= 90) return 'alta';
  if (h.confianza >= 0.7) return 'media';
  return 'baja';
}

export function aAlerta(h: Hallazgo): Alerta {
  const numero = parseHallazgoId(h.id);
  return {
    id: numero !== null ? formatAlertaId(numero) : `A-${h.id}`,
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

const VENTANA_ALERTAS_HORAS = 24;

export async function listarAlertas(filtroRevision?: RevisionHallazgo): Promise<Alerta[]> {
  const desde = new Date(Date.now() - VENTANA_ALERTAS_HORAS * 60 * 60_000);
  const hallazgos = await hallazgosRepo.listarHallazgosDesde(desde);
  const filtrados = filtroRevision ? hallazgos.filter((h) => h.revision === filtroRevision) : hallazgos;
  return filtrados.map(aAlerta);
}

// ── Revisión (confirmar / falsa alarma) ─────────────────────────────────────
export interface ResultadoRevision {
  hallazgo: Hallazgo;
  alerta: Alerta;
}

export async function revisarHallazgo(
  id: string,
  revision: Exclude<RevisionHallazgo, 'pendiente'>,
  nota?: string,
): Promise<ResultadoRevision | null> {
  const existente = await hallazgosRepo.obtenerHallazgo(id);
  if (!existente) return null;

  const actualizado = await hallazgosRepo.actualizarRevisionHallazgo(id, revision, USUARIO.firma);
  if (!actualizado) return null;

  const planta = await plantasRepo.obtenerPlanta(existente.plantaId);
  if (planta) {
    /**
     * El estado de la planta sigue a la decisión:
     * - tomar la alerta la pasa a "en revisión" (alguien va a mirarla),
     * - confirmarla en campo la deja "afectada",
     * - descartarla la devuelve a riesgo u ok según su humedad.
     */
    const nuevoEstado =
      revision === 'falsa_alarma'
        ? planta.humedad >= configuracionActual().umbrales.humedadRiesgo
          ? 'riesgo'
          : 'ok'
        : revision === 'en_revision'
          ? 'en_revision'
          : 'confirmada';

    await plantasRepo.actualizarEstadoPlanta(planta.id, {
      estado: nuevoEstado,
      hallazgoId: revision === 'falsa_alarma' ? null : id,
    });
    emitir({ tipo: 'estado_cambiado', plantaId: planta.id, estado: nuevoEstado });
  }

  const etiqueta = etiquetaPlanta(existente.cama, existente.planta);
  const notaPorDefecto =
    revision === 'en_revision'
      ? `${existente.tipo} en ${etiqueta}: tomada para revisar en campo.`
      : revision === 'confirmada'
        ? `${existente.tipo} confirmada en campo en ${etiqueta}.`
        : `Marcada como falsa alarma en ${etiqueta}.`;

  await anotarRegistro({
    plantaId: existente.plantaId,
    cama: existente.cama,
    accion: revision,
    tipo: existente.tipo,
    usuario: USUARIO.nombre,
    nota: nota?.trim() || notaPorDefecto,
  });

  return { hallazgo: actualizado, alerta: aAlerta(actualizado) };
}

// ── Envío a las gafas (simulado) ────────────────────────────────────────────
export interface ResultadoGafas {
  hallazgoId: string;
  gafas: Hallazgo['gafas'];
  dispositivo: string;
  enviadoEn: string;
}

export async function enviarAGafas(id: string): Promise<ResultadoGafas | null> {
  const existente = await hallazgosRepo.obtenerHallazgo(id);
  if (!existente) return null;

  await hallazgosRepo.actualizarGafasHallazgo(id, 'enviado');
  const enviadoEn = new Date().toISOString();

  await anotarRegistro({
    plantaId: existente.plantaId,
    cama: existente.cama,
    accion: 'enviada_a_gafas',
    tipo: existente.tipo,
    usuario: USUARIO.nombre,
    nota: `Hallazgo enviado a ${DISPOSITIVO_GAFAS} para revisar en sitio (simulado).`,
  });

  // El "acuse de recibo" del visor llega poco después. Sin integración real:
  // el servidor solo cambia el estado, no hay ningún Meta Quest de por medio.
  setTimeout(() => {
    hallazgosRepo
      .obtenerHallazgo(id)
      .then((actual) => {
        if (actual && actual.gafas === 'enviado') {
          return hallazgosRepo.actualizarGafasHallazgo(id, 'recibido');
        }
      })
      .catch((error) => console.error('[gafas] no se pudo marcar como recibido:', error));
  }, 1500);

  return { hallazgoId: id, gafas: 'enviado', dispositivo: DISPOSITIVO_GAFAS, enviadoEn };
}

// ── Registro de incidencias ─────────────────────────────────────────────────
export async function filasRegistro(): Promise<FilaRegistro[]> {
  const hallazgos = await hallazgosRepo.listarHallazgosParaRegistro();
  return hallazgos.map((h) => ({
    id: h.id,
    fecha: h.detectadoEn,
    plantaId: h.plantaId,
    etiqueta: etiquetaPlanta(h.cama, h.planta),
    cama: h.cama,
    nave: h.nave,
    tipo: h.tipo,
    confianza: h.confianza,
    decision: h.revision,
    reviso: h.reviso,
  }));
}

export async function resumenRegistro(): Promise<ResumenRegistro> {
  const filas = await filasRegistro();
  const confirmados = filas.filter((f) => f.decision === 'confirmada').length;
  const falsasAlarmas = filas.filter((f) => f.decision === 'falsa_alarma').length;
  const revisados = confirmados + falsasAlarmas;

  const fechas = filas.map((f) => Date.parse(f.fecha));
  let semana = '—';
  if (fechas.length > 0) {
    const inicio = new Date(Math.min(...fechas));
    const fin = new Date(Math.max(...fechas));
    const mes = new Intl.DateTimeFormat('es-CO', { month: 'short' }).format(fin).replace('.', '');
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

export async function registroCsv(): Promise<string> {
  const cabecera = ['fecha', 'cama', 'planta', 'nave', 'tipo', 'confianza', 'decision', 'reviso'];
  const filas = (await filasRegistro()).map((f) =>
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
