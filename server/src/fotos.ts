/**
 * Fotos del robot.
 *
 * Mientras no haya imágenes reales se genera una SVG con la caja del hallazgo
 * dibujada encima. Para usar fotos reales basta con dejar el archivo en
 * server/fotos/<idHallazgo>.jpg (o .png): la ruta lo sirve y el generador deja
 * de usarse. El frontend no cambia, sigue pidiendo /api/fotos/<id>.svg.
 *
 * La imagen se arma según el tipo de hallazgo, porque las tres enfermedades no
 * se parecen en nada: la Botrytis es un moho gris y velloso sobre el fruto, la
 * Alternaria son manchas marrones con anillos concéntricos en la hoja, y el
 * Oídio es un polvo blanco que se extiende por la superficie.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { Hallazgo, TipoHallazgo } from '@vigia/shared/tipos';

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

/** Pseudoaleatorio estable: el mismo hallazgo da siempre la misma imagen. */
function generador(semilla: number) {
  let s = semilla >>> 0 || 1;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

function hojas(rnd: () => number, ancho: number, alto: number): string {
  const partes: string[] = [];
  for (let i = 0; i < 9; i++) {
    const cx = rnd() * ancho;
    const cy = rnd() * alto;
    const rx = ancho * (0.14 + rnd() * 0.18);
    const ry = rx * (0.42 + rnd() * 0.2);
    const giro = Math.round(rnd() * 360);
    const tono = 28 + Math.round(rnd() * 34);
    partes.push(
      `<g transform="rotate(${giro} ${cx.toFixed(0)} ${cy.toFixed(0)})">` +
        `<ellipse cx="${cx.toFixed(0)}" cy="${cy.toFixed(0)}" rx="${rx.toFixed(0)}" ry="${ry.toFixed(0)}" fill="hsl(${118 + Math.round(rnd() * 14)} 38% ${tono}%)"/>` +
        `<path d="M${(cx - rx).toFixed(0)} ${cy.toFixed(0)} Q ${cx.toFixed(0)} ${(cy - ry * 0.35).toFixed(0)} ${(cx + rx).toFixed(0)} ${cy.toFixed(0)}" stroke="hsl(120 30% ${tono + 14}%)" stroke-width="1.6" fill="none" opacity="0.7"/>` +
        `</g>`,
    );
  }
  return partes.join('');
}

function frutos(rnd: () => number, ancho: number, alto: number): string {
  const partes: string[] = [];
  const cxBase = ancho * (0.1 + rnd() * 0.12);
  const cyBase = alto * (0.72 + rnd() * 0.12);
  for (let i = 0; i < 5; i++) {
    const cx = cxBase + (rnd() - 0.5) * ancho * 0.22;
    const cy = cyBase + (rnd() - 0.5) * alto * 0.2;
    const r = ancho * (0.035 + rnd() * 0.022);
    partes.push(
      `<g>` +
        `<circle cx="${cx.toFixed(0)}" cy="${cy.toFixed(0)}" r="${r.toFixed(0)}" fill="hsl(${255 + Math.round(rnd() * 20)} 32% ${22 + Math.round(rnd() * 12)}%)"/>` +
        `<circle cx="${(cx - r * 0.3).toFixed(0)}" cy="${(cy + r * 0.25).toFixed(0)}" r="${(r * 0.62).toFixed(0)}" fill="#ffffff" opacity="0.1"/>` +
        `<circle cx="${cx.toFixed(0)}" cy="${(cy - r * 0.45).toFixed(0)}" r="${(r * 0.26).toFixed(0)}" fill="#000000" opacity="0.3"/>` +
        `</g>`,
    );
  }
  return partes.join('');
}

/** La lesión, distinta según la enfermedad. */
function lesion(
  tipo: TipoHallazgo,
  rnd: () => number,
  bx: number,
  by: number,
  bw: number,
  bh: number,
): string {
  const partes: string[] = [];
  const cx = bx + bw / 2;
  const cy = by + bh / 2;

  if (tipo === 'Botrytis') {
    // Moho gris: masa velluda sobre el fruto, de bordes difusos.
    partes.push(
      `<ellipse cx="${cx}" cy="${cy}" rx="${bw * 0.42}" ry="${bh * 0.4}" fill="#5a5247" opacity="0.9" filter="url(#difuso)"/>`,
    );
    for (let i = 0; i < 26; i++) {
      const a = rnd() * Math.PI * 2;
      const d = (0.25 + rnd() * 0.42) * Math.min(bw, bh);
      const x = cx + Math.cos(a) * d;
      const y = cy + Math.sin(a) * d;
      partes.push(
        `<circle cx="${x.toFixed(0)}" cy="${y.toFixed(0)}" r="${(4 + rnd() * 9).toFixed(1)}" fill="#cfc8ba" opacity="${(0.3 + rnd() * 0.45).toFixed(2)}" filter="url(#difuso)"/>`,
      );
    }
    // Filamentos del micelio.
    for (let i = 0; i < 16; i++) {
      const a = rnd() * Math.PI * 2;
      const largo = Math.min(bw, bh) * (0.3 + rnd() * 0.3);
      partes.push(
        `<line x1="${cx.toFixed(0)}" y1="${cy.toFixed(0)}" x2="${(cx + Math.cos(a) * largo).toFixed(0)}" y2="${(cy + Math.sin(a) * largo).toFixed(0)}" stroke="#e8e3d8" stroke-width="1" opacity="0.3"/>`,
      );
    }
  } else if (tipo === 'Alternaria') {
    // Manchas con anillos concéntricos, típicas en la hoja.
    for (let m = 0; m < 3; m++) {
      const mx = bx + bw * (0.25 + rnd() * 0.5);
      const my = by + bh * (0.25 + rnd() * 0.5);
      const r = Math.min(bw, bh) * (0.16 + rnd() * 0.14);
      for (let anillo = 3; anillo >= 1; anillo--) {
        partes.push(
          `<circle cx="${mx.toFixed(0)}" cy="${my.toFixed(0)}" r="${(r * (anillo / 3)).toFixed(1)}" fill="hsl(${28 + anillo * 4} 45% ${16 + anillo * 7}%)" opacity="${0.92 - anillo * 0.08}"/>`,
        );
      }
      partes.push(
        `<circle cx="${mx.toFixed(0)}" cy="${my.toFixed(0)}" r="${(r * 1.18).toFixed(1)}" fill="none" stroke="#b7a33c" stroke-width="2" opacity="0.4"/>`,
      );
    }
  } else {
    // Oídio: polvo blanco que se extiende por la superficie.
    for (let i = 0; i < 34; i++) {
      const x = bx + rnd() * bw;
      const y = by + rnd() * bh;
      partes.push(
        `<circle cx="${x.toFixed(0)}" cy="${y.toFixed(0)}" r="${(6 + rnd() * 16).toFixed(1)}" fill="#f2f0ea" opacity="${(0.16 + rnd() * 0.3).toFixed(2)}" filter="url(#difuso)"/>`,
      );
    }
  }

  return partes.join('');
}

export function placeholderSvg(h: Hallazgo, ancho = 960, alto = 720): string {
  const rnd = generador(h.cama * 7919 + h.planta * 104729);
  const bx = h.bbox.x * ancho;
  const by = h.bbox.y * alto;
  const bw = h.bbox.w * ancho;
  const bh = h.bbox.h * alto;

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${ancho}" height="${alto}" viewBox="0 0 ${ancho} ${alto}" role="img" aria-label="Imagen del robot: ${h.tipo} en ${h.plantaId}">
  <defs>
    <linearGradient id="fondo" x1="0" y1="0" x2="0.4" y2="1">
      <stop offset="0%" stop-color="#1d5134"/>
      <stop offset="60%" stop-color="#143a26"/>
      <stop offset="100%" stop-color="#0d2a1c"/>
    </linearGradient>
    <filter id="difuso" x="-40%" y="-40%" width="180%" height="180%">
      <feGaussianBlur stdDeviation="${(Math.min(bw, bh) * 0.035).toFixed(1)}"/>
    </filter>
    <filter id="lejos" x="-10%" y="-10%" width="120%" height="120%">
      <feGaussianBlur stdDeviation="9"/>
    </filter>
    <filter id="grano">
      <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" result="ruido"/>
      <feColorMatrix type="saturate" values="0"/>
      <feComponentTransfer><feFuncA type="linear" slope="0.07"/></feComponentTransfer>
    </filter>
    <radialGradient id="vineta" cx="50%" cy="46%" r="72%">
      <stop offset="60%" stop-color="#000000" stop-opacity="0"/>
      <stop offset="100%" stop-color="#000000" stop-opacity="0.5"/>
    </radialGradient>
  </defs>

  <rect width="${ancho}" height="${alto}" fill="url(#fondo)"/>

  <!-- Fondo desenfocado: da sensación de profundidad, como una macro real. -->
  <g filter="url(#lejos)" opacity="0.85">${hojas(rnd, ancho, alto)}</g>

  <!-- Primer plano enfocado. -->
  <g>${hojas(rnd, ancho, alto)}</g>
  <g>${frutos(rnd, ancho, alto)}</g>

  <!-- La lesión que detectó el robot. -->
  <g>${lesion(h.tipo, rnd, bx, by, bw, bh)}</g>

  <rect width="${ancho}" height="${alto}" filter="url(#grano)" opacity="0.5"/>
  <rect width="${ancho}" height="${alto}" fill="url(#vineta)"/>

  <!-- Caja de la detección. -->
  <rect x="${bx.toFixed(0)}" y="${by.toFixed(0)}" width="${bw.toFixed(0)}" height="${bh.toFixed(0)}" fill="none" stroke="#f2b84b" stroke-width="3" rx="10"/>
  <rect x="${bx.toFixed(0)}" y="${(by - 30).toFixed(0)}" width="${Math.max(132, h.tipo.length * 13 + 66).toFixed(0)}" height="26" rx="8" fill="#f2b84b"/>
  <text x="${(bx + 10).toFixed(0)}" y="${(by - 11).toFixed(0)}" font-family="Figtree, Arial, sans-serif" font-size="14" font-weight="600" fill="#2b1f05">${h.tipo} · ${Math.round(h.confianza * 100)} %</text>
</svg>`;
}
