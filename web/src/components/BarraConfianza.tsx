/** Barra de confianza del robot: roja cuando es alta, ámbar cuando es media. */

interface Props {
  /** 0–1 */
  valor: number;
}

export function BarraConfianza({ valor }: Props) {
  const porcentaje = Math.round(valor * 100);
  const alta = porcentaje >= 80;

  return (
    <span className="confianza">
      <span className="confianza-pista">
        <span
          className={`confianza-barra ${alta ? 'alta' : 'media'}`}
          style={{ width: `${porcentaje}%` }}
        />
      </span>
      <span className="txt-pequeno-fuerte">{porcentaje} %</span>
    </span>
  );
}
