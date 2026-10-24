/**
 * Catálogo de acciones de vigIA y el formateador que arma la respuesta en
 * español a partir de lo que devuelven las herramientas (herramientas.ts).
 *
 * No hay modelo de lenguaje: cada acción es un botón del chat que llama a
 * una función determinista. El texto se arma con plantillas sobre datos
 * reales — si una herramienta no tiene con qué responder, se dice tal cual.
 */
import { etiquetaPlanta, idPlanta, RECOMENDACIONES } from '@vigia/shared/config';
import type { AccionVigia, AccionVigiaInfo, EnlaceVigia, RespuestaVigia } from '@vigia/shared/tipos';
import * as h from './herramientas.js';

export const CATALOGO_ACCIONES: AccionVigiaInfo[] = [
  { id: 'estado_general', etiqueta: 'Estado del cultivo', descripcion: 'Resumen del bloque ahora mismo.' },
  { id: 'alertas_pendientes', etiqueta: 'Alertas por revisar', descripcion: 'Qué sigue pendiente de confirmar o descartar.' },
  {
    id: 'explicar_alerta',
    etiqueta: 'Explicar una alerta',
    descripcion: 'Detalle de un hallazgo puntual: por qué se abrió y qué hacer.',
    parametros: [{ nombre: 'hallazgoId', tipo: 'texto', requerido: true, etiqueta: 'Hallazgo (ej. H-0007)' }],
  },
  {
    id: 'comparar_camas',
    etiqueta: 'Comparar dos camas',
    descripcion: 'Humedad, temperatura y hallazgos de una cama frente a otra.',
    parametros: [
      { nombre: 'camaA', tipo: 'cama', requerido: true, etiqueta: 'Primera cama' },
      { nombre: 'camaB', tipo: 'cama', requerido: true, etiqueta: 'Segunda cama' },
    ],
  },
  { id: 'zonas_recurrentes', etiqueta: 'Zonas con más incidencias', descripcion: 'Camas que repiten hallazgos en los últimos 14 días.' },
  { id: 'resumen_ronda', etiqueta: 'Última ronda del robot', descripcion: 'Qué encontró el robot en las últimas horas.' },
  { id: 'informe_diario', etiqueta: 'Informe de hoy', descripcion: 'Hallazgos, confirmaciones y precisión de las últimas 24 h.' },
  { id: 'informe_semanal', etiqueta: 'Informe de la semana', descripcion: 'Lo mismo, de los últimos 7 días.' },
  { id: 'precision_detecciones', etiqueta: 'Precisión del robot', descripcion: 'Cuántas detecciones se confirman de verdad, por tipo.' },
  { id: 'sugerir_inspeccion', etiqueta: 'Dónde inspeccionar primero', descripcion: 'Camas que conviene revisar ya, con la razón.' },
  { id: 'estado_equipos', etiqueta: 'Estado de los equipos', descripcion: 'Ventiladores, brazos, extractores, enfriadores y el programador.' },
  {
    id: 'tendencia_humedad',
    etiqueta: 'Humedad de una cama',
    descripcion: 'Promedio de humedad y cuántas plantas pasan el umbral.',
    parametros: [{ nombre: 'cama', tipo: 'cama', requerido: true, etiqueta: 'Cama' }],
  },
  { id: 'consultar_configuracion', etiqueta: 'Umbrales configurados', descripcion: 'Qué valores está usando el sistema ahora mismo.' },
];

function pct(n: number): string {
  return `${n} %`;
}

export async function ejecutarAccion(
  accion: AccionVigia,
  parametros: Record<string, string> = {},
): Promise<RespuestaVigia> {
  const generadoEn = new Date().toISOString();
  const base = (parcial: Omit<RespuestaVigia, 'accion' | 'generadoEn'>): RespuestaVigia => ({
    accion,
    generadoEn,
    ...parcial,
  });

  switch (accion) {
    case 'estado_general': {
      const { resumen, zonasHumedas, camasHumedas } = await h.estadoGeneral();
      const peor = zonasHumedas[0];
      return base({
        titulo: `Bloque ${resumen.bloque}: ${pct(resumen.porcentajeSanas)} sanas`,
        texto:
          `De ${resumen.totalPlantas} plantas: ${resumen.sanas} sanas, ${resumen.riesgo} en riesgo y ` +
          `${resumen.alerta} en alerta (${resumen.porRevisar} por revisar). El robot está ${resumen.robot.estado} ` +
          `en la nave ${resumen.robot.nave}, ronda ${resumen.robot.ronda} de ${resumen.robot.rondasTotales}.`,
        prioridad: resumen.porRevisar > 0 ? 'media' : 'baja',
        datos: { resumen, camasHumedas },
        factores: peor ? [`Cama ${peor.cama} (nave ${peor.nave}) al ${peor.humedad.toFixed(0)} % de humedad`] : undefined,
        recomendacion:
          camasHumedas.length > 0
            ? `Revisa ventilación en ${camasHumedas.length === 1 ? 'la cama' : 'las camas'} ${camasHumedas.map((c) => c.cama).join(', ')}.`
            : undefined,
      });
    }

    case 'alertas_pendientes': {
      const { total, alertas } = await h.alertasPendientes();
      const altas = alertas.filter((a) => a.prioridad === 'alta');
      return base({
        titulo: total === 0 ? 'No hay alertas pendientes' : `${total} alerta${total === 1 ? '' : 's'} por revisar`,
        texto:
          total === 0
            ? 'Todas las alertas de las últimas 24 h ya están confirmadas o descartadas.'
            : `${total} alerta${total === 1 ? '' : 's'} esperan revisión, ${altas.length} de prioridad alta.`,
        prioridad: altas.length > 0 ? 'alta' : total > 0 ? 'media' : 'baja',
        datos: { alertas },
        enlaces: alertas.slice(0, 8).map((a) => ({ texto: etiquetaPlanta(a.cama, a.planta), tipo: 'hallazgo', id: a.hallazgoId })),
      });
    }

    case 'explicar_alerta': {
      const idPedido = parametros.hallazgoId?.trim();
      if (!idPedido) return base({ titulo: 'Falta el hallazgo', texto: 'Dime el id, ej. H-0007.', error: 'parametro_faltante' });
      const resultado = await h.explicarAlerta(idPedido);
      if (!resultado) {
        return base({ titulo: 'No encontré ese hallazgo', texto: `No existe ningún hallazgo con el id "${idPedido}".`, error: 'no_encontrado' });
      }
      const { hallazgo: hz, detalle } = resultado;
      const etiqueta = etiquetaPlanta(hz.cama, hz.planta);
      return base({
        titulo: `${hz.tipo} en ${etiqueta}`,
        texto:
          `Detectado hace ${Math.round((Date.now() - Date.parse(hz.detectadoEn)) / 60000)} min, con ` +
          `${Math.round(hz.confianza * 100)} % de confianza del robot. Humedad ${hz.humedad} % en ese momento. ` +
          `Estado: ${hz.revision === 'pendiente' ? 'por revisar' : hz.revision === 'confirmada' ? 'confirmado' : 'marcado como falsa alarma'}.`,
        prioridad: hz.confianza >= 0.85 || hz.humedad >= 90 ? 'alta' : hz.confianza >= 0.7 ? 'media' : 'baja',
        confianza: hz.confianza,
        datos: { hallazgo: hz, vecinas: detalle?.vecinas },
        explicacion: `${RECOMENDACIONES[hz.tipo] ? 'Se abrió la alerta porque el robot detectó señales visuales compatibles con ' + hz.tipo + '.' : ''}`,
        recomendacion: hz.recomendacion,
        enlaces: [{ texto: `Ver planta ${etiqueta}`, tipo: 'planta', id: hz.plantaId }],
      });
    }

    case 'comparar_camas': {
      const camaA = Number(parametros.camaA);
      const camaB = Number(parametros.camaB);
      if (!Number.isInteger(camaA) || !Number.isInteger(camaB)) {
        return base({ titulo: 'Faltan las camas a comparar', texto: 'Dime dos números de cama.', error: 'parametro_faltante' });
      }
      const { a, b } = await h.compararCamas(camaA, camaB);
      const masHumeda = (a.humedadPromedio ?? 0) >= (b.humedadPromedio ?? 0) ? a : b;
      return base({
        titulo: `Cama ${camaA} vs. cama ${camaB}`,
        texto:
          `Cama ${a.cama} (nave ${a.nave}): ${a.humedadPromedio ?? '—'} % humedad, ${a.conteo.alerta} en alerta, ` +
          `${a.hallazgosTotales} hallazgos. Cama ${b.cama} (nave ${b.nave}): ${b.humedadPromedio ?? '—'} % humedad, ` +
          `${b.conteo.alerta} en alerta, ${b.hallazgosTotales} hallazgos. La cama ${masHumeda.cama} está más húmeda.`,
        datos: { a, b },
      });
    }

    case 'zonas_recurrentes': {
      const { zonas, dias, minimo } = await h.zonasRecurrentes();
      return base({
        titulo: zonas.length === 0 ? 'Sin zonas recurrentes' : `${zonas.length} cama${zonas.length === 1 ? '' : 's'} con hallazgos repetidos`,
        texto:
          zonas.length === 0
            ? `Ninguna cama llegó a ${minimo} hallazgos en los últimos ${dias} días.`
            : `En los últimos ${dias} días: ${zonas
                .slice(0, 5)
                .map((z) => `cama ${z.cama} (${z.total})`)
                .join(', ')}.`,
        prioridad: zonas.length > 0 && zonas[0].total >= 4 ? 'alta' : zonas.length > 0 ? 'media' : 'baja',
        datos: { zonas },
        recomendacion: zonas.length > 0 ? `Prioriza la inspección física de la cama ${zonas[0].cama} (nave ${zonas[0].nave}).` : undefined,
      });
    }

    case 'resumen_ronda': {
      const { robot, hallazgosUltimasDosHoras } = await h.resumenRonda();
      return base({
        titulo: `Robot ${robot.estado} en nave ${robot.nave}`,
        texto:
          `Ronda ${robot.ronda} de ${robot.rondasTotales}, ${robot.progreso} % completada, batería ${robot.bateria} %. ` +
          `En las últimas 2 h encontró ${hallazgosUltimasDosHoras.length} hallazgo${hallazgosUltimasDosHoras.length === 1 ? '' : 's'}.`,
        datos: { robot, hallazgos: hallazgosUltimasDosHoras },
      });
    }

    case 'informe_diario':
    case 'informe_semanal': {
      const dias = accion === 'informe_diario' ? 1 : 7;
      const informe = await h.informePeriodo(dias);
      return base({
        titulo: `Informe de ${dias === 1 ? 'hoy' : 'la semana'}`,
        texto:
          `${informe.totalHallazgos} hallazgo${informe.totalHallazgos === 1 ? '' : 's'}: ${informe.confirmados} confirmados, ` +
          `${informe.falsas} falsas alarmas, ${informe.pendientes} por revisar.` +
          (informe.precision !== null ? ` Precisión: ${pct(informe.precision)}.` : ' Sin suficientes revisiones para calcular precisión.'),
        datos: informe,
      });
    }

    case 'precision_detecciones': {
      const p = await h.precisionDetecciones();
      return base({
        titulo: p.precisionGeneral !== null ? `Precisión general: ${pct(p.precisionGeneral)}` : 'Todavía sin datos de precisión',
        texto:
          p.totalRevisados === 0
            ? 'Ningún hallazgo tiene revisión humana todavía — no se puede calcular precisión.'
            : `De ${p.totalRevisados} hallazgos revisados, ${p.confirmados} se confirmaron y ${p.falsasAlarmas} eran falsas alarmas.`,
        confianza: p.precisionGeneral !== null ? p.precisionGeneral / 100 : undefined,
        datos: p,
      });
    }

    case 'sugerir_inspeccion': {
      const { sugeridas, soloHumedas } = await h.sugerirInspeccion();
      const top = sugeridas[0];
      return base({
        titulo: top ? `Prioridad: cama ${top.cama}` : 'Nada urgente por ahora',
        texto:
          top
            ? `Cama ${top.cama} (nave ${top.nave}) tiene ${top.total} hallazgos recientes` +
              (top.humedadAlta ? ' y humedad por encima del umbral.' : '.')
            : soloHumedas.length > 0
              ? `No hay camas con hallazgos repetidos, pero ${soloHumedas.length} están con humedad alta: ${soloHumedas.map((c) => c.cama).join(', ')}.`
              : 'No hay camas con hallazgos repetidos ni humedad por encima del umbral.',
        prioridad: top ? (top.humedadAlta ? 'alta' : 'media') : soloHumedas.length > 0 ? 'media' : 'baja',
        datos: { sugeridas, soloHumedas },
        factores: top ? [`${top.total} hallazgos en 14 días`, top.humedadAlta ? 'humedad sobre el umbral' : 'humedad normal'] : undefined,
        recomendacion: top ? `Manda al robot (o a alguien) a revisar físicamente la cama ${top.cama}.` : undefined,
      });
    }

    case 'estado_equipos': {
      const equipos = await h.estadoEquiposResumen();
      return base({
        titulo: `${equipos.resumen.enMarcha} de ${equipos.resumen.total} equipos en marcha`,
        texto:
          `${equipos.resumen.enEspera} en espera, ${equipos.resumen.avisos} con aviso. ` +
          `Humedad media ${pct(equipos.resumen.humedadMedia)}.` +
          (equipos.resumen.avisoTexto ? ` Ojo: ${equipos.resumen.avisoTexto}.` : ''),
        prioridad: equipos.resumen.avisos > 0 ? 'alta' : 'baja',
        datos: equipos,
      });
    }

    case 'tendencia_humedad': {
      const cama = Number(parametros.cama);
      if (!Number.isInteger(cama)) return base({ titulo: 'Falta la cama', texto: 'Dime el número de cama.', error: 'parametro_faltante' });
      const t = await h.tendenciaHumedad(cama);
      if (!t) return base({ titulo: 'Cama sin datos', texto: `No hay plantas registradas en la cama ${cama}.`, error: 'sin_datos' });
      return base({
        titulo: `Cama ${t.cama}: ${t.humedadPromedio} % de humedad`,
        texto: `${t.sobreUmbral} de ${t.totalPlantas} plantas (${pct(t.porcentajeSobreUmbral)}) están sobre el umbral de ${t.umbral} %.`,
        prioridad: t.porcentajeSobreUmbral >= 50 ? 'alta' : t.porcentajeSobreUmbral > 0 ? 'media' : 'baja',
        datos: t,
      });
    }

    case 'consultar_configuracion': {
      const { configuracion } = h.consultarConfiguracionActual();
      return base({
        titulo: 'Configuración actual',
        texto:
          `Humedad de riesgo ${pct(configuracion.umbrales.humedadRiesgo)}, confianza mínima del robot ` +
          `${pct(Math.round(configuracion.umbrales.confianzaMinima * 100))}, ventilación automática ` +
          `${configuracion.umbrales.ventilacionAutomatica ? 'activada' : 'apagada'}.`,
        datos: configuracion,
      });
    }

    default:
      return base({ titulo: 'No reconozco esa acción', texto: 'Prueba uno de los botones sugeridos.', error: 'accion_desconocida' });
  }
}

/** Enlaces "ver detalle" que se pueden anexar a una respuesta ya armada. */
export function enlaceAPlanta(plantaId: string): EnlaceVigia {
  return { texto: `Ver ${plantaId}`, tipo: 'planta', id: plantaId };
}

/** Intenta mapear una pregunta libre a la acción más parecida — no es NLP real, solo palabras clave. */
export function detectarAccion(pregunta: string): AccionVigia | null {
  const texto = pregunta.toLowerCase();
  const reglas: Array<[RegExp, AccionVigia]> = [
    [/precisi[oó]n|acierto|falsas alarmas/, 'precision_detecciones'],
    [/compar/, 'comparar_camas'],
    [/recurren|repit|varias veces/, 'zonas_recurrentes'],
    [/ronda|robot/, 'resumen_ronda'],
    [/informe.*semana|semanal/, 'informe_semanal'],
    [/informe|resumen del d[ií]a|hoy/, 'informe_diario'],
    [/inspecc|prioridad|d[oó]nde (reviso|miro)/, 'sugerir_inspeccion'],
    [/equipo|ventilad|extractor|enfriador/, 'estado_equipos'],
    [/humedad/, 'tendencia_humedad'],
    [/configuraci[oó]n|umbral/, 'consultar_configuracion'],
    [/pendiente|por revisar/, 'alertas_pendientes'],
    [/^h-?\d+|hallazgo|explica/, 'explicar_alerta'],
  ];
  for (const [patron, id] of reglas) if (patron.test(texto)) return id;
  return /estado|c[oó]mo (va|est[aá])|resumen/.test(texto) ? 'estado_general' : null;
}
