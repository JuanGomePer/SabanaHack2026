/**
 * Ingesta de observaciones del módulo de visión (`vision/`) o de cualquier
 * otro cliente externo que detecte hallazgos: POST /api/observaciones.
 *
 * El clasificador vive en un proceso Python aparte (vision/) y, a la fecha,
 * no tiene pesos entrenados para arándano ni un servicio de inferencia
 * corriendo — ver vision/CLAUDE.md. Por eso esta API no llama a ningún
 * modelo: solo recibe lo que un productor externo (hoy nadie; el día que
 * haya un modelo desplegado, él) decida publicar, y lo convierte en
 * hallazgos con las mismas reglas que usa el resto del sistema.
 *
 * La forma del payload está inspirada en la propuesta de contrato de visión
 * (vision/contracts/observation.schema.json, v0.2.0 — "propuesta, no API
 * implementada"), simplificada a lo mínimo que este backend necesita para
 * ubicar un hallazgo en una planta: ese contrato todavía no baja a nivel de
 * planta individual (solo a `bed_id`/cama), así que aquí se pide explícito.
 * Si el contrato de visión madura, lo que cambia es este mapeo — no el
 * resto del backend.
 */
import { ESTRUCTURA } from '@vigia/shared/config';
import type { BBox, Hallazgo, TipoHallazgo } from '@vigia/shared/tipos';
import { guardarObservacion } from '../repositories/observaciones.js';
import { anotarRegistro } from '../repositories/registro.js';
import { emitir } from '../sse.js';
import { aAlerta, crearHallazgo } from './hallazgos.js';
import { responderAAlerta } from './equipos.js';
import { configuracionActual } from './configuracion.js';
import { avisarPorSms } from './sms.js';

const CLASES_RECONOCIDAS: Record<string, TipoHallazgo> = {
  Botrytis: 'Botrytis',
  botrytis: 'Botrytis',
  'Botrytis cinerea': 'Botrytis',
  Alternaria: 'Alternaria',
  alternaria: 'Alternaria',
  'Alternaria sp': 'Alternaria',
  Oídio: 'Oídio',
  Oidio: 'Oídio',
  oidio: 'Oídio',
  'powdery mildew': 'Oídio',
};

export interface HallazgoVisualEntrada {
  class_name: string;
  confidence: number;
  taxonomy?: string;
  bbox_xyxy?: [number, number, number, number];
}

export interface ObservacionEntrada {
  observation_id?: string;
  model_version?: string;
  observed_at?: string;
  image_width?: number;
  image_height?: number;
  location: {
    bed_id: string | number;
    plant_number: number;
    greenhouse_id?: string | number;
  };
  visual_findings: HallazgoVisualEntrada[];
  environmental_context?: Array<{ variable: string; value: number }>;
}

export class ErrorIngesta extends Error {
  constructor(
    message: string,
    public readonly detalle?: unknown,
  ) {
    super(message);
  }
}

function aBBoxNormalizado(
  entrada: HallazgoVisualEntrada,
  anchoImagen?: number,
  altoImagen?: number,
): BBox {
  const xyxy = entrada.bbox_xyxy;
  if (!xyxy) {
    // Sin caja: se usa el mismo placeholder centrado que el resto del sistema.
    return { x: 0.3, y: 0.28, w: 0.3, h: 0.3 };
  }
  const [x0, y0, x1, y1] = xyxy;
  const normalizado = x1 <= 1 && y1 <= 1;
  const w = anchoImagen && !normalizado ? anchoImagen : 1;
  const h = altoImagen && !normalizado ? altoImagen : 1;
  return {
    x: Math.max(0, Math.min(1, x0 / w)),
    y: Math.max(0, Math.min(1, y0 / h)),
    w: Math.max(0, Math.min(1, (x1 - x0) / w)),
    h: Math.max(0, Math.min(1, (y1 - y0) / h)),
  };
}

function humedadDelContexto(entrada: ObservacionEntrada): number | undefined {
  const dato = entrada.environmental_context?.find((v) =>
    ['humidity', 'relative_humidity', 'humedad'].includes(v.variable.toLowerCase()),
  );
  return dato?.value;
}

/** Valida, audita y convierte una observación en uno o más hallazgos. */
export async function procesarObservacion(
  entrada: ObservacionEntrada,
  fuente: string,
): Promise<{ observacionId: string; hallazgos: Hallazgo[]; rechazados: Array<{ class_name: string; razon: string }> }> {
  if (!entrada.location || typeof entrada.location.plant_number !== 'number') {
    throw new ErrorIngesta('location.plant_number es obligatorio y debe ser un número.');
  }
  if (!Array.isArray(entrada.visual_findings) || entrada.visual_findings.length === 0) {
    throw new ErrorIngesta('visual_findings debe traer al menos un hallazgo.');
  }

  const cama = Number(entrada.location.bed_id);
  const planta = entrada.location.plant_number;
  if (!Number.isInteger(cama) || cama < 1) {
    throw new ErrorIngesta(`location.bed_id inválido: "${entrada.location.bed_id}".`);
  }
  if (!Number.isInteger(planta) || planta < 1 || planta > ESTRUCTURA.plantasPorCama) {
    throw new ErrorIngesta(
      `location.plant_number fuera de rango (1–${ESTRUCTURA.plantasPorCama}): ${planta}.`,
    );
  }

  const observacionId = await guardarObservacion(entrada, fuente);

  const umbral = configuracionActual().umbrales.confianzaMinima;
  const hallazgosCreados: Hallazgo[] = [];
  const rechazados: Array<{ class_name: string; razon: string }> = [];

  const humedad = humedadDelContexto(entrada);

  for (const hallazgoVisual of entrada.visual_findings) {
    const tipo = CLASES_RECONOCIDAS[hallazgoVisual.class_name];
    if (!tipo) {
      rechazados.push({
        class_name: hallazgoVisual.class_name,
        razon: 'Clase no reconocida en el contrato de arándano (Botrytis, Alternaria, Oídio).',
      });
      continue;
    }
    if (hallazgoVisual.confidence < 0 || hallazgoVisual.confidence > 1) {
      rechazados.push({ class_name: hallazgoVisual.class_name, razon: 'confidence fuera de 0–1.' });
      continue;
    }
    if (hallazgoVisual.confidence < umbral) {
      // Por debajo del umbral configurado: se audita (ya quedó en Observacion) pero no abre alerta.
      continue;
    }

    const hallazgo = await crearHallazgo(cama, planta, tipo, {
      confianza: hallazgoVisual.confidence,
      bbox: aBBoxNormalizado(hallazgoVisual, entrada.image_width, entrada.image_height),
      detectadoEn: entrada.observed_at ? new Date(entrada.observed_at) : new Date(),
      humedad,
      origen: 'vision',
      observacionId,
    });
    hallazgosCreados.push(hallazgo);

    await anotarRegistro({
      plantaId: hallazgo.plantaId,
      cama: hallazgo.cama,
      accion: 'alerta_nueva',
      tipo: hallazgo.tipo,
      usuario: 'Módulo de visión',
      nota: `Hallazgo de ${hallazgo.tipo} con ${Math.round(hallazgo.confianza * 100)} % de confianza (observación ${observacionId}).`,
    });
    const alerta = aAlerta(hallazgo);
    emitir({ tipo: 'alerta_nueva', alerta });

    // Canal de respaldo: si toca, el aviso sale también al celular.
    await avisarPorSms(alerta).catch((error) =>
      console.error('[ingesta] no se pudo avisar por SMS:', error),
    );

    const eventosEquipo = await responderAAlerta(hallazgo.nave, hallazgo.plantaId, hallazgo.cama);
    emitir({ tipo: 'equipos_actualizados', eventos: eventosEquipo });
  }

  return { observacionId, hallazgos: hallazgosCreados, rechazados };
}
