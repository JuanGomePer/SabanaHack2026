import { Router } from 'express';
import { listarRegistro } from '../repositories/registro.js';
import { filasRegistro, registroCsv, resumenRegistro } from '../services/hallazgos.js';

export const registroRouter = Router();

registroRouter.get('/registro', async (_req, res) => {
  res.json({ filas: await filasRegistro(), resumen: await resumenRegistro() });
});

/** Bitácora de acciones (confirmaciones, envíos a las gafas, alertas nuevas). */
registroRouter.get('/registro/movimientos', async (_req, res) => {
  res.json(await listarRegistro());
});

registroRouter.get('/registro.csv', async (_req, res) => {
  res.type('text/csv');
  res.setHeader('Content-Disposition', 'attachment; filename="registro-vigia.csv"');
  res.send(await registroCsv());
});
