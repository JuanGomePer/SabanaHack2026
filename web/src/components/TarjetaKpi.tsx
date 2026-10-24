/** Tarjeta KPI · componente 3:145 del sistema de diseño. */

export type TonoKpi = 'neutro' | 'ok' | 'riesgo' | 'alerta';

interface Props {
  etiqueta: string;
  valor: string;
  detalle: string;
  tono?: TonoKpi;
}

export function TarjetaKpi({ etiqueta, valor, detalle, tono = 'neutro' }: Props) {
  return (
    <div className={`kpi ${tono}`}>
      <div className="etiqueta-kpi txt-pequeno-fuerte">
        <span className={`punto ${tono}`} />
        <span>{etiqueta}</span>
      </div>
      <p className="valor txt-numero-xl" style={{ margin: 0 }}>
        {valor}
      </p>
      <p className="detalle txt-pequeno" style={{ margin: 0 }}>
        {detalle}
      </p>
    </div>
  );
}
