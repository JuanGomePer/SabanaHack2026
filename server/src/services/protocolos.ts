/**
 * Dónde se está concentrando cada enfermedad/plaga, para la pantalla de
 * Protocolos. Agrupa los hallazgos reales (no simulados: los que ya están en
 * la base) por tipo y por nave — nada de esto se inventa, sale de contar.
 */
import type { ConcentracionTipo, ProtocolosRespuesta, TipoHallazgo } from '@vigia/shared/tipos';
import { listarHallazgosDesde } from '../repositories/hallazgos.js';

const TIPOS: TipoHallazgo[] = ['Botrytis', 'Alternaria', 'Trips'];

export async function construirProtocolos(dias = 30): Promise<ProtocolosRespuesta> {
  const desde = new Date(Date.now() - dias * 24 * 60 * 60_000);
  const hallazgos = await listarHallazgosDesde(desde);

  const tipos: ConcentracionTipo[] = TIPOS.map((tipo) => {
    const delTipo = hallazgos.filter((h) => h.tipo === tipo);
    const porNaveMapa = new Map<number, number>();
    for (const h of delTipo) porNaveMapa.set(h.nave, (porNaveMapa.get(h.nave) ?? 0) + 1);
    const porNave = [...porNaveMapa.entries()]
      .map(([nave, cantidad]) => ({ nave, cantidad }))
      .sort((a, b) => b.cantidad - a.cantidad);

    const confianzaMedia =
      delTipo.length === 0
        ? 0
        : Math.round((delTipo.reduce((s, h) => s + h.confianza, 0) / delTipo.length) * 100) / 100;

    return {
      tipo,
      total: delTipo.length,
      porcentaje: hallazgos.length === 0 ? 0 : Math.round((delTipo.length / hallazgos.length) * 1000) / 10,
      porNave,
      confianzaMedia,
    };
  });

  return { total: hallazgos.length, dias, tipos };
}
