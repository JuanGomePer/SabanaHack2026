/** Modelo predictivo de humedad para la pantalla de Aprendizaje. */
import { Router } from 'express';
import { DIAS_PREDICCION } from '@vigia/shared/config';
import { construirPrediccion } from '../services/prediccion.js';

export const prediccionRouter = Router();

prediccionRouter.get('/prediccion', async (req, res) => {
  const dias = Number(req.query.dias ?? DIAS_PREDICCION);
  res.json(await construirPrediccion(Number.isInteger(dias) && dias > 0 && dias <= 60 ? dias : DIAS_PREDICCION));
});
