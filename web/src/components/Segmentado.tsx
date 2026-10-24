/** Control segmentado: capas del mapa, selector Foto / Gafas Meta. */

interface Props<T extends string> {
  opciones: readonly T[];
  valor: T;
  alCambiar: (valor: T) => void;
  etiquetaAccesible: string;
}

export function Segmentado<T extends string>({
  opciones,
  valor,
  alCambiar,
  etiquetaAccesible,
}: Props<T>) {
  return (
    <div className="segmentado" role="tablist" aria-label={etiquetaAccesible}>
      {opciones.map((opcion) => (
        <button
          key={opcion}
          type="button"
          role="tab"
          aria-selected={opcion === valor}
          className={opcion === valor ? 'activo' : ''}
          onClick={() => alCambiar(opcion)}
        >
          {opcion}
        </button>
      ))}
    </div>
  );
}
