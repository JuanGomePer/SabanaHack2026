/**
 * Ilustración del AgiBot X2 Ultra, de frente y de atrás.
 *
 * No existe en el repo ningún archivo CAD/GLB del robot real, así que esto es
 * un dibujo vectorial a mano. Sigue lo que se ve en las fotos y en la ficha
 * publicada por AgiBot: carcasa blanca por paneles, articulaciones en gris
 * oscuro (hombros, codos, cadera, rodillas, tobillos), casco con visor oscuro
 * de lado a lado y LiDAR 3D encima, mochila de cómputo atrás (doble RK3588 +
 * Orin NX) y —lo más reconocible del X2— los pies amarillos con suela negra.
 *
 * Proporciones: 1,31 m de alto, 0,46 m de ancho de hombros. En el viewBox de
 * 460 unidades, 1 unidad ≈ 2,85 mm del robot real.
 */
import { useId } from 'react';

const BLANCO = '#f2f4f5';
const BLANCO_SOMBRA = '#cfd5d8';
const PANEL = '#e4e8ea';
const GRIS = '#272b2f';
const GRIS_CLARO = '#595f64';
const AMARILLO = '#f0c020';
const AMARILLO_SOMBRA = '#c99a0d';
const SUELA = '#1a1c1e';
const LENTE = '#9fd8ff';
const CRISTAL = '#20394b';

/** Pierna completa: muslo, rodilla, espinilla, tobillo y el zapato amarillo. */
function Pierna({ x }: { x: number }) {
  return (
    <g>
      {/* Muslo */}
      <rect x={x} y="286" width="36" height="66" rx="15" fill={BLANCO} stroke={BLANCO_SOMBRA} />
      {/* Rodilla */}
      <circle cx={x + 18} cy="356" r="13" fill={GRIS} />
      <circle cx={x + 18} cy="356" r="5" fill={GRIS_CLARO} />
      {/* Espinilla */}
      <rect x={x + 2} y="362" width="32" height="62" rx="13" fill={BLANCO} stroke={BLANCO_SOMBRA} />
      {/* Tobillo */}
      <rect x={x + 7} y="420" width="22" height="12" rx="5" fill={GRIS} />
      {/*
        Zapato amarillo: es lo que hace reconocible al X2 de un vistazo.
        Empeine amarillo, suela negra y la punta algo más adelantada.
      */}
      <path
        d={`M${x - 3} 446 L${x - 3} 437 Q${x - 3} 430 ${x + 5} 430 L${x + 30} 430 Q${x + 39} 430 ${x + 41} 438 L${x + 42} 446 Z`}
        fill={AMARILLO}
        stroke={AMARILLO_SOMBRA}
      />
      <rect x={x - 4} y="445" width="47" height="7" rx="3" fill={SUELA} />
    </g>
  );
}

/** Brazo completo: hombro, húmero, codo, antebrazo y pinza. */
function Brazo({ x, hacia }: { x: number; hacia: 1 | -1 }) {
  return (
    <g>
      {/* Hombro */}
      <circle cx={x} cy="166" r="15" fill={GRIS} />
      <circle cx={x} cy="166" r="6" fill={GRIS_CLARO} />
      {/* Húmero */}
      <rect x={x - 12} y="172" width="24" height="64" rx="11" fill={BLANCO} stroke={BLANCO_SOMBRA} />
      {/* Codo */}
      <circle cx={x} cy="242" r="11" fill={GRIS} />
      {/* Antebrazo */}
      <rect x={x - 10} y="248" width="20" height="56" rx="9" fill={BLANCO} stroke={BLANCO_SOMBRA} />
      {/* Pinza de dos dedos */}
      <rect x={x - 9} y="304" width="18" height="16" rx="5" fill={GRIS} />
      <rect x={x + hacia * 3 - 3} y="318" width="6" height="9" rx="2" fill={GRIS_CLARO} />
      <rect x={x - hacia * 4 - 3} y="318" width="6" height="9" rx="2" fill={GRIS_CLARO} />
    </g>
  );
}

function Cuerpo({ atras }: { atras: boolean }) {
  return (
    <>
      {/* Sombra de contacto con el piso */}
      <ellipse cx="120" cy="453" rx="62" ry="7" fill={GRIS} opacity="0.12" />

      <Pierna x={76} />
      <Pierna x={128} />

      {/* Cadera / cintura (3 GDL) */}
      <rect x="82" y="258" width="76" height="34" rx="12" fill={GRIS} />
      <rect x="92" y="266" width="56" height="8" rx="4" fill={GRIS_CLARO} opacity="0.7" />

      {/* Torso */}
      <path
        d="M78 164 Q78 146 98 146 L142 146 Q162 146 162 164 L164 244 Q164 262 144 262 L96 262 Q76 262 76 244 Z"
        fill={BLANCO}
        stroke={BLANCO_SOMBRA}
      />

      {atras ? (
        <>
          {/* Mochila de cómputo (doble RK3588 + Orin NX), con la batería dentro. */}
          <rect x="88" y="156" width="64" height="98" rx="12" fill={GRIS} />
          <rect x="96" y="162" width="48" height="6" rx="3" fill={GRIS_CLARO} />
          {/* Rejilla de disipación */}
          {[0, 1, 2].map((i) => (
            <rect key={i} x="130" y={224 + i * 9} width="14" height="4" rx="2" fill={GRIS_CLARO} />
          ))}
        </>
      ) : (
        <>
          {/* Peto del pecho, un tono más oscuro que la carcasa */}
          <rect x="92" y="170" width="56" height="52" rx="12" fill={PANEL} />
          {/* Luz de estado, del mismo amarillo que los pies */}
          <rect x="108" y="230" width="24" height="7" rx="3.5" fill={AMARILLO} />
        </>
      )}

      <Brazo x={67} hacia={-1} />
      <Brazo x={173} hacia={1} />

      {/* Cuello (1 GDL) */}
      <rect x="110" y="130" width="20" height="20" rx="4" fill={GRIS} />

      {/* Casco */}
      <path
        d="M86 96 Q86 66 120 66 Q154 66 154 96 L154 124 Q154 134 142 134 L98 134 Q86 134 86 124 Z"
        fill={BLANCO}
        stroke={BLANCO_SOMBRA}
      />

      {atras ? (
        <>
          {/* Cámara trasera, centrada en la nuca */}
          <rect x="104" y="96" width="32" height="18" rx="9" fill={GRIS} />
          <circle cx="120" cy="105" r="5" fill={CRISTAL} />
          <circle cx="120" cy="105" r="2.2" fill={LENTE} />
        </>
      ) : (
        <>
          {/* Visor oscuro de lado a lado, con las dos RGB-D estéreo detrás */}
          <path
            d="M88 92 L152 92 Q154 92 154 96 L154 112 Q154 116 150 116 L90 116 Q86 116 86 112 L86 96 Q86 92 88 92 Z"
            fill={GRIS}
          />
          <circle cx="104" cy="104" r="5" fill={CRISTAL} />
          <circle cx="104" cy="104" r="2.2" fill={LENTE} />
          <circle cx="136" cy="104" r="5" fill={CRISTAL} />
          <circle cx="136" cy="104" r="2.2" fill={LENTE} />
        </>
      )}

      {/* Puck de LiDAR 3D, sobre el casco */}
      <ellipse cx="120" cy="66" rx="23" ry="9" fill={GRIS} />
      <ellipse cx="120" cy="62" rx="23" ry="9" fill={GRIS_CLARO} />
      <ellipse cx="120" cy="60" rx="15" ry="5" fill={GRIS} opacity="0.5" />
    </>
  );
}

export function RobotX2UltraFrente({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 240 460" className={className} role="img" aria-label="AgiBot X2 Ultra, de frente">
      <Cuerpo atras={false} />
    </svg>
  );
}

export function RobotX2UltraAtras({ bateria, className }: { bateria: number; className?: string }) {
  const id = useId();
  const pct = Math.max(0, Math.min(100, bateria));
  const alturaBarra = 64;
  const alturaLlena = (alturaBarra * pct) / 100;
  /** Base de la barra: el borde de abajo de la mochila. */
  const base = 240;
  const color = pct > 40 ? '#2f9e6a' : pct > 15 ? '#e39a1b' : '#cc3b33';

  return (
    <svg
      viewBox="0 0 240 460"
      className={className}
      role="img"
      aria-label={`AgiBot X2 Ultra, de atrás. Batería al ${Math.round(pct)} %`}
    >
      <defs>
        <clipPath id={`${id}-bateria`}>
          <rect x="100" y={base - alturaLlena} width="40" height={alturaLlena} rx="4" />
        </clipPath>
      </defs>

      <Cuerpo atras />

      {/* Indicador de batería, dentro de la mochila: ahí va la de ~500 Wh. */}
      <rect
        x="98"
        y={base - alturaBarra - 4}
        width="44"
        height={alturaBarra + 4}
        rx="6"
        fill="#15181a"
        stroke={GRIS_CLARO}
        strokeWidth="2"
      />
      <rect x="112" y={base - alturaBarra - 10} width="16" height="7" rx="2" fill={GRIS_CLARO} />
      <g clipPath={`url(#${id}-bateria)`}>
        <rect x="100" y={base - alturaBarra} width="40" height={alturaBarra} fill={color} />
      </g>
      <text
        x="120"
        y={base + 20}
        textAnchor="middle"
        fontSize="15"
        fontWeight="700"
        fill={GRIS}
        fontFamily="var(--font-titulo)"
      >
        {Math.round(pct)}%
      </text>
    </svg>
  );
}
