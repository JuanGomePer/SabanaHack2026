/** Series para la pantalla de análisis. */
import { Router } from 'express';
import { construirSeries, esRango } from '../services/series.js';

export const seriesRouter = Router();

seriesRouter.get('/series', async (req, res) => {
  const rango = req.query.rango;
  if (rango !== undefined && !esRango(rango)) {
    return res.status(400).json({ error: 'rango debe ser "24h", "7d" o "30d"' });
  }
  res.json(await construirSeries(esRango(rango) ? rango : '24h'));
});
