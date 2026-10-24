/**
 * Gráfico de humedad del detalle de planta: línea azul, relleno suave y la
 * línea punteada del umbral de riesgo.
 */

interface Props {
  serie: Array<{ hora: string; valor: number }>;
  umbral: number;
}

const ANCHO = 440;
const ALTO = 78;

export function GraficoHumedad({ serie, umbral }: Props) {
  if (serie.length < 2) return null;

  const valores = serie.map((p) => p.valor);
  const minimo = Math.min(...valores, umbral) - 3;
  const maximo = Math.max(...valores, umbral) + 3;
  const rango = maximo - minimo || 1;

  const x = (i: number) => (i / (serie.length - 1)) * ANCHO;
  const y = (valor: number) => ALTO - ((valor - minimo) / rango) * ALTO;

  const linea = serie.map((p, i) => `${i === 0 ? 'M' : 'L'}${x(i).toFixed(1)} ${y(p.valor).toFixed(1)}`).join(' ');
  const area = `${linea} L${ANCHO} ${ALTO} L0 ${ALTO} Z`;
  const yUmbral = y(umbral);
  const ultimo = serie[serie.length - 1];

  return (
    <div className="grafico">
      <div className="fila-entre">
        <span className="txt-pequeno-fuerte">Humedad · últimas {serie.length - 1} horas</span>
        <span className="txt-pequeno-fuerte" style={{ color: 'var(--color-status-risk-fg)' }}>
          Umbral de riesgo {umbral} %
        </span>
      </div>

      <svg
        viewBox={`0 0 ${ANCHO} ${ALTO}`}
        className="grafico-svg"
        role="img"
        aria-label={`Humedad de las últimas horas, ahora en ${ultimo.valor} por ciento`}
      >
        <path d={area} fill="var(--color-data-humidity-soft)" opacity="0.75" />
        <line
          x1="0"
          y1={yUmbral}
          x2={ANCHO}
          y2={yUmbral}
          stroke="var(--color-status-risk)"
          strokeWidth="1.5"
          strokeDasharray="6 5"
        />
        <path
          d={linea}
          fill="none"
          stroke="var(--color-data-humidity)"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <circle
          cx={ANCHO}
          cy={y(ultimo.valor)}
          r="4"
          fill="var(--color-data-humidity)"
          stroke="var(--color-bg-surface)"
          strokeWidth="2"
        />
      </svg>

      <div className="fila-entre apagado txt-pequeno">
        <span>hace {serie.length - 1} h</span>
        <span>hace {Math.round((serie.length - 1) / 2)} h</span>
        <span>ahora</span>
      </div>
    </div>
  );
}
