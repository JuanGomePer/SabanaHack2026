/** Protege rutas de ingesta externa (hoy, POST /api/observaciones) con una clave fija. */
import type { NextFunction, Request, Response } from 'express';
import { env } from '../env.js';

export function exigirApiKey(req: Request, res: Response, next: NextFunction): void {
  if (!env.robotApiKey) {
    // Sin clave configurada (típicamente en desarrollo local) queda abierto.
    next();
    return;
  }
  const recibida = req.header('x-api-key');
  if (recibida !== env.robotApiKey) {
    res.status(401).json({ error: 'x-api-key inválida o ausente.' });
    return;
  }
  next();
}
