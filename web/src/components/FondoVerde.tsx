/**
 * Fondo de las pantallas de acceso (09 y 10): degradado verde con rayos de luz
 * y una retícula de puntos, como en el diseño.
 */

export function FondoVerde({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`fondo-verde ${className}`}>
      <svg className="fondo-rayos" viewBox="0 0 800 600" preserveAspectRatio="none" aria-hidden="true">
        <defs>
          <radialGradient id="brillo" cx="50%" cy="34%" r="52%">
            <stop offset="0%" stopColor="#ffffff" stopOpacity="0.5" />
            <stop offset="55%" stopColor="#ffffff" stopOpacity="0.07" />
            <stop offset="100%" stopColor="#ffffff" stopOpacity="0" />
          </radialGradient>
        </defs>
        {Array.from({ length: 28 }, (_, i) => {
          const angulo = (i / 28) * Math.PI * 2;
          return (
            <line
              key={i}
              x1="400"
              y1="204"
              x2={400 + Math.cos(angulo) * 900}
              y2={204 + Math.sin(angulo) * 900}
              stroke="#ffffff"
              strokeOpacity="0.1"
              strokeWidth="1.4"
            />
          );
        })}
        <circle cx="400" cy="204" r="300" fill="url(#brillo)" />
        <circle cx="400" cy="204" r="18" fill="#ffffff" fillOpacity="0.45" />
      </svg>
      <div className="fondo-puntos" aria-hidden="true" />
      <div className="fondo-contenido">{children}</div>
    </div>
  );
}
