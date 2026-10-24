/** Chip de estado · componente 3:17 del sistema de diseño. */

export type TonoChip =
  | 'ok'
  | 'riesgo'
  | 'alerta'
  | 'revision'
  | 'confirmada'
  | 'neutro'
  | 'marca'
  | 'humedad'
  /** Avisos que no son del cultivo (equipos, advertencias de la app). */
  | 'aviso';

interface Props {
  tono?: TonoChip;
  children: React.ReactNode;
  /** El punto de color se puede ocultar en chips puramente textuales. */
  conPunto?: boolean;
}

export function Chip({ tono = 'ok', children, conPunto = true }: Props) {
  return (
    <span className={`chip ${tono}`}>
      {conPunto && <span className={`punto ${tono}`} />}
      {children}
    </span>
  );
}
