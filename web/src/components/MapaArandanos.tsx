/**
 * Mapa de arándanos · componente 20:702 del sistema de diseño.
 * 8 naves × 3 camas × 40 celdas. Una celda = 2,5 plantas.
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

/** En las capas de humedad y temperatura el color sale del valor, no del estado. */
function estadoSegunCapa(celda: Celda, capa: CapaMapa): EstadoCelda {
  if (capa === 'Estado') return celda.estado;
  if (celda.estado === 'sin_dato') return 'sin_dato';

  if (capa === 'Humedad') {
    if (celda.humedad >= 88) return 'alerta';
    if (celda.humedad >= 85) return 'riesgo';
    return 'ok';
  }
  if (celda.temperatura >= 22) return 'alerta';
  if (celda.temperatura >= 20.5) return 'riesgo';
  return 'ok';
}

function titulo(celda: Celda, capa: CapaMapa): string {
  const rango = `plantas ${celda.plantas[0]}–${celda.plantas[celda.plantas.length - 1]}`;
  const medida =
    capa === 'Temperatura'
      ? `${celda.temperatura.toFixed(1)} °C`
      : `${celda.humedad.toFixed(0)} % de humedad`;
  return `Cama ${celda.cama} · ${rango} · ${medida}`;
}

export function MapaArandanos({
  camas,
  naves,
  capa,
  plantaResaltada,
  alElegirCelda,
}: Props) {
  return (
    <div className="mapa">
      {naves.map((nave) => (
        <div className="mapa-nave" key={nave.numero}>
          <span className="mapa-nave-etiqueta txt-pequeno secundario">Nave {nave.numero}</span>

          <div className="mapa-numeros txt-etiqueta apagado">
            {nave.camas.map((numero) => (
              <span key={numero}>{numero}</span>
            ))}
          </div>

          <div className="mapa-panel">
            {nave.camas.map((numero) => {
              const cama = camas.find((c) => c.numero === numero);
              if (!cama) return null;
              return (
                <div className="mapa-cama" key={numero}>
                  {cama.celdas.map((celda) => {
                    const estado = estadoSegunCapa(celda, capa);
                    const resaltada =
                      plantaResaltada !== undefined && celda.plantaId === plantaResaltada;
                    return (
                      <button
                        type="button"
                        key={celda.indice}
                        className={`mapa-celda ${estado} ${resaltada ? 'resaltada' : ''}`}
                        title={titulo(celda, capa)}
                        aria-label={titulo(celda, capa)}
                        onClick={() => alElegirCelda(celda)}
                      >
                        <Arandano estado={estado} />
                      </button>
                    );
                  })}
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
