import { Router } from 'express';
import type { RevisionHallazgo } from '@vigia/shared/tipos';
import { obtenerHallazgo, listarHallazgos } from '../repositories/hallazgos.js';
import { construirResumen } from '../services/mapa.js';
import { enviarAGafas, revisarHallazgo } from '../services/hallazgos.js';

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
  if (revision !== 'confirmada' && revision !== 'falsa_alarma') {
    return res.status(400).json({ error: 'revision debe ser "confirmada" o "falsa_alarma"' });
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
