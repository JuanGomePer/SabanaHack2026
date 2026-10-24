/**
 * Mapa de arándanos · componente 20:702 del sistema de diseño.
 * 8 naves × 3 camas × 40 celdas. Una celda = 2,5 plantas.
 *
 * El mapa se dibuja siempre con la fruta, nítida. Lo que cambia entre capas es
 * de dónde sale el color del arándano: del estado de la planta, o de la escala
 * continua de humedad o temperatura.
 *
 * Encima va una sonda de clima: una nube muy tenue que sigue al cursor y una
 * tarjeta con la lectura de la celda que tiene debajo, como el mapa del clima
 * del teléfono. No tapa el cultivo: deja ver la fruta a través.
 */

import { useRef, useState } from 'react';
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
  { valor: 55, color: [214, 234, 248] },
  { valor: 70, color: [142, 191, 229] },
  { valor: 80, color: [74, 140, 201] },
  { valor: 85, color: [43, 94, 168] },
  { valor: 92, color: [107, 63, 160] },
];

/** Temperatura: escala térmica de toda la vida, de frío a caliente. */
const ESCALA_TEMPERATURA: Parada[] = [
  { valor: 14, color: [181, 213, 238] },
  { valor: 18, color: [150, 205, 166] },
  { valor: 21, color: [242, 184, 75] },
  { valor: 24, color: [224, 100, 47] },
  { valor: 28, color: [178, 46, 32] },
];

function interpolar(valor: number, escala: Parada[]): [number, number, number] {
  const primera = escala[0];
  const ultima = escala[escala.length - 1];
  if (valor <= primera.valor) return primera.color;
  if (valor >= ultima.valor) return ultima.color;

  for (let i = 1; i < escala.length; i++) {
    const fin = escala[i];
    if (valor > fin.valor) continue;
    const ini = escala[i - 1];
    const t = (valor - ini.valor) / (fin.valor - ini.valor);
    return ini.color.map((c, j) => Math.round(c + (fin.color[j] - c) * t)) as [
      number,
      number,
      number,
    ];
  }
  return ultima.color;
}

function colorDeCelda(celda: Celda, capa: CapaMapa): string | undefined {
  if (capa === 'Estado' || celda.estado === 'sin_dato') return undefined;
  const rgb =
    capa === 'Humedad'
      ? interpolar(celda.humedad, ESCALA_HUMEDAD)
      : interpolar(celda.temperatura, ESCALA_TEMPERATURA);
  return `rgb(${rgb.join(',')})`;
}

const NOMBRE_ESTADO: Record<EstadoCelda, string> = {
  ok: 'sana',
  riesgo: 'en riesgo',
  alerta: 'en alerta',
  en_revision: 'en revisión',
  confirmada: 'afectada, confirmada',
  sin_dato: 'sin dato',
};

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
      <span
        className="leyenda-calor-barra"
        style={{ background: `linear-gradient(90deg, ${degradado})` }}
      />
      <span className="txt-etiqueta apagado">
        {escala[escala.length - 1].valor} {unidad}
      </span>
    </div>
  );
}

interface Sonda {
  x: number;
  y: number;
  celda: Celda;
}

export function MapaArandanos({ camas, naves, capa, plantaResaltada, alElegirCelda }: Props) {
  const contenedor = useRef<HTMLDivElement>(null);
  const [sonda, setSonda] = useState<Sonda | null>(null);

  function seguirCursor(evento: React.MouseEvent, celda: Celda) {
    const caja = contenedor.current?.getBoundingClientRect();
    if (!caja) return;
    setSonda({ x: evento.clientX - caja.left, y: evento.clientY - caja.top, celda });
  }

  // La nube toma el color de la humedad de la celda: azul si está cómoda,
  // morada cuando se acerca al umbral.
  const colorNube = sonda
    ? interpolar(sonda.celda.humedad, ESCALA_HUMEDAD)
    : ([120, 160, 200] as [number, number, number]);

  return (
    <div className="mapa" ref={contenedor} onMouseLeave={() => setSonda(null)}>
      {sonda && (
        <>
          <span
            className="mapa-nube"
            aria-hidden="true"
            style={{
              left: sonda.x,
              top: sonda.y,
              background: `radial-gradient(circle, rgba(${colorNube.join(',')},0.34) 0%, rgba(${colorNube.join(',')},0.16) 42%, rgba(${colorNube.join(',')},0) 70%)`,
            }}
          />
          <div
            className="sonda-clima"
            style={{ left: sonda.x, top: sonda.y }}
            role="status"
            aria-live="polite"
          >
            <span className="sonda-clima-sitio txt-etiqueta">
              Cama {sonda.celda.cama} · plantas {sonda.celda.plantas[0]}–
              {sonda.celda.plantas[sonda.celda.plantas.length - 1]}
            </span>
            {sonda.celda.estado === 'sin_dato' ? (
              <span className="sonda-clima-vacio txt-pequeno">Sin lectura todavía</span>
            ) : (
              <div className="sonda-clima-datos">
                <span className="sonda-clima-dato">
                  <b>{sonda.celda.humedad.toFixed(0)} %</b>
                  <small>humedad</small>
                </span>
                <span className="sonda-clima-dato">
                  <b>{sonda.celda.temperatura.toFixed(1).replace('.', ',')} °C</b>
                  <small>temperatura</small>
                </span>
              </div>
            )}
          </div>
        </>
      )}

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
                        onMouseMove={(e) => seguirCursor(e, celda)}
                        onFocus={() => setSonda(null)}
                      >
                        <Arandano estado={celda.estado} color={colorDeCelda(celda, capa)} />
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
