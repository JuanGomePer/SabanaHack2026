/**
 * Marca de vigIA: un ojo/mira, no un robot genérico — "vigIA" viene de
 * "vigilar". Hereda el color del texto (currentColor), así que se ve bien
 * tanto en blanco (botón flotante) como en el verde de marca (cabecera).
 */
export function IconoVigia({ size = 18 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="12" cy="12" r="7.2" stroke="currentColor" strokeWidth="1.6" opacity="0.55" />
      <circle cx="12" cy="12" r="3.1" fill="currentColor" />
      <path
        d="M12 2.3v2.6M12 19.1v2.6M2.3 12h2.6M19.1 12h2.6"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
    </svg>
  );
}
