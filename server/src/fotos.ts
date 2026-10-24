/**
 * Fotos del robot.
 *
 * Mientras no haya imágenes reales se genera un placeholder SVG con la caja
 * del hallazgo dibujada encima. Para usar fotos reales basta con dejar el
 * archivo en server/fotos/<idHallazgo>.jpg (o .png): la ruta lo sirve y el
 * placeholder deja de usarse. El frontend no cambia, sigue pidiendo
 * /api/fotos/<id>.svg.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { Hallazgo } from '@vigia/shared/tipos';

const aqui = path.dirname(fileURLToPath(import.meta.url));
export const CARPETA_FOTOS = path.resolve(aqui, '..', 'fotos');

/** Devuelve la ruta de la foto real del hallazgo, si existe. */
export function fotoReal(idHallazgo: string): string | undefined {
  for (const ext of ['jpg', 'jpeg', 'png', 'webp', 'svg']) {
    const ruta = path.join(CARPETA_FOTOS, `${idHallazgo}.${ext}`);
    if (fs.existsSync(ruta)) return ruta;
  }
  return undefined;
}

/** Placeholder: hoja de arándano con la caja del hallazgo marcada. */
export function placeholderSvg(h: Hallazgo, ancho = 640, alto = 480): string {
  const bx = Math.round(h.bbox.x * ancho);
  const by = Math.round(h.bbox.y * alto);
  const bw = Math.round(h.bbox.w * ancho);
  const bh = Math.round(h.bbox.h * alto);

  // Manchas de la lesión dentro de la caja, para que se lea como una foto.
  const manchas = [0, 1, 2, 3, 4, 5, 6]
    .map((i) => {
      const cx = bx + bw * (0.22 + ((i * 37) % 56) / 100);
      const cy = by + bh * (0.22 + ((i * 53) % 56) / 100);
      const r = 10 + ((i * 11) % 12);
      return `<circle cx="${cx.toFixed(0)}" cy="${cy.toFixed(0)}" r="${r}" fill="#e6e2d8" opacity="0.72"/>`;
    })
    .join('');

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${ancho}" height="${alto}" viewBox="0 0 ${ancho} ${alto}" role="img" aria-label="Foto del robot, ${h.tipo} en ${h.plantaId}">
  <defs>
    <linearGradient id="hoja" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#2c6b45"/>
      <stop offset="55%" stop-color="#1f5636"/>
      <stop offset="100%" stop-color="#14402a"/>
    </linearGradient>
  </defs>
  <rect width="${ancho}" height="${alto}" fill="url(#hoja)"/>
  <g stroke="#3f8a5c" stroke-width="3" opacity="0.5" fill="none">
    <path d="M${ancho * 0.1} ${alto * 0.85} Q ${ancho * 0.45} ${alto * 0.5} ${ancho * 0.9} ${alto * 0.2}"/>
    <path d="M${ancho * 0.3} ${alto * 0.95} Q ${ancho * 0.5} ${alto * 0.6} ${ancho * 0.6} ${alto * 0.1}"/>
    <path d="M${ancho * 0.05} ${alto * 0.45} Q ${ancho * 0.4} ${alto * 0.4} ${ancho * 0.95} ${alto * 0.6}"/>
  </g>
  <g fill="#4a2f6b" opacity="0.85">
    <circle cx="${ancho * 0.14}" cy="${alto * 0.82}" r="20"/>
    <circle cx="${ancho * 0.24}" cy="${alto * 0.89}" r="16"/>
    <circle cx="${ancho * 0.06}" cy="${alto * 0.93}" r="13"/>
  </g>
  ${manchas}
  <rect x="${bx}" y="${by}" width="${bw}" height="${bh}" fill="none" stroke="#e39a1b" stroke-width="3" rx="8"/>
  <text x="14" y="${alto - 14}" font-family="Figtree, Arial, sans-serif" font-size="12" fill="#cfebd9" opacity="0.85">${h.plantaId} · imagen de ejemplo</text>
</svg>`;
}
