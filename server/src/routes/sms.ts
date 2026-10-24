/**
 * Avisos por SMS: configuración, números y envíos de prueba.
 * Quien manda el mensaje de verdad es la pasarela (ver pasarela.ts).
 */
import { Router } from 'express';
import { verificarCredenciales } from '../pasarela.js';
import {
  actualizarPreferencias,
  agregarDestino,
  cambiarDestino,
  enviarPrueba,
  quitarDestino,
  respuestaSms,
} from '../services/sms.js';

export const smsRouter = Router();

smsRouter.get('/sms', (_req, res) => {
  res.json(respuestaSms());
});

smsRouter.put('/sms', (req, res) => {
  const { activo, cuando, prioridadMinima, hayInternet } = req.body ?? {};
  actualizarPreferencias({ activo, cuando, prioridadMinima, hayInternet });
  res.json(respuestaSms());
});

smsRouter.post('/sms/destinos', async (req, res) => {
  const resultado = await agregarDestino(req.body?.nombre, req.body?.numero);
  if ('error' in resultado) return res.status(400).json(resultado);
  res.status(201).json({ destino: resultado, ...respuestaSms() });
});

smsRouter.patch('/sms/destinos/:id', (req, res) => {
  const resultado = cambiarDestino(req.params.id, req.body ?? {});
  if ('error' in resultado) return res.status(400).json(resultado);
  res.json({ destino: resultado, ...respuestaSms() });
});

smsRouter.delete('/sms/destinos/:id', async (req, res) => {
  const resultado = await quitarDestino(req.params.id);
  if ('error' in resultado) return res.status(404).json(resultado);
  res.json(respuestaSms());
});

/** Comprueba las credenciales de la pasarela SIN mandar ningún mensaje. */
smsRouter.post('/sms/verificar', async (_req, res) => {
  res.json({ verificacion: await verificarCredenciales(), ...respuestaSms() });
});

/** Manda un mensaje de prueba a los números activos. */
smsRouter.post('/sms/prueba', async (_req, res) => {
  const resultado = await enviarPrueba();
  if ('error' in resultado) return res.status(400).json(resultado);
  res.json({ enviados: resultado.length, ...respuestaSms() });
});
