import { Router } from 'express';
import { reiniciarDemo } from '../services/demo.js';
import { construirResumen } from '../services/mapa.js';
import { saludDb } from '../services/mapa.js';
import { contarHallazgos } from '../repositories/hallazgos.js';

export const demoRouter = Router();

demoRouter.post('/demo/reiniciar', async (_req, res) => {
  await reiniciarDemo();
  res.json({ ok: true, resumen: await construirResumen() });
});

demoRouter.get('/salud', async (_req, res) => {
  const { plantas } = await saludDb();
  res.json({ ok: true, plantas, hallazgos: await contarHallazgos() });
});
