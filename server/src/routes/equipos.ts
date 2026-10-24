import { Router } from 'express';
import { NOTA_DATOS_EJEMPLO } from '@vigia/shared/config';
import { listarEquipos, listarEventosEquipo } from '../services/equipos.js';

export const equiposRouter = Router();

equiposRouter.get('/equipos', async (_req, res) => {
  res.json({ ...(await listarEquipos()), nota: NOTA_DATOS_EJEMPLO });
});

equiposRouter.get('/equipos/eventos', async (_req, res) => {
  res.json(await listarEventosEquipo());
});

/** Mock: "Pedir servicio técnico" y "Ver catálogo técnico". */
equiposRouter.post('/equipos/servicio', (req, res) => {
  const tipo = req.body?.tipo === 'catalogo' ? 'catalogo' : 'servicio';
  res.json({
    ok: true,
    tipo,
    mensaje:
      tipo === 'catalogo'
        ? 'Catálogo técnico solicitado. En el prototipo no se abre ningún catálogo real.'
        : 'Solicitud de servicio técnico registrada en el prototipo. No se envió a nadie.',
  });
});
