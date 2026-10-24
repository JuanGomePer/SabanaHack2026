/** Botón · componente 3:63 del sistema de diseño. */

import type { ButtonHTMLAttributes, ReactNode } from 'react';

type Variante = 'primario' | 'secundario' | 'peligro' | 'fantasma';

interface Props extends ButtonHTMLAttributes<HTMLButtonElement> {
  variante?: Variante;
  bloque?: boolean;
  icono?: ReactNode;
  iconoDerecha?: ReactNode;
}

export function Boton({
  variante = 'primario',
  bloque = false,
  icono,
  iconoDerecha,
  children,
  className = '',
  ...resto
}: Props) {
  return (
    <button
      type="button"
      className={`boton ${variante} ${bloque ? 'bloque' : ''} ${className}`}
      {...resto}
    >
      {icono}
      {children}
      {iconoDerecha}
    </button>
  );
}
