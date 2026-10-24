import { Router } from 'express';
import { NOTA_DATOS_EJEMPLO } from '@vigia/shared/config';
import {
  cambiarActivacionEquipo,
  listarEquipos,
  listarEventosEquipo,
} from '../services/equipos.js';

export const equiposRouter = Router();

equiposRouter.get('/equipos', async (_req, res) => {
  res.json({ ...(await listarEquipos()), nota: NOTA_DATOS_EJEMPLO });
});

equiposRouter.get('/equipos/eventos', async (_req, res) => {
  res.json(await listarEventosEquipo());
});

/**
 * Desactivar o reactivar un equipo a mano.
 *
 * Es la acción del protocolo: cuando se confirma un hongo, lo primero es
 * apagar la ventilación de la nave para que el aire no reparta las esporas.
 */
equiposRouter.patch('/equipos/:id', async (req, res) => {
  const desactivado = req.body?.desactivado;
  if (typeof desactivado !== 'boolean') {
    return res.status(400).json({ error: 'desactivado debe ser true o false' });
  }

  const motivo = typeof req.body?.motivo === 'string' ? req.body.motivo : undefined;
  const resultado = await cambiarActivacionEquipo(req.params.id, desactivado, motivo);
  if (!resultado) return res.status(404).json({ error: 'Equipo no encontrado' });

  res.json(resultado);
});
