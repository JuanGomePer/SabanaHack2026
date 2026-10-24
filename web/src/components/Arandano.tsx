/**
 * Un arándano del mapa. Cada uno representa una celda (≈2,5 plantas).
 *
 * El color sigue la escala de la propia fruta: verde cuando la planta está
 * sana y morado a medida que se compromete. La planta ya revisada en campo
 * pasa al azul de la mora madura, para distinguir lo verificado de lo que
 * todavía nadie ha mirado.
 */

import type { EstadoCelda } from '@vigia/shared/tipos';

const COLOR_POR_ESTADO: Record<EstadoCelda, string> = {
  ok: 'var(--color-status-ok-cell)',
  riesgo: 'var(--color-status-risk-cell)',
  alerta: 'var(--color-status-alert-cell)',
  en_revision: 'var(--color-status-review-cell)',
  confirmada: 'var(--color-status-confirmed-cell)',
  sin_dato: 'var(--color-status-nodata-cell)',
};

interface Props {
  estado: EstadoCelda;
  /** Tamaño en píxeles del arándano. */
  tamano?: number;
}

export function Arandano({ estado, tamano = 13 }: Props) {
  // La que está en revisión lleva un anillo: se ve que alguien ya la tomó.
  const enRevision = estado === 'en_revision';

  return (
    <svg
      width={tamano}
      height={tamano}
      viewBox="0 0 20 20"
      aria-hidden="true"
      focusable="false"
      style={{ display: 'block', overflow: 'visible' }}
    >
      {enRevision && (
        <circle
          cx="10"
          cy="10"
          r="9.4"
          fill="none"
          stroke="var(--color-status-review-ring)"
          strokeWidth="2.4"
          strokeDasharray="3 2.4"
        />
      )}
      <circle cx="10" cy="10" r={enRevision ? 7.4 : 9.2} fill={COLOR_POR_ESTADO[estado]} />
      {/* Brillo */}
      <circle cx="7.6" cy="12.4" r={enRevision ? 4.8 : 6} fill="#ffffff" opacity="0.18" />
      {/* Cáliz (la estrellita del arándano) */}
      <circle cx="10.2" cy="6.8" r={enRevision ? 1.8 : 2.3} fill="#000000" opacity="0.26" />
    </svg>
  );
}
