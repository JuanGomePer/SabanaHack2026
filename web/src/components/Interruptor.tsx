/** Interruptor · componente 3:150 del sistema de diseño. */

interface Props {
  activo: boolean;
  alCambiar: (valor: boolean) => void;
  etiquetaAccesible: string;
}

export function Interruptor({ activo, alCambiar, etiquetaAccesible }: Props) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={activo}
      aria-label={etiquetaAccesible}
      className="interruptor"
      onClick={() => alCambiar(!activo)}
    />
  );
}
