/**
 * Vista estéreo de las gafas (03b). Es una representación de lo que se
 * mandaría al visor: el campo con la planta marcada. No hay ninguna conexión
 * real con un visor.
 */

function Ojo({ etiquetado }: { etiquetado: boolean }) {
  return (
    <svg viewBox="0 0 200 150" className="gafas-ojo" aria-hidden="true">
      <defs>
        <linearGradient id={`campo-${etiquetado ? 'i' : 'd'}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#1f6b49" />
          <stop offset="100%" stopColor="#0f4a33" />
        </linearGradient>
      </defs>
      <rect width="200" height="150" fill={`url(#campo-${etiquetado ? 'i' : 'd'})`} />

      {/* Rayos de perspectiva hacia el horizonte */}
      {Array.from({ length: 9 }, (_, i) => (
        <line
          key={i}
          x1="100"
          y1="42"
          x2={-60 + i * 40}
          y2="170"
          stroke="#ffffff"
          strokeOpacity="0.16"
          strokeWidth="1.2"
        />
      ))}
      <circle cx="100" cy="42" r="26" fill="#ffffff" fillOpacity="0.16" />
      <circle cx="100" cy="42" r="9" fill="#ffffff" fillOpacity="0.55" />

      {/* Plantas del recorrido */}
      {[
        [48, 118],
        [76, 100],
        [124, 100],
        [152, 118],
        [66, 138],
        [134, 138],
        [100, 86],
      ].map(([cx, cy]) => (
        <circle key={`${cx}-${cy}`} cx={cx} cy={cy} r="5" fill="var(--color-status-ok-cell)" />
      ))}

      {/* La planta marcada */}
      <circle cx="150" cy="112" r="13" fill="none" stroke="var(--color-status-risk)" strokeWidth="3" />
      <circle cx="150" cy="112" r="7" fill="var(--color-status-alert)" />
    </svg>
  );
}

export function VistaGafas({ cama, planta }: { cama: number; planta: number }) {
  return (
    <div className="gafas-ojos">
      <span className="gafas-chip txt-etiqueta">
        Cama {cama} · planta {planta} marcada
      </span>
      <Ojo etiquetado />
      <Ojo etiquetado={false} />
    </div>
  );
}
