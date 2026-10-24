import { Router } from 'express';
import { construirCamas, construirMapa, construirResumen, obtenerCama } from '../services/mapa.js';

export const mapaRouter = Router();

mapaRouter.get('/mapa', async (_req, res) => {
  res.json(await construirMapa());
});

mapaRouter.get('/resumen', async (_req, res) => {
  res.json(await construirResumen());
});

mapaRouter.get('/camas', async (_req, res) => {
  res.json(await construirCamas());
});

mapaRouter.get('/camas/:numero', async (req, res) => {
  const numero = Number(req.params.numero);
  const cama = await obtenerCama(numero);
  if (!cama) return res.status(404).json({ error: 'Cama no encontrada' });
  res.json(cama);
});
