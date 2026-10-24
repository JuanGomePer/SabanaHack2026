/**
 * Mapa de arándanos · componente 20:702 del sistema de diseño.
 * 8 naves × 3 camas × 40 celdas. Una celda = 2,5 plantas.
 *
 * Tiene dos formas de dibujarse:
 *
 * - **Estado**: un arándano por celda, con el color del estado de la planta.
 * - **Humedad / Temperatura**: un campo de calor continuo. En vez de pintar
 *   cada celda por separado, se dibuja la rejilla de colores y se difumina,
 *   que es como se leen los mapas de clima: manchas y gradientes, no cuadros.
 *   Los botones de cada celda siguen encima, invisibles, para poder abrir la
 *   planta igual que en la capa de estado.
 */

import type { Cama, Celda, EstadoCelda, Nave } from '@vigia/shared/tipos';
import { Arandano } from './Arandano';

export type CapaMapa = 'Estado' | 'Humedad' | 'Temperatura';

interface Props {
  camas: Cama[];
  naves: Nave[];
  capa: CapaMapa;
  /** Celda resaltada, por ejemplo la de la alerta recién llegada. */
  plantaResaltada?: string;
  alElegirCelda: (celda: Celda) => void;
}

// ── Escalas de color de las capas de clima ──────────────────────────────────

interface Parada {
  valor: number;
  color: [number, number, number];
}

/**
 * Humedad: del azul claro al azul profundo y, pasado el umbral de riesgo, al
 * morado del arándano — el mismo color con el que se marca la planta en
 * riesgo, para que las dos capas cuenten la misma historia.
 */
const ESCALA_HUMEDAD: Parada[] = [
  { valor: 55, color: [232, 243, 251] },
  { valor: 70, color: [168, 206, 235] },
  { valor: 80, color: [90, 150, 205] },
  { valor: 85, color: [43, 94, 168] },
  { valor: 92, color: [107, 63, 160] },
];

/** Temperatura: escala térmica de toda la vida, de frío a caliente. */
const ESCALA_TEMPERATURA: Parada[] = [
  { valor: 14, color: [196, 222, 241] },
  { valor: 18, color: [168, 213, 181] },
  { valor: 21, color: [242, 184, 75] },
  { valor: 24, color: [224, 100, 47] },
  { valor: 28, color: [178, 46, 32] },
];

function interpolar(valor: number, escala: Parada[]): string {
  const primera = escala[0];
  const ultima = escala[escala.length - 1];
  if (valor <= primera.valor) return `rgb(${primera.color.join(',')})`;
  if (valor >= ultima.valor) return `rgb(${ultima.color.join(',')})`;

  for (let i = 1; i < escala.length; i++) {
    const fin = escala[i];
    if (valor > fin.valor) continue;
    const ini = escala[i - 1];
    const t = (valor - ini.valor) / (fin.valor - ini.valor);
    const mezcla = ini.color.map((c, j) => Math.round(c + (fin.color[j] - c) * t));
    return `rgb(${mezcla.join(',')})`;
  }
  return `rgb(${ultima.color.join(',')})`;
}

function colorDeCalor(celda: Celda, capa: CapaMapa): string {
  if (celda.estado === 'sin_dato') return 'var(--color-status-nodata-cell)';
  return capa === 'Humedad'
    ? interpolar(celda.humedad, ESCALA_HUMEDAD)
    : interpolar(celda.temperatura, ESCALA_TEMPERATURA);
}

function titulo(celda: Celda, capa: CapaMapa): string {
  const rango = `plantas ${celda.plantas[0]}–${celda.plantas[celda.plantas.length - 1]}`;
  const medida =
    capa === 'Temperatura'
      ? `${celda.temperatura.toFixed(1)} °C`
      : capa === 'Humedad'
        ? `${celda.humedad.toFixed(0)} % de humedad`
        : NOMBRE_ESTADO[celda.estado];
  return `Cama ${celda.cama} · ${rango} · ${medida}`;
}

const NOMBRE_ESTADO: Record<EstadoCelda, string> = {
  ok: 'sana',
  riesgo: 'en riesgo',
  alerta: 'en alerta',
  en_revision: 'en revisión',
  confirmada: 'afectada, confirmada',
  sin_dato: 'sin dato',
};

/** Barra de color de la capa, con sus extremos. */
export function LeyendaCalor({ capa }: { capa: CapaMapa }) {
  if (capa === 'Estado') return null;

  const escala = capa === 'Humedad' ? ESCALA_HUMEDAD : ESCALA_TEMPERATURA;
  const degradado = escala
    .map((parada) => {
      const porcentaje =
        ((parada.valor - escala[0].valor) / (escala[escala.length - 1].valor - escala[0].valor)) *
        100;
      return `rgb(${parada.color.join(',')}) ${porcentaje.toFixed(0)}%`;
    })
    .join(', ');

  const unidad = capa === 'Humedad' ? '%' : '°C';

  return (
    <div className="leyenda-calor">
      <span className="txt-etiqueta apagado">
        {escala[0].valor} {unidad}
      </span>
      <span className="leyenda-calor-barra" style={{ background: `linear-gradient(90deg, ${degradado})` }} />
      <span className="txt-etiqueta apagado">
        {escala[escala.length - 1].valor} {unidad}
      </span>
    </div>
  );
}

export function MapaArandanos({ camas, naves, capa, plantaResaltada, alElegirCelda }: Props) {
  const esCalor = capa !== 'Estado';

  return (
    <div className={`mapa ${esCalor ? 'mapa--calor' : ''}`}>
      {naves.map((nave) => {
        const camasDeLaNave = nave.camas
          .map((numero) => camas.find((c) => c.numero === numero))
          .filter((c): c is Cama => Boolean(c));

        return (
          <div className="mapa-nave" key={nave.numero}>
            <span className="mapa-nave-etiqueta txt-pequeno secundario">Nave {nave.numero}</span>

            <div className="mapa-numeros txt-etiqueta apagado">
              {nave.camas.map((numero) => (
                <span key={numero}>{numero}</span>
              ))}
            </div>

            <div className="mapa-panel">
              {/* Campo de calor: se difumina para que se lea como un mapa de clima. */}
              {esCalor && (
                <div className="mapa-calor" aria-hidden="true">
                  {camasDeLaNave.map((cama) => (
                    <div className="mapa-calor-fila" key={cama.numero}>
                      {cama.celdas.map((celda) => (
                        <span
                          className="mapa-calor-celda"
                          key={celda.indice}
                          style={{ background: colorDeCalor(celda, capa) }}
                        />
                      ))}
                    </div>
                  ))}
                </div>
              )}

              {camasDeLaNave.map((cama) => (
                <div className="mapa-cama" key={cama.numero}>
                  {cama.celdas.map((celda) => {
                    const resaltada =
                      plantaResaltada !== undefined && celda.plantaId === plantaResaltada;
                    return (
                      <button
                        type="button"
                        key={celda.indice}
                        className={`mapa-celda ${celda.estado} ${resaltada ? 'resaltada' : ''}`}
                        title={titulo(celda, capa)}
                        aria-label={titulo(celda, capa)}
                        onClick={() => alElegirCelda(celda)}
                      >
                        {!esCalor && <Arandano estado={celda.estado} />}
                      </button>
                    );
                  })}
                </div>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}
