/**
 * Aprendizaje — el modelo predictivo de humedad y temperatura.
 *
 * Toma el histórico de las variables que ya mide el robot (humedad y
 * temperatura), le ajusta una regresión lineal y proyecta los próximos días
 * cruzándola con el clima normal de la Sabana de Bogotá. Lo que sale de ahí es
 * concreto: qué día conviene tener cuidado y qué camas debería revisar el
 * robot con más detalle ese día.
 *
 * Todo el cálculo está en el servidor (`server/src/services/prediccion.ts`),
 * que es también donde están escritas las dos salvedades que esta pantalla
 * repite: el histórico es reconstruido (el prototipo solo guarda la última
 * lectura de cada planta) y el clima de la Sabana son normales de referencia.
 */
import { useEffect, useState } from 'react';
import { CalendarClock, Droplets, MapPinned, TrendingUp } from 'lucide-react';
import type { PrediccionRespuesta } from '@vigia/shared/tipos';
import { api } from '../api/cliente';
import { Chip } from '../components/Chip';
import { TarjetaKpi } from '../components/TarjetaKpi';

const ANCHO = 760;
const ALTO = 240;
const MARGEN = { arriba: 16, derecha: 10, abajo: 30, izquierda: 40 };

/**
 * Histórico + proyección en un solo gráfico: línea continua para lo que ya
 * pasó, línea punteada y banda de confianza para lo que viene.
 */
function GraficoPrediccion({ datos }: { datos: PrediccionRespuesta }) {
  const { historico, prediccion, umbral, modelo } = datos;
  const serie = [
    ...historico.map((d) => ({ ...d, margen: 0, futuro: false })),
    ...prediccion.map((d) => ({ ...d, futuro: true })),
  ];
  if (serie.length < 2) return null;

  /** La zona húmeda arranca en su valor de hoy y sigue la misma proyección. */
  const zona = [modelo.zonaCaliente.humedad, ...prediccion.map((d) => d.humedadZona)];

  const valores = [
    ...serie.flatMap((p) => [p.humedad - p.margen, p.humedad + p.margen]),
    ...zona,
  ];
  const min = Math.min(...valores, umbral) - 2;
  const max = Math.max(...valores, umbral) + 2;

  const anchoUtil = ANCHO - MARGEN.izquierda - MARGEN.derecha;
  const altoUtil = ALTO - MARGEN.arriba - MARGEN.abajo;
  const x = (i: number) => MARGEN.izquierda + (i / (serie.length - 1)) * anchoUtil;
  const y = (v: number) => MARGEN.arriba + altoUtil - ((v - min) / (max - min || 1)) * altoUtil;

  const corte = historico.length - 1;
  const trazo = (desde: number, hasta: number) =>
    serie
      .slice(desde, hasta + 1)
      .map((p, i) => `${i === 0 ? 'M' : 'L'}${x(desde + i).toFixed(1)},${y(p.humedad).toFixed(1)}`)
      .join(' ');

  // Banda de confianza de la parte proyectada: arriba hacia la derecha y de
  // vuelta por abajo hacia la izquierda.
  const banda =
    serie
      .slice(corte)
      .map((p, i) => `${i === 0 ? 'M' : 'L'}${x(corte + i).toFixed(1)},${y(p.humedad + p.margen).toFixed(1)}`)
      .join(' ') +
    ' ' +
    serie
      .slice(corte)
      .reverse()
      .map((p, i) => `L${x(serie.length - 1 - i).toFixed(1)},${y(p.humedad - p.margen).toFixed(1)}`)
      .join(' ') +
    ' Z';

  const marcas = [0, Math.floor(corte / 2), corte, Math.floor((corte + serie.length - 1) / 2), serie.length - 1];

  return (
    <svg className="gr" viewBox={`0 0 ${ANCHO} ${ALTO}`} role="img" aria-label="Humedad: histórico y predicción">
      <defs>
        <linearGradient id="banda-prediccion" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="var(--color-status-risk)" stopOpacity="0.28" />
          <stop offset="100%" stopColor="var(--color-status-risk)" stopOpacity="0.06" />
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
              {valor.toFixed(0)} %
            </text>
          </g>
        );
      })}

      {/* Umbral de riesgo */}
      <line
        x1={MARGEN.izquierda}
        x2={ANCHO - MARGEN.derecha}
        y1={y(umbral)}
        y2={y(umbral)}
        stroke="var(--color-status-alert)"
        strokeWidth="1.5"
        strokeDasharray="6 4"
      />
      <text x={ANCHO - MARGEN.derecha} y={y(umbral) - 6} className="gr-umbral">
        umbral {umbral} %
      </text>

      {/* Dónde termina lo medido y empieza lo proyectado */}
      <line
        x1={x(corte)}
        x2={x(corte)}
        y1={MARGEN.arriba}
        y2={MARGEN.arriba + altoUtil}
        stroke="var(--color-text-muted)"
        strokeWidth="1"
        strokeDasharray="3 3"
      />
      <text x={x(corte) + 6} y={MARGEN.arriba + 10} className="gr-eje">
        hoy
      </text>

      <path d={banda} fill="url(#banda-prediccion)" />
      <path
        d={trazo(0, corte)}
        fill="none"
        stroke="var(--color-data-humidity)"
        strokeWidth="2.2"
        strokeLinejoin="round"
        strokeLinecap="round"
      />
      <path
        d={trazo(corte, serie.length - 1)}
        fill="none"
        stroke="var(--color-status-risk-fg)"
        strokeWidth="2.2"
        strokeDasharray="7 5"
        strokeLinejoin="round"
        strokeLinecap="round"
      />

      {/* La zona húmeda: la que de verdad decide si el día es de cuidado */}
      <path
        d={zona
          .map((v, i) => `${i === 0 ? 'M' : 'L'}${x(corte + i).toFixed(1)},${y(v).toFixed(1)}`)
          .join(' ')}
        fill="none"
        stroke="var(--color-status-alert)"
        strokeWidth="2.2"
        strokeDasharray="7 5"
        strokeLinejoin="round"
        strokeLinecap="round"
      />

      {/* Los días de cuidado quedan marcados con un punto */}
      {prediccion.map((p, i) =>
        p.cuidado ? (
          <circle
            key={p.dia}
            cx={x(corte + 1 + i)}
            cy={y(p.humedadZona)}
            r="4"
            fill="var(--color-status-alert)"
            stroke="var(--color-bg-surface)"
            strokeWidth="1.5"
          />
        ) : null,
      )}

      {marcas.map((i) => (
        <text
          key={i}
          x={x(i)}
          y={ALTO - 8}
          className="gr-eje"
          textAnchor={i === 0 ? 'start' : i === serie.length - 1 ? 'end' : 'middle'}
        >
          {serie[i].etiqueta}
        </text>
      ))}
    </svg>
  );
}

export function Aprendizaje() {
  const [datos, setDatos] = useState<PrediccionRespuesta>();
  const [error, setError] = useState<string>();

  useEffect(() => {
    void api
      .prediccion()
      .then(setDatos)
      .catch((fallo) => setError(fallo instanceof Error ? fallo.message : 'No se pudo calcular'));
  }, []);

  if (error) {
    return <p className="cargando">No se pudo calcular la predicción ({error}).</p>;
  }
  if (!datos) return <p className="cargando">Calculando la predicción…</p>;

  const { modelo, prediccion, diaCritico, camasPrioritarias, climaReferencia, umbral } = datos;
  const diasDeCuidado = prediccion.filter((d) => d.cuidado);
  const maxima = prediccion.reduce(
    (peor, d) => (d.humedadZona > peor.humedadZona ? d : peor),
    prediccion[0],
  );
  const zona = modelo.zonaCaliente;
  const camasZona = zona.camas.length === 1 ? `la cama ${zona.camas[0]}` : `las camas ${zona.camas.join(', ')}`;

  return (
    <section>
      <div className="kpis">
        <TarjetaKpi
          tono={modelo.pendiente > 0 ? 'riesgo' : 'ok'}
          etiqueta="Tendencia de la humedad"
          valor={`${modelo.pendiente > 0 ? '+' : ''}${modelo.pendiente.toString().replace('.', ',')} pt/día`}
          detalle={`Regresión lineal sobre ${modelo.dias} días · R² ${modelo.r2.toString().replace('.', ',')}`}
        />
        <TarjetaKpi
          tono={diaCritico ? 'alerta' : 'ok'}
          etiqueta="Próximo día de cuidado"
          valor={diaCritico ? diaCritico.etiqueta : 'Ninguno'}
          detalle={
            diaCritico
              ? `${Math.round(diaCritico.probabilidad * 100)} % de probabilidad de que la zona húmeda pase ${umbral} %`
              : `La zona húmeda no pasa ${umbral} % en los ${prediccion.length} días proyectados`
          }
        />
        <TarjetaKpi
          tono="neutro"
          etiqueta="Pico en la zona húmeda"
          valor={`${maxima.humedadZona.toString().replace('.', ',')} %`}
          detalle={`${maxima.etiqueta} · ± ${maxima.margen.toString().replace('.', ',')} puntos · hoy va en ${zona.humedad.toString().replace('.', ',')} %`}
        />
        <TarjetaKpi
          tono={diasDeCuidado.length > 0 ? 'riesgo' : 'ok'}
          etiqueta="Días de cuidado"
          valor={`${diasDeCuidado.length} de ${prediccion.length}`}
          detalle={`${climaReferencia.mes} en la Sabana: temporada de ${climaReferencia.temporada}`}
        />
      </div>

      <div className="tarjeta tarjeta-prediccion">
        <div className="fila-entre">
          <h2 className="tarjeta-titulo">
            <Droplets size={17} /> Humedad: lo que hubo y lo que viene
          </h2>
          <div className="fila" style={{ gap: 12 }}>
            <span className="gr-clave txt-etiqueta">
              <i style={{ background: 'var(--color-data-humidity)' }} /> Histórico
            </span>
            <span className="gr-clave txt-etiqueta">
              <i style={{ background: 'var(--color-status-risk-fg)' }} /> Predicción del bloque
            </span>
            <span className="gr-clave txt-etiqueta">
              <i style={{ background: 'var(--color-status-alert)' }} /> Zona húmeda
            </span>
          </div>
        </div>

        <GraficoPrediccion datos={datos} />

        <p className="secundario txt-pequeno" style={{ margin: '4px 0 0' }}>
          La línea azul es el promedio del bloque y la morada, la zona húmeda de hoy ({camasZona}
          {zona.camas.length > 0 ? `, ${zona.plantas} plantas a ${zona.humedad.toString().replace('.', ',')} %` : ''}),
          que es la que decide si el día es de cuidado: el promedio de 2.400 plantas casi nunca pasa el umbral,
          pero el hongo arranca donde ya está húmedo. La banda es el intervalo de confianza del ajuste
          (± {(1.96).toFixed(2).replace('.', ',')} errores típicos) y se ensancha con los días.
        </p>
      </div>

      <div className="analisis-grid">
        <div className="tarjeta">
          <h2 className="tarjeta-titulo">
            <TrendingUp size={17} /> De qué está hecha la predicción
          </h2>
          <ul className="prediccion-formula txt-pequeno">
            <li>
              <strong>Variables:</strong> humedad relativa y temperatura, las dos que ya miden los sensores del
              robot en cada ronda. Nada más — no hay variables inventadas.
            </li>
            <li>
              <strong>Ajuste:</strong> regresión lineal por mínimos cuadrados de la humedad contra el día.
              Pendiente {modelo.pendiente.toString().replace('.', ',')} puntos por día, humedad ajustada de{' '}
              {modelo.intercepto.toString().replace('.', ',')} % al inicio del histórico, R²{' '}
              {modelo.r2.toString().replace('.', ',')} y error típico de ±
              {modelo.error.toString().replace('.', ',')} puntos.
            </li>
            <li>
              <strong>Clima de la Sabana:</strong> la proyección mezcla esa tendencia con la normal del mes en el
              altiplano ({Math.round(modelo.pesoClima * 100)} % del peso). Este invernadero va{' '}
              {Math.abs(modelo.desviacionRegional).toString().replace('.', ',')} puntos{' '}
              {modelo.desviacionRegional >= 0 ? 'más húmedo' : 'más seco'} que la normal de la región, y esa
              desviación se mantiene al proyectar.
            </li>
            <li>
              <strong>Día de cuidado:</strong> el cambio diario se le aplica a la zona húmeda de hoy (
              {camasZona}, a {zona.humedad.toString().replace('.', ',')} %) y el día queda marcado cuando su
              probabilidad de pasar {umbral} % llega a la mitad, con la incertidumbre del propio ajuste.
            </li>
          </ul>
        </div>

        <div className="tarjeta">
          <h2 className="tarjeta-titulo">
            <MapPinned size={17} /> Qué hace el robot con esto
          </h2>

          {diaCritico ? (
            <>
              <div className="prediccion-aviso">
                <CalendarClock size={16} />
                <span className="txt-pequeno">
                  El <strong>{diaCritico.etiqueta}</strong> la zona húmeda llega a{' '}
                  <strong>{diaCritico.humedadZona.toString().replace('.', ',')} %</strong> (±
                  {diaCritico.margen.toString().replace('.', ',')}), por encima del umbral de {umbral} %, con el
                  bloque en {diaCritico.humedad.toString().replace('.', ',')} % de promedio. Ese día la ronda del
                  robot entra en modo de revisión detallada en las camas de abajo, en vez de pasar de largo.
                </span>
              </div>

              <ul className="prediccion-camas">
                {camasPrioritarias.map((cama) => (
                  <li key={cama.cama}>
                    <span className="txt-cuerpo-fuerte">Cama {cama.cama}</span>
                    <span className="apagado txt-etiqueta">
                      Nave {cama.nave} · tramo más húmedo {cama.humedad.toString().replace('.', ',')} %
                      {cama.plantasSobreUmbral > 0
                        ? ` · ${cama.plantasSobreUmbral} plantas ya sobre el umbral`
                        : ''}
                      {cama.hallazgos > 0 ? ` · ${cama.hallazgos} hallazgos en 30 días` : ''}
                    </span>
                    <Chip tono={cama.plantasSobreUmbral > 0 ? 'riesgo' : 'neutro'}>
                      {cama.plantasSobreUmbral > 0 ? 'Prioridad' : 'Vigilar'}
                    </Chip>
                  </li>
                ))}
              </ul>
            </>
          ) : (
            <p className="secundario txt-pequeno" style={{ margin: '8px 0 0' }}>
              La zona húmeda ({camasZona}) no pasa el umbral de {umbral} % en los {prediccion.length} días
              proyectados. El robot sigue su ronda normal; si la tendencia cambia, este aviso aparece solo.
            </p>
          )}
        </div>
      </div>

      <p className="nota-ejemplo txt-pequeno" style={{ marginTop: 16 }}>
        <span className="punto neutro" style={{ marginTop: 7 }} />
        <span>
          Dos salvedades, para que nadie lea esto como más de lo que es. El histórico está{' '}
          <strong>reconstruido</strong>: el prototipo guarda solo la última lectura de cada planta, así que la
          serie diaria se arma con el promedio actual y la curva anual de la Sabana — el día que las rondas
          guarden cada lectura, el mismo ajuste corre sobre datos medidos sin cambiar nada más. Y el clima de la
          Sabana son normales de referencia del altiplano (editables en <code>shared/src/config.ts</code>), no la
          serie de una estación real. Las camas prioritarias, en cambio, sí salen de datos de hoy: humedad por
          cama y hallazgos de los últimos 30 días.
        </span>
      </p>
    </section>
  );
}
