/**
 * Ilustración "a mano" de una rama de arándanos para el panel de acceso.
 * El aspecto de boceto sale de un filtro SVG (turbulencia + desplazamiento)
 * aplicado a trazos vectoriales normales — no hay ninguna imagen de por
 * medio, así que no depende de internet ni de un asset que pueda faltar.
 */
const VERDE = '#2b6b48';
const VERDE_CLARO = '#4f8f68';
const MORA = '#4a4a78';
const MORA_CLARA = '#6a6a9e';
const BLOOM = '#b9b9d8';

function Baya({ cx, cy, r, tono = MORA }: { cx: number; cy: number; r: number; tono?: string }) {
  return (
    <g>
      <circle cx={cx} cy={cy} r={r} fill={tono} />
      <circle cx={cx - r * 0.28} cy={cy - r * 0.32} r={r * 0.32} fill={BLOOM} opacity="0.55" />
      {/* La "corona" característica del arándano. */}
      <path
        d={`M${cx - r * 0.22} ${cy - r * 0.92} l${r * 0.1} -${r * 0.2} l${r * 0.1} ${r * 0.14} l${r * 0.1} -${r * 0.18} l${r * 0.1} ${r * 0.2}`}
        stroke={VERDE}
        strokeWidth={Math.max(1, r * 0.09)}
        fill="none"
        strokeLinecap="round"
      />
    </g>
  );
}

function Hoja({ x, y, rotacion, escala = 1 }: { x: number; y: number; rotacion: number; escala?: number }) {
  return (
    <g transform={`translate(${x} ${y}) rotate(${rotacion}) scale(${escala})`}>
      <path
        d="M0 0 C 14 -6, 30 -4, 40 0 C 30 4, 14 6, 0 0 Z"
        fill={VERDE_CLARO}
        opacity="0.9"
      />
      <path d="M1 0 L38 0" stroke={VERDE} strokeWidth="1.1" opacity="0.6" />
    </g>
  );
}

export function IlustracionArandanos({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 360 320" className={className} role="img" aria-label="Rama de arándanos" fill="none">
      <defs>
        <filter id="boceto-arandanos" x="-10%" y="-10%" width="120%" height="120%">
          <feTurbulence type="fractalNoise" baseFrequency="0.012 0.018" numOctaves="2" seed="7" result="ruido" />
          <feDisplacementMap in="SourceGraphic" in2="ruido" scale="5" xChannelSelector="R" yChannelSelector="G" />
        </filter>
      </defs>

      <g filter="url(#boceto-arandanos)" strokeLinecap="round">
        {/* Tallo principal. */}
        <path
          d="M40 300 C 90 260, 70 200, 120 170 C 170 140, 150 90, 200 55"
          stroke={VERDE}
          strokeWidth="3.5"
          fill="none"
        />
        <path d="M120 170 C 100 150, 90 120, 100 95" stroke={VERDE} strokeWidth="2.5" fill="none" />

        {/* Hojas a lo largo de la rama. */}
        <Hoja x={70} y={255} rotacion={-30} />
        <Hoja x={95} y={195} rotacion={200} escala={0.9} />
        <Hoja x={150} y={150} rotacion={-20} escala={1.05} />
        <Hoja x={100} y={120} rotacion={160} escala={0.8} />
        <Hoja x={185} y={80} rotacion={-10} escala={0.95} />
        <Hoja x={160} y={60} rotacion={210} escala={0.75} />

        {/* Racimo grande, abajo. */}
        <Baya cx={55} cy={288} r={17} tono={MORA} />
        <Baya cx={82} cy={300} r={14} tono={MORA_CLARA} />
        <Baya cx={48} cy={258} r={13} tono={MORA_CLARA} />
        <Baya cx={78} cy={270} r={16} tono={MORA} />
        <Baya cx={100} cy={255} r={11} tono={MORA_CLARA} />

        {/* Racimo medio. */}
        <Baya cx={132} cy={185} r={15} tono={MORA} />
        <Baya cx={110} cy={200} r={12} tono={MORA_CLARA} />
        <Baya cx={145} cy={205} r={13} tono={MORA} />

        {/* Racimo pequeño, arriba. */}
        <Baya cx={205} cy={85} r={12} tono={MORA_CLARA} />
        <Baya cx={222} cy={70} r={14} tono={MORA} />
        <Baya cx={200} cy={55} r={10} tono={MORA_CLARA} />
      </g>
    </svg>
  );
}
