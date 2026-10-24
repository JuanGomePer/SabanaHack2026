import { Router } from 'express';
import { configuracionActual } from '../services/configuracion.js';
import { programarAlertaDemo } from '../services/demo.js';
import { suscribir } from '../sse.js';

export const eventosRouter = Router();

eventosRouter.get('/eventos', (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();
  res.write(': conectado\n\n');

  const quitar = suscribir(res);

  // Al entrar al mapa arranca la cuenta atrás de la alerta del demo.
  programarAlertaDemo(configuracionActual().umbrales.segundosAlertaDemo);

  const latido = setInterval(() => res.write(': latido\n\n'), 25_000);

  req.on('close', () => {
    clearInterval(latido);
    quitar();
  });
});
