import { Router } from 'express';
import type { RevisionHallazgo } from '@vigia/shared/tipos';
import { obtenerHallazgo, listarHallazgos } from '../repositories/hallazgos.js';
import { construirResumen } from '../services/mapa.js';
import { enviarAGafas, revisarHallazgo } from '../services/hallazgos.js';
import { simularEvolucion } from '../vigia/simulacion.js';

export const hallazgosRouter = Router();

hallazgosRouter.get('/hallazgos', async (_req, res) => {
  res.json(await listarHallazgos());
});

hallazgosRouter.get('/hallazgos/:id', async (req, res) => {
  const hallazgo = await obtenerHallazgo(req.params.id);
  if (!hallazgo) return res.status(404).json({ error: 'Hallazgo no encontrado' });
  res.json(hallazgo);
});

/** Confirmar o marcar como falsa alarma. */
hallazgosRouter.post('/hallazgos/:id/revision', async (req, res) => {
  const revision = req.body?.revision as RevisionHallazgo | undefined;
  if (revision !== 'en_revision' && revision !== 'confirmada' && revision !== 'falsa_alarma') {
    return res.status(400).json({
      error: 'revision debe ser "en_revision", "confirmada" o "falsa_alarma"',
    });
  }

  const nota = typeof req.body?.nota === 'string' ? req.body.nota : undefined;
  const resultado = await revisarHallazgo(req.params.id, revision, nota);
  if (!resultado) return res.status(404).json({ error: 'Hallazgo no encontrado' });

  res.json({ ...resultado, resumen: await construirResumen() });
});

/**
 * Envío del hallazgo a las gafas.
 * SIMULACIÓN: el servidor solo cambia el estado y responde. No hay ninguna
 * integración real con Meta Quest ni con ningún visor.
 */
hallazgosRouter.post('/hallazgos/:id/enviar-a-gafas', async (req, res) => {
  const resultado = await enviarAGafas(req.params.id);
  if (!resultado) return res.status(404).json({ error: 'Hallazgo no encontrado' });
  res.json(resultado);
});

/**
 * Simulación de tratar vs. no tratar este hallazgo (vigIA).
 * Proyección estimada con reglas simples — no es un modelo epidemiológico real.
 */
hallazgosRouter.post('/hallazgos/:id/simular', async (req, res) => {
  const dias = Number(req.body?.dias ?? 7);
  const resultado = await simularEvolucion(req.params.id, Number.isInteger(dias) && dias > 0 ? dias : 7);
  if (!resultado) return res.status(404).json({ error: 'Hallazgo no encontrado' });
  res.json(resultado);
});
