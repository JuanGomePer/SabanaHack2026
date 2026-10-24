/**
 * Análisis · cómo se ha movido el bloque.
 *
 * Tres preguntas, en este orden: cómo va el clima ahora, cómo ha ido en el
 * rango elegido, y dónde está cargando el problema (por nave y por tipo de
 * hallazgo). Los gráficos son SVG a mano: el proyecto no arrastra ninguna
 * librería de gráficas y no hace falta para cuatro curvas.
 */

import { useCallback, useEffect, useState } from 'react';
import { ArrowRight, Droplets, ShieldAlert, Thermometer, TrendingUp, TriangleAlert } from 'lucide-react';
import type { RangoSerie, SeriesRespuesta } from '@vigia/shared/tipos';
import { ESTRUCTURA, ETIQUETA_CIENTIFICA_TIPO, TOTAL_PLANTAS } from '@vigia/shared/config';
import { api } from '../api/cliente';
import { Chip } from '../components/Chip';
import { Segmentado } from '../components/Segmentado';
import { TarjetaKpi } from '../components/TarjetaKpi';
import { numero as numeroMil } from '../utilidades/formato';

const RANGOS = ['24 horas', '7 días', '30 días'] as const;
type EtiquetaRango = (typeof RANGOS)[number];

const A_RANGO: Record<EtiquetaRango, RangoSerie> = {
  '24 horas': '24h',
  '7 días': '7d',
  '30 días': '30d',
};

const ANCHO = 720;
const ALTO = 190;
const MARGEN = { arriba: 14, derecha: 8, abajo: 26, izquierda: 38 };

interface Serie {
  valores: number[];
  etiquetas: string[];
  color: string;
  /** Línea de referencia horizontal, si aplica. */
  umbral?: { valor: number; texto: string };
  unidad: string;
}

/** Gráfico de línea con área, rejilla y eje de tiempo. */
function GraficoLinea({ valores, etiquetas, color, umbral, unidad }: Serie) {
  if (valores.length === 0) return null;

  const minDato = Math.min(...valores, umbral?.valor ?? Infinity);
  const maxDato = Math.max(...valores, umbral?.valor ?? -Infinity);
  const margenY = Math.max(1, (maxDato - minDato) * 0.18);
  const min = minDato - margenY;
  const max = maxDato + margenY;

  const anchoUtil = ANCHO - MARGEN.izquierda - MARGEN.derecha;
  const altoUtil = ALTO - MARGEN.arriba - MARGEN.abajo;
  const x = (i: number) => MARGEN.izquierda + (i / (valores.length - 1 || 1)) * anchoUtil;
  const y = (v: number) => MARGEN.arriba + altoUtil - ((v - min) / (max - min || 1)) * altoUtil;

  const linea = valores.map((v, i) => `${i === 0 ? 'M' : 'L'}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(' ');
  const area = `${linea} L${x(valores.length - 1).toFixed(1)},${MARGEN.arriba + altoUtil} L${MARGEN.izquierda},${MARGEN.arriba + altoUtil} Z`;
  const id = `area-${color.replace(/[^a-z]/gi, '')}`;

  // Tres marcas en el eje de tiempo: principio, mitad y final.
  const marcas = [0, Math.floor((valores.length - 1) / 2), valores.length - 1];

  return (
    <svg className="gr" viewBox={`0 0 ${ANCHO} ${ALTO}`} role="img" aria-label="Serie en el tiempo">
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.26" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>

      {[0, 0.5, 1].map((p) => {
        const valor = max - p * (max - min);
        const py = MARGEN.arriba + p * altoUtil;
        return (
          <g key={p}>
            <line
              x1={MARGEN.izquierda}
              x2={ANCHO - MARGEN.derecha}
              y1={py}
              y2={py}
              stroke="var(--color-border-default)"
              strokeWidth="1"
            />
            <text x="0" y={py + 4} className="gr-eje">
              {valor.toFixed(0)}
              {unidad}
            </text>
          </g>
        );
      })}

      {umbral && (
        <>
          <line
            x1={MARGEN.izquierda}
            x2={ANCHO - MARGEN.derecha}
            y1={y(umbral.valor)}
            y2={y(umbral.valor)}
            stroke="var(--color-status-alert)"
            strokeWidth="1.5"
            strokeDasharray="6 4"
          />
          <text x={ANCHO - MARGEN.derecha} y={y(umbral.valor) - 6} className="gr-umbral">
            {umbral.texto}
          </text>
        </>
      )}

      <path d={area} fill={`url(#${id})`} />
      <path d={linea} fill="none" stroke={color} strokeWidth="2.2" strokeLinejoin="round" strokeLinecap="round" />

      {marcas.map((i) => (
        <text key={i} x={x(i)} y={ALTO - 6} className="gr-eje" textAnchor={i === 0 ? 'start' : i === valores.length - 1 ? 'end' : 'middle'}>
          {etiquetas[i]}
        </text>
      ))}
    </svg>
  );
}

/** "13, 14 y 15" — hasta 6 camas; de ahí en adelante, "y N más". */
function listaCorta(camas: number[], maximo = 6): string {
  if (camas.length === 0) return '—';
  if (camas.length <= maximo) {
    return camas.length === 1
      ? String(camas[0])
      : `${camas.slice(0, -1).join(', ')} y ${camas[camas.length - 1]}`;
  }
  return `${camas.slice(0, maximo).join(', ')} y ${camas.length - maximo} más`;
}

/** Barras apiladas por tipo de hallazgo. */
function GraficoHallazgos({ datos }: { datos: SeriesRespuesta['hallazgos'] }) {
  const maximo = Math.max(1, ...datos.map((d) => d.total));
  const tipos = [
    { clave: 'Botrytis' as const, color: 'var(--color-status-alert)' },
    { clave: 'Alternaria' as const, color: 'var(--color-status-review)' },
    { clave: 'Trips' as const, color: 'var(--color-status-risk-cell)' },
  ];

  return (
    <div className="gr-barras">
      {datos.map((dia) => (
        <div className="gr-barra" key={dia.dia} title={`${dia.etiqueta}: ${dia.total} hallazgos`}>
          <div className="gr-barra-pila">
            {tipos.map(({ clave, color }) =>
              dia[clave] > 0 ? (
                <span
                  key={clave}
                  style={{ height: `${(dia[clave] / maximo) * 100}%`, background: color }}
                />
              ) : null,
            )}
          </div>
          <span className="txt-etiqueta apagado">{dia.etiqueta}</span>
        </div>
      ))}
    </div>
  );
}

export function Analisis() {
  const [etiqueta, setEtiqueta] = useState<EtiquetaRango>('24 horas');
  const [datos, setDatos] = useState<SeriesRespuesta>();
  const [cargando, setCargando] = useState(true);

  const cargar = useCallback(async (rango: RangoSerie) => {
    setCargando(true);
    try {
      setDatos(await api.series(rango));
    } finally {
      setCargando(false);
    }
  }, []);

  useEffect(() => {
    void cargar(A_RANGO[etiqueta]);
  }, [etiqueta, cargar]);

  if (!datos) return <p className="cargando">{cargando ? 'Cargando el análisis…' : 'Sin datos.'}</p>;

  const { resumen, clima, porNave, hallazgos, propagacion } = datos;
  const humedadAlta = resumen.humedadMaxima >= resumen.umbralHumedad;

  // % de hallazgos reales sobre el total de plantas del bloque, día a día —
  // no es una proyección: es el conteo real de esos días dividido entre lo
  // que hay sembrado.
  const contaminacionDiaria = hallazgos.map((d) => (d.total / TOTAL_PLANTAS) * 100);
  const contaminacionHoy = contaminacionDiaria.length > 0 ? contaminacionDiaria[contaminacionDiaria.length - 1] : 0;

  return (
    <section>
      <div className="fila-entre" style={{ marginBottom: 18 }}>
        <Segmentado
          opciones={RANGOS}
          valor={etiqueta}
          alCambiar={setEtiqueta}
          etiquetaAccesible="Rango de tiempo"
        />
        <Chip tono={humedadAlta ? 'alerta' : 'ok'}>
          {resumen.horasSobreUmbral > 0
            ? `${resumen.horasSobreUmbral} h sobre el umbral`
            : 'Sin picos de humedad'}
        </Chip>
      </div>

      <div className="kpis">
        <TarjetaKpi
          tono="neutro"
          etiqueta="Humedad promedio"
          valor={`${resumen.humedadMedia.toFixed(1).replace('.', ',')} %`}
          detalle={`Máxima ${resumen.humedadMaxima.toFixed(0)} % · umbral ${resumen.umbralHumedad} %`}
        />
        <TarjetaKpi
          tono="neutro"
          etiqueta="Temperatura promedio"
          valor={`${resumen.temperaturaMedia.toFixed(1).replace('.', ',')} °C`}
          detalle={`Máxima ${resumen.temperaturaMaxima.toFixed(1).replace('.', ',')} °C`}
        />
        <TarjetaKpi
          tono="alerta"
          etiqueta="Hallazgos del periodo"
          valor={String(resumen.totalHallazgos)}
          detalle={`En ${hallazgos.length} día${hallazgos.length === 1 ? '' : 's'}`}
        />
        <TarjetaKpi
          tono={contaminacionHoy > 1 ? 'alerta' : contaminacionHoy > 0 ? 'riesgo' : 'ok'}
          etiqueta="Contaminación ahora"
          valor={`${contaminacionHoy.toFixed(1).replace('.', ',')} %`}
          detalle={`${numeroMil(hallazgos.at(-1)?.total ?? 0)} de ${numeroMil(TOTAL_PLANTAS)} plantas, el último día del periodo`}
        />
        <TarjetaKpi
          tono="riesgo"
          etiqueta="Camas en riesgo"
          valor={String(propagacion.camasHoy.length)}
          detalle={
            propagacion.camasHoy.length > 0
              ? `Camas ${listaCorta(propagacion.camasHoy)} · nave${propagacion.naves.length === 1 ? '' : 's'} ${propagacion.naves.join(', ')}`
              : `Ninguna cama sobre ${resumen.umbralHumedad} %`
          }
        />
      </div>

      <div className="analisis-grid">
        {/*
          Lo que de verdad importa de "hay una cama en riesgo": que mañana
          probablemente sean más. La cuenta es una regla de vecindad, no un
          modelo — y la tarjeta lo dice.
        */}
        <div className="tarjeta tarjeta-ancha">
          <div className="fila-entre">
            <h2 className="tarjeta-titulo">
              <TrendingUp size={17} /> Si no se atiende
            </h2>
            <Chip tono={propagacion.camasExpuestas.length > 0 ? 'riesgo' : 'ok'}>
              Proyección a {propagacion.horas} h
            </Chip>
          </div>

          {propagacion.camasHoy.length === 0 ? (
            <p className="secundario txt-pequeno" style={{ margin: '10px 0 0' }}>
              Ninguna cama pasa de {resumen.umbralHumedad} % de humedad: no hay nada que pueda
              propagarse ahora mismo.
            </p>
          ) : (
            <>
              <div className="propagacion">
                <div className="propagacion-paso">
                  <span className="propagacion-cifra">{propagacion.camasHoy.length}</span>
                  <span className="txt-pequeno-fuerte">camas en riesgo hoy</span>
                  <span className="apagado txt-etiqueta">Camas {listaCorta(propagacion.camasHoy)}</span>
                </div>
                <ArrowRight className="propagacion-flecha" size={22} />
                <div className="propagacion-paso expuesto">
                  <span className="propagacion-cifra">{propagacion.proyeccion}</span>
                  <span className="txt-pequeno-fuerte">camas en {propagacion.horas} h</span>
                  <span className="apagado txt-etiqueta">
                    {propagacion.camasExpuestas.length > 0
                      ? `Se suman las camas ${listaCorta(propagacion.camasExpuestas)}` +
                        (propagacion.navesExpuestas.some((n) => !propagacion.naves.includes(n))
                          ? `, nave${propagacion.navesExpuestas.length === 1 ? '' : 's'} ${propagacion.navesExpuestas.join(', ')}`
                          : '')
                      : 'No queda cama vecina limpia'}
                  </span>
                </div>
                <div className="propagacion-paso">
                  <span className="propagacion-cifra">{numeroMil(propagacion.plantasExpuestas)}</span>
                  <span className="txt-pequeno-fuerte">plantas expuestas</span>
                  <span className="apagado txt-etiqueta">
                    Las que hay en esas camas vecinas
                  </span>
                </div>
              </div>

              <p className="secundario txt-pequeno" style={{ margin: '12px 0 0' }}>
                Hoy hay {propagacion.camasHoy.length === 1 ? 'una cama' : `${propagacion.camasHoy.length} camas`} con
                humedad sobre {resumen.umbralHumedad} % en la{propagacion.naves.length === 1 ? '' : 's'} nave
                {propagacion.naves.length === 1 ? '' : 's'} {propagacion.naves.join(', ')}
                {propagacion.confirmados > 0
                  ? `, y ${propagacion.confirmados} hallazgo${propagacion.confirmados === 1 ? '' : 's'} ya confirmado${propagacion.confirmados === 1 ? '' : 's'} en campo`
                  : ''}
                . Si la humedad sigue igual, lo siguiente en caer son las camas pegadas a esas —
                las de al lado en la numeración, aunque alguna caiga ya en la nave siguiente: por
                ahí pasa el salpique de agua, el roce de follaje y el aire del pasillo.
              </p>

              <div className="aviso-ambar txt-pequeno">
                {propagacion.camasExpuestas.length > 0 ? (
                  <>
                    Baja la humedad de la nave{propagacion.naves.length === 1 ? '' : 's'}{' '}
                    {propagacion.naves.join(', ')} antes de la noche y revisa las camas{' '}
                    {listaCorta(propagacion.camasExpuestas)}
                    {propagacion.navesExpuestas.some((n) => !propagacion.naves.includes(n))
                      ? ` (nave${propagacion.navesExpuestas.length === 1 ? '' : 's'} ${propagacion.navesExpuestas.join(', ')})`
                      : ''}{' '}
                    en la próxima ronda, aunque todavía no tengan alerta.
                  </>
                ) : (
                  <>
                    Ya no queda cama vecina limpia: todas las camas de alrededor están en riesgo.
                    Baja la humedad de la nave{propagacion.naves.length === 1 ? '' : 's'}{' '}
                    {propagacion.naves.join(', ')} hoy mismo y revisa cama por cama en la próxima
                    ronda.
                  </>
                )}
              </div>
            </>
          )}
        </div>

        <div className="tarjeta">
          <div className="fila-entre">
            <h2 className="tarjeta-titulo">
              <Droplets size={17} /> Humedad del bloque
            </h2>
            <span className="apagado txt-pequeno">{etiqueta}</span>
          </div>
          <GraficoLinea
            valores={clima.map((p) => p.humedad)}
            etiquetas={clima.map((p) => p.etiqueta)}
            color="var(--color-data-humidity)"
            unidad=" %"
            umbral={{ valor: resumen.umbralHumedad, texto: `umbral ${resumen.umbralHumedad} %` }}
          />
        </div>

        <div className="tarjeta">
          <div className="fila-entre">
            <h2 className="tarjeta-titulo">
              <Thermometer size={17} /> Temperatura del bloque
            </h2>
            <span className="apagado txt-pequeno">{etiqueta}</span>
          </div>
          <GraficoLinea
            valores={clima.map((p) => p.temperatura)}
            etiquetas={clima.map((p) => p.etiqueta)}
            color="var(--color-data-heat)"
            unidad=" °C"
          />
        </div>

        <div className="tarjeta">
          <div className="fila-entre">
            <h2 className="tarjeta-titulo">
              <TriangleAlert size={17} /> Hallazgos por día
            </h2>
            <div className="fila" style={{ gap: 12 }}>
              <span className="gr-clave txt-etiqueta">
                <i style={{ background: 'var(--color-status-alert)' }} /> {ETIQUETA_CIENTIFICA_TIPO.Botrytis}
              </span>
              <span className="gr-clave txt-etiqueta">
                <i style={{ background: 'var(--color-status-review)' }} /> {ETIQUETA_CIENTIFICA_TIPO.Alternaria}
              </span>
              <span className="gr-clave txt-etiqueta">
                <i style={{ background: 'var(--color-status-risk-cell)' }} /> {ETIQUETA_CIENTIFICA_TIPO.Trips}
              </span>
            </div>
          </div>
          <GraficoHallazgos datos={hallazgos} />
        </div>

        <div className="tarjeta">
          <div className="fila-entre">
            <h2 className="tarjeta-titulo">
              <ShieldAlert size={17} /> Contaminación en el tiempo
            </h2>
            <span className="apagado txt-pequeno">{etiqueta}</span>
          </div>
          <p className="secundario txt-pequeno" style={{ margin: '2px 0 12px' }}>
            % de las {numeroMil(TOTAL_PLANTAS)} plantas del bloque con un hallazgo activo ese día —
            {' '}
            <strong>{contaminacionHoy.toFixed(1).replace('.', ',')} %</strong> ahora mismo.
          </p>
          <GraficoLinea
            valores={contaminacionDiaria}
            etiquetas={hallazgos.map((d) => d.etiqueta)}
            color="var(--color-status-alert)"
            unidad=" %"
          />
        </div>

        <div className="tarjeta">
          <h2 className="tarjeta-titulo">Cómo va cada nave</h2>
          <table className="tabla tabla-naves">
            <thead>
              <tr>
                <th>Nave</th>
                <th>Humedad</th>
                <th>Temperatura</th>
                <th>Camas en riesgo</th>
              </tr>
            </thead>
            <tbody>
              {porNave.map((nave) => (
                <tr key={nave.nave}>
                  <td className="txt-cuerpo-fuerte">Nave {nave.nave}</td>
                  <td>
                    <div className="barra-nave">
                      <span
                        style={{
                          width: `${Math.min(100, (nave.humedad / 100) * 100)}%`,
                          background:
                            nave.humedad >= resumen.umbralHumedad
                              ? 'var(--color-status-alert)'
                              : 'var(--color-data-humidity)',
                        }}
                      />
                    </div>
                    <span className="txt-pequeno">{nave.humedad.toFixed(0)} %</span>
                  </td>
                  <td className="txt-pequeno">
                    {nave.temperatura.toFixed(1).replace('.', ',')} °C
                  </td>
                  <td>
                    {nave.camasEnRiesgo > 0 ? (
                      <div className="columna" style={{ gap: 4, alignItems: 'flex-start' }}>
                        <Chip tono="riesgo">
                          {nave.camasEnRiesgo} de {ESTRUCTURA.camasPorNave}
                        </Chip>
                        <span className="apagado txt-etiqueta">
                          Camas {listaCorta(nave.camasEnRiesgoLista)}
                        </span>
                      </div>
                    ) : (
                      <span className="apagado txt-pequeno">—</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <p className="apagado txt-pequeno" style={{ marginTop: 16 }}>
        Los hallazgos y el clima por nave salen de las lecturas guardadas. La curva del clima en el
        tiempo se reconstruye a partir del promedio actual y del ciclo diario del invernadero: cada
        planta guarda solo su última lectura.
      </p>
    </section>
  );
}
