/** Dónde se concentra cada enfermedad/plaga, para la pantalla de Protocolos. */
import { Router } from 'express';
import { construirProtocolos } from '../services/protocolos.js';

export const protocolosRouter = Router();

protocolosRouter.get('/protocolos', async (_req, res) => {
  res.json(await construirProtocolos());
});
