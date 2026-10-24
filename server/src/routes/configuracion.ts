import { Router } from 'express';
import { actualizarConfiguracion, configuracionActual } from '../services/configuracion.js';

export const configuracionRouter = Router();

configuracionRouter.get('/configuracion', (_req, res) => {
  res.json(configuracionActual());
});

configuracionRouter.put('/configuracion', async (req, res) => {
  const { estructura, umbrales, perfil } = req.body ?? {};
  res.json(await actualizarConfiguracion({ estructura, umbrales, perfil }));
});
