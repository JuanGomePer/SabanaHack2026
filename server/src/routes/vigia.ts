/**
 * vigIA: catálogo de acciones, ejecución y el historial de insights.
 * Ver server/src/vigia/ para la lógica — aquí solo la capa HTTP.
 */
import { Router } from 'express';
import type { AccionVigia, EstadoInsight } from '@vigia/shared/tipos';
import { CATALOGO_ACCIONES, detectarAccion, ejecutarAccion } from '../vigia/acciones.js';
import { actualizarEstadoInsight, contarInsightsNuevos, listarInsights } from '../repositories/insights.js';

export const vigiaRouter = Router();

vigiaRouter.get('/vigia/acciones', (_req, res) => {
  res.json({ acciones: CATALOGO_ACCIONES });
});

vigiaRouter.post('/vigia/consultar', async (req, res) => {
  const accionPedida = req.body?.accion as AccionVigia | undefined;
  const pregunta = typeof req.body?.pregunta === 'string' ? req.body.pregunta : undefined;
  const parametros = (req.body?.parametros ?? {}) as Record<string, string>;

  const accion = accionPedida ?? (pregunta ? detectarAccion(pregunta) : null);
  if (!accion) {
    return res.status(200).json({
      accion: null,
      titulo: 'No entendí la pregunta',
      texto: 'Prueba con uno de los botones sugeridos, o sé más específico (ej. "humedad de la cama 14").',
      generadoEn: new Date().toISOString(),
      error: 'sin_coincidencia',
    });
  }

  const valida = CATALOGO_ACCIONES.some((a) => a.id === accion);
  if (!valida) return res.status(400).json({ error: `Acción desconocida: ${accion}` });

  res.json(await ejecutarAccion(accion, parametros));
});

vigiaRouter.get('/vigia/insights', async (req, res) => {
  const estado = req.query.estado as EstadoInsight | undefined;
  const limite = req.query.limite ? Number(req.query.limite) : undefined;
  const [insights, nuevos] = await Promise.all([
    listarInsights({ estado, limite }),
    contarInsightsNuevos(),
  ]);
  res.json({ insights, nuevos });
});

vigiaRouter.patch('/vigia/insights/:id', async (req, res) => {
  const estado = req.body?.estado as EstadoInsight | undefined;
  if (estado !== 'revisado' && estado !== 'descartado' && estado !== 'nuevo') {
    return res.status(400).json({ error: 'estado debe ser "revisado", "descartado" o "nuevo"' });
  }
  const insight = await actualizarEstadoInsight(req.params.id, estado);
  if (!insight) return res.status(404).json({ error: 'Insight no encontrado' });
  res.json(insight);
});
