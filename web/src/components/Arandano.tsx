/**
 * Un arándano del mapa. Cada uno representa una celda (≈2,5 plantas).
 * El color sale del estado; el brillo y el cáliz imitan la fruta del diseño.
 */

import type { EstadoCelda } from '@vigia/shared/tipos';

const COLOR_POR_ESTADO: Record<EstadoCelda, string> = {
  ok: 'var(--color-status-ok-cell)',
  riesgo: 'var(--color-status-risk-cell)',
  alerta: 'var(--color-status-alert)',
  sin_dato: 'var(--color-status-nodata-cell)',
};

interface Props {
  estado: EstadoCelda;
  /** Tamaño en píxeles del arándano. */
  tamano?: number;
}

export function Arandano({ estado, tamano = 13 }: Props) {
  return (
    <svg
      width={tamano}
      height={tamano}
      viewBox="0 0 20 20"
      aria-hidden="true"
      focusable="false"
      style={{ display: 'block' }}
    >
      <circle cx="10" cy="10" r="9.2" fill={COLOR_POR_ESTADO[estado]} />
      {/* Brillo */}
      <circle cx="7.6" cy="12.4" r="6" fill="#ffffff" opacity="0.18" />
      {/* Cáliz (la estrellita del arándano) */}
      <circle cx="10.2" cy="6.8" r="2.3" fill="#000000" opacity="0.26" />
    </svg>
  );
}
