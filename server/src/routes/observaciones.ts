import { Router } from 'express';
import { exigirApiKey } from '../middleware/apiKey.js';
import { ErrorIngesta, procesarObservacion, type ObservacionEntrada } from '../services/ingesta.js';

export const observacionesRouter = Router();

/**
 * Punto de entrada del módulo de visión (o de cualquier otro productor de
 * hallazgos). Protegido con `x-api-key` (ROBOT_API_KEY) porque, a diferencia
 * del resto del API, escribe datos a partir de lo que mande un cliente
 * externo. Ver src/services/ingesta.ts para la forma exacta del payload.
 */
observacionesRouter.post('/observaciones', exigirApiKey, async (req, res) => {
  try {
    const resultado = await procesarObservacion(req.body as ObservacionEntrada, 'vision');
    res.status(201).json(resultado);
  } catch (error) {
    if (error instanceof ErrorIngesta) {
      return res.status(422).json({ error: error.message, detalle: error.detalle });
    }
    throw error;
  }
});
