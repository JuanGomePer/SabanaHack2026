import { Router } from 'express';
import { detallePlanta } from '../services/plantas.js';

export const plantasRouter = Router();

plantasRouter.get('/plantas/:id', async (req, res) => {
  const detalle = await detallePlanta(req.params.id);
  if (!detalle) return res.status(404).json({ error: 'Planta no encontrada' });
  res.json(detalle);
});
