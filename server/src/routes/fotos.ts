import { Router } from 'express';
import { obtenerHallazgo } from '../repositories/hallazgos.js';
import { obtenerPlanta } from '../repositories/plantas.js';
import { fotoDeTipo, fotoReal, fotoSana, placeholderSvg } from '../fotos.js';

export const fotosRouter = Router();

/** Un día de caché: las fotos del disco no cambian entre peticiones. */
const CACHE_FOTO = 'public, max-age=86400';

/**
 * Foto de una planta sin hallazgos: lo que vio el robot en su última ronda.
 * Responde 404 si no hay nada en server/fotos/sana/, y el frontend oculta la
 * imagen sin romper el panel.
 *
 * Va antes que `/fotos/:archivo` para que esa ruta no se la coma.
 */
fotosRouter.get('/fotos/planta/:plantaId', async (req, res) => {
  const planta = await obtenerPlanta(req.params.plantaId);
  if (!planta) return res.status(404).json({ error: 'Planta no encontrada' });

  const foto = fotoSana(planta.id);
  if (!foto) return res.status(404).json({ error: 'No hay fotos en server/fotos/sana/' });

  res.setHeader('Cache-Control', CACHE_FOTO);
  return res.sendFile(foto);
});

/**
 * Foto de un hallazgo. Busca, en este orden:
 *   1. server/fotos/<idHallazgo>.jpg — la foto exacta de ese hallazgo
 *   2. server/fotos/<tipo>/*.jpg     — una del tipo (botrytis, alternaria, oidio)
 *   3. la imagen SVG generada, si no hay ninguna
 */
fotosRouter.get('/fotos/:archivo', async (req, res) => {
  const id = req.params.archivo.replace(/\.(svg|png|jpg|jpeg|webp)$/i, '');
  const hallazgo = await obtenerHallazgo(id);
  if (!hallazgo) return res.status(404).json({ error: 'Hallazgo no encontrado' });

  const propia = fotoReal(id);
  if (propia) {
    res.setHeader('Cache-Control', CACHE_FOTO);
    return res.sendFile(propia);
  }

  const delTipo = fotoDeTipo(hallazgo.tipo, hallazgo.id);
  if (delTipo) {
    res.setHeader('Cache-Control', CACHE_FOTO);
    return res.sendFile(delTipo);
  }

  res.type('image/svg+xml');
  res.setHeader('Cache-Control', 'no-cache');
  res.send(placeholderSvg(hallazgo));
});
