/** Construye la app de Express: middlewares, rutas y manejo de errores. Sin `listen()` — eso vive en index.ts. */
import cors from 'cors';
import express, { type NextFunction, type Request, type Response } from 'express';
import { env } from './env.js';
import { apiRouter } from './routes/index.js';

export function crearApp() {
  const app = express();

  app.use(cors({ origin: env.corsOrigin }));
  app.use(express.json());

  app.use('/api', apiRouter);

  // Manejador de errores al final: cualquier async/await que rechace cae aquí
  // (Express 4 no lo hace solo; cada handler usa async y deja que suba).
  app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
    console.error('[api] error no manejado:', err);
    res.status(500).json({ error: 'Error interno del servidor' });
  });

  return app;
}
