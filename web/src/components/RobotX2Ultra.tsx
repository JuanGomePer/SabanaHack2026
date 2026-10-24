/**
 * Ilustración del AgiBot X2 Ultra, de frente y de atrás.
 *
 * No existe en el repo ningún archivo CAD/GLB del robot real, así que esto es
 * una ilustración vectorial dibujada a mano — no una réplica exacta — pero
 * sigue las proporciones y la disposición de sensores reales publicadas por
 * AgiBot: 1,31 m de alto, 0,46 m de ancho de hombros, cabeza con LiDAR 3D +
 * cámaras RGB-D estéreo frontales + cámara trasera, y mochila de cómputo
 * (doble RK3588 + Orin NX) donde va la batería de ~500 Wh.
 */
import { useId } from 'react';

const BLANCO = '#eef1f3';
const BLANCO_SOMBRA = '#d7dcdf';
const GRIS = '#2b2f33';
const GRIS_CLARO = '#5b6165';

function Cuerpo({ atras }: { atras: boolean }) {
  return (
    <>
      {/* Piernas */}
      <rect x="78" y="300" width="34" height="140" rx="14" fill={BLANCO} stroke={BLANCO_SOMBRA} />
      <rect x="128" y="300" width="34" height="140" rx="14" fill={BLANCO} stroke={BLANCO_SOMBRA} />
      <rect x="74" y="430" width="42" height="20" rx="8" fill={GRIS} />
      <rect x="124" y="430" width="42" height="20" rx="8" fill={GRIS} />
      <circle cx="95" cy="300" r="12" fill={GRIS} />
      <circle cx="145" cy="300" r="12" fill={GRIS} />

      {/* Cadera / cintura (3 GDL) */}
      <rect x="86" y="268" width="68" height="36" rx="10" fill={GRIS} />

      {/* Torso */}
      <rect x="72" y="150" width="96" height="124" rx="22" fill={BLANCO} stroke={BLANCO_SOMBRA} />

      {atras ? (
        <>
          {/* Mochila de cómputo (doble RK3588 + Orin NX) con la batería embebida. */}
          <rect x="84" y="160" width="72" height="92" rx="12" fill={GRIS} />
        </>
      ) : (
        <>
          {/* Panel de pecho / indicador de estado */}
          <rect x="100" y="190" width="40" height="10" rx="5" fill={GRIS_CLARO} opacity="0.5" />
        </>
      )}

      {/* Brazos */}
      <rect x="40" y="160" width="26" height="98" rx="13" fill={BLANCO} stroke={BLANCO_SOMBRA} />
      <rect x="174" y="160" width="26" height="98" rx="13" fill={BLANCO} stroke={BLANCO_SOMBRA} />
      <circle cx="53" cy="160" r="14" fill={GRIS} />
      <circle cx="187" cy="160" r="14" fill={GRIS} />
      <rect x="42" y="250" width="22" height="20" rx="8" fill={GRIS} />
      <rect x="176" y="250" width="22" height="20" rx="8" fill={GRIS} />

      {/* Cuello */}
      <rect x="108" y="130" width="24" height="24" fill={GRIS} />

      {/* Cabeza */}
      <rect x="82" y="60" width="76" height="70" rx="18" fill={BLANCO} stroke={BLANCO_SOMBRA} />

      {atras ? (
        <>
          {/* Cámara trasera */}
          <circle cx="120" cy="95" r="6" fill="#274a63" />
          <circle cx="120" cy="95" r="2.4" fill="#9fd8ff" />
        </>
      ) : (
        <>
          {/* Visor de cámaras estéreo RGB-D frontales */}
          <rect x="94" y="88" width="52" height="14" rx="7" fill={GRIS} />
          <circle cx="106" cy="95" r="4.2" fill="#9fd8ff" />
          <circle cx="134" cy="95" r="4.2" fill="#9fd8ff" />
        </>
      )}

      {/* Puck de LiDAR 3D, sobre la cabeza */}
      <ellipse cx="120" cy="56" rx="24" ry="10" fill={GRIS} />
      <ellipse cx="120" cy="53" rx="24" ry="10" fill={GRIS_CLARO} />
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
  const alturaBarra = 70;
  const alturaLlena = (alturaBarra * pct) / 100;
  const color = pct > 40 ? '#2f9e6a' : pct > 15 ? '#e39a1b' : '#cc3b33';

  return (
    <svg viewBox="0 0 240 460" className={className} role="img" aria-label={`AgiBot X2 Ultra, de atrás. Batería al ${Math.round(pct)} %`}>
      <defs>
        <clipPath id={`${id}-bateria`}>
          <rect x="98" y={252 - alturaLlena} width="44" height={alturaLlena} rx="4" />
        </clipPath>
      </defs>
      <Cuerpo atras />
      {/* Indicador de batería, en la mochila — donde suele ir en estos robots. */}
      <rect x="96" y="180" width="48" height="74" rx="6" fill="#15181a" stroke={GRIS_CLARO} strokeWidth="2" />
      <rect x="112" y="174" width="16" height="8" rx="2" fill={GRIS_CLARO} />
      <rect x="98" y={252 - alturaBarra} width="44" height={alturaBarra} rx="4" fill="none" />
      <g clipPath={`url(#${id}-bateria)`}>
        <rect x="98" y={252 - alturaBarra} width="44" height={alturaBarra} fill={color} />
      </g>
      <text x="120" y="268" textAnchor="middle" fontSize="15" fontWeight="700" fill={BLANCO} fontFamily="var(--font-titulo)">
        {Math.round(pct)}%
      </text>
    </svg>
  );
}
