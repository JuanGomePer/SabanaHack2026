import { Router } from 'express';
import type { RevisionHallazgo } from '@vigia/shared/tipos';
import { listarAlertas } from '../services/hallazgos.js';

export const alertasRouter = Router();

alertasRouter.get('/alertas', async (req, res) => {
  const revision = req.query.revision as RevisionHallazgo | undefined;
  res.json(await listarAlertas(revision));
});
