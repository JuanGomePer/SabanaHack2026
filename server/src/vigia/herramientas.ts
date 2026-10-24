/**
 * Herramientas de vigIA: consultas deterministas sobre datos reales.
 *
 * Nada aquí inventa una cifra — cada función solo agrupa o calcula a partir
 * de lo que ya hay en la base. Si falta un dato (ej. una cama sin plantas),
 * la función devuelve `null` o un campo vacío, nunca un valor inventado.
 */
import { ESTRUCTURA, naveDeCama } from '@vigia/shared/config';
import type { Hallazgo, TipoHallazgo } from '@vigia/shared/tipos';
import { listarPlantas, listarPlantasDeCama } from '../repositories/plantas.js';
import { listarHallazgos, listarHallazgosDesde, obtenerHallazgo } from '../repositories/hallazgos.js';
import { construirResumen, camasHumedasDesde, zonasHumedasDesde } from '../services/mapa.js';
import { listarEquipos } from '../services/equipos.js';
import { listarAlertas } from '../services/hallazgos.js';
import { detallePlanta } from '../services/plantas.js';
import { configuracionActual } from '../services/configuracion.js';

export async function estadoGeneral() {
  const plantas = await listarPlantas();
  const resumen = await construirResumen(plantas);
  const zonasHumedas = zonasHumedasDesde(plantas);
  const camasHumedas = camasHumedasDesde(plantas);
  return { resumen, zonasHumedas: zonasHumedas.slice(0, 5), camasHumedas };
}

export async function alertasPendientes() {
  const alertas = await listarAlertas('pendiente');
  return { total: alertas.length, alertas };
}

export async function explicarAlerta(hallazgoId: string) {
  const hallazgo = await obtenerHallazgo(hallazgoId);
  if (!hallazgo) return null;
  const detalle = await detallePlanta(hallazgo.plantaId);
  return { hallazgo, detalle };
}

async function resumenDeCama(cama: number) {
  const plantas = await listarPlantasDeCama(cama);
  const conteo = { ok: 0, riesgo: 0, alerta: 0, sin_dato: 0 };
  let sumaHumedad = 0;
  let sumaTemp = 0;
  for (const p of plantas) {
    conteo[p.estado] += 1;
    sumaHumedad += p.humedad;
    sumaTemp += p.temperatura;
  }
  const hallazgos = (await listarHallazgos()).filter((h) => h.cama === cama);
  return {
    cama,
    nave: naveDeCama(cama),
    totalPlantas: plantas.length,
    conteo,
    humedadPromedio: plantas.length ? Math.round((sumaHumedad / plantas.length) * 10) / 10 : null,
    temperaturaPromedio: plantas.length ? Math.round((sumaTemp / plantas.length) * 10) / 10 : null,
    hallazgosTotales: hallazgos.length,
    hallazgosConfirmados: hallazgos.filter((h) => h.revision === 'confirmada').length,
  };
}

export async function compararCamas(camaA: number, camaB: number) {
  return { a: await resumenDeCama(camaA), b: await resumenDeCama(camaB) };
}

export async function zonasRecurrentes(dias = 14, minimo = 2) {
  const desde = new Date(Date.now() - dias * 24 * 60 * 60 * 1000);
  const hallazgos = await listarHallazgosDesde(desde);
  const porCama = new Map<number, Hallazgo[]>();
  for (const h of hallazgos) {
    const lista = porCama.get(h.cama) ?? [];
    lista.push(h);
    porCama.set(h.cama, lista);
  }
  const zonas = [...porCama.entries()]
    .map(([cama, lista]) => ({
      cama,
      nave: naveDeCama(cama),
      total: lista.length,
      tipos: [...new Set(lista.map((h) => h.tipo))] as TipoHallazgo[],
      confirmados: lista.filter((h) => h.revision === 'confirmada').length,
    }))
    .filter((z) => z.total >= minimo)
    .sort((a, b) => b.total - a.total);
  return { dias, minimo, zonas };
}

export async function resumenRonda() {
  // El robot es un estado simulado (shared/config ROBOT): no hay en el
  // prototipo un registro real de "cuándo empezó y terminó cada ronda", así
  // que se aproxima con lo único verificable — los hallazgos recientes.
  const resumen = await construirResumen();
  const desde = new Date(Date.now() - 2 * 60 * 60 * 1000);
  const recientes = await listarHallazgosDesde(desde);
  return { robot: resumen.robot, hallazgosUltimasDosHoras: recientes };
}

export async function informePeriodo(dias: number) {
  const desde = new Date(Date.now() - dias * 24 * 60 * 60 * 1000);
  const hallazgos = await listarHallazgosDesde(desde);
  const confirmados = hallazgos.filter((h) => h.revision === 'confirmada').length;
  const falsas = hallazgos.filter((h) => h.revision === 'falsa_alarma').length;
  const pendientes = hallazgos.filter((h) => h.revision === 'pendiente').length;
  const revisados = confirmados + falsas;
  const porTipo = new Map<string, number>();
  for (const h of hallazgos) porTipo.set(h.tipo, (porTipo.get(h.tipo) ?? 0) + 1);
  return {
    dias,
    totalHallazgos: hallazgos.length,
    confirmados,
    falsas,
    pendientes,
    precision: revisados > 0 ? Math.round((confirmados / revisados) * 100) : null,
    porTipo: Object.fromEntries(porTipo),
  };
}

export async function precisionDetecciones() {
  const hallazgos = await listarHallazgos();
  const revisados = hallazgos.filter((h) => h.revision !== 'pendiente');
  const confirmados = revisados.filter((h) => h.revision === 'confirmada');
  const porTipo = new Map<TipoHallazgo, { confirmados: number; falsas: number }>();
  for (const h of revisados) {
    const e = porTipo.get(h.tipo) ?? { confirmados: 0, falsas: 0 };
    if (h.revision === 'confirmada') e.confirmados += 1;
    else e.falsas += 1;
    porTipo.set(h.tipo, e);
  }
  return {
    totalRevisados: revisados.length,
    confirmados: confirmados.length,
    falsasAlarmas: revisados.length - confirmados.length,
    precisionGeneral: revisados.length > 0 ? Math.round((confirmados.length / revisados.length) * 100) : null,
    porTipo: Object.fromEntries(
      [...porTipo.entries()].map(([tipo, v]) => [
        tipo,
        {
          ...v,
          precision:
            v.confirmados + v.falsas > 0
              ? Math.round((v.confirmados / (v.confirmados + v.falsas)) * 100)
              : null,
        },
      ]),
    ),
  };
}

export async function sugerirInspeccion() {
  const plantas = await listarPlantas();
  const camasHumedas = camasHumedasDesde(plantas);
  const setHumedas = new Set(camasHumedas.map((c) => c.cama));
  const { zonas } = await zonasRecurrentes(14, 2);
  const sugeridas = zonas
    .map((z) => ({ ...z, humedadAlta: setHumedas.has(z.cama) }))
    .sort((a, b) => Number(b.humedadAlta) - Number(a.humedadAlta) || b.total - a.total);
  // Camas con humedad alta que no tienen hallazgos recurrentes también son candidatas.
  const soloHumedas = camasHumedas.filter((c) => !zonas.some((z) => z.cama === c.cama));
  return { sugeridas, soloHumedas };
}

export async function estadoEquiposResumen() {
  return listarEquipos();
}

export async function tendenciaHumedad(cama: number) {
  const plantas = await listarPlantasDeCama(cama);
  if (plantas.length === 0) return null;
  const humedadPromedio = Math.round((plantas.reduce((s, p) => s + p.humedad, 0) / plantas.length) * 10) / 10;
  const umbral = configuracionActual().umbrales.humedadRiesgo;
  const sobreUmbral = plantas.filter((p) => p.humedad >= umbral).length;
  return {
    cama,
    nave: naveDeCama(cama),
    totalPlantas: plantas.length,
    humedadPromedio,
    umbral,
    sobreUmbral,
    porcentajeSobreUmbral: Math.round((sobreUmbral / plantas.length) * 100),
  };
}

export function consultarConfiguracionActual() {
  return { configuracion: configuracionActual(), estructura: ESTRUCTURA };
}
