import { Router } from 'express';
import { obtenerHallazgo } from '../repositories/hallazgos.js';
import { fotoReal, placeholderSvg } from '../fotos.js';

export const fotosRouter = Router();

fotosRouter.get('/fotos/:archivo', async (req, res) => {
  const id = req.params.archivo.replace(/\.(svg|png|jpg|jpeg|webp)$/i, '');
  const hallazgo = await obtenerHallazgo(id);
  if (!hallazgo) return res.status(404).json({ error: 'Hallazgo no encontrado' });

  const real = fotoReal(id);
  if (real) return res.sendFile(real);

  res.type('image/svg+xml');
  res.setHeader('Cache-Control', 'no-cache');
  res.send(placeholderSvg(hallazgo));
});
