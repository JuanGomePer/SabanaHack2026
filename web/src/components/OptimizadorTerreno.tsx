/**
 * Optimizador de siembra (Configuración · Optimizar terreno): cuántas
 * hileras y matas caben en un terreno dado, y en qué sentido sembrarlas.
 * El cálculo vive en @vigia/shared/optimizacion — ver ahí por qué no usamos
 * ninguna librería de "bin packing" para esto.
 */
import { useMemo, useState } from 'react';
import { ArrowLeftRight, Grid3x3, Info, Rows3, Sprout } from 'lucide-react';
import {
  ESPACIOS_SIEMBRA,
  optimizarTerreno,
  type FormaTerreno,
  type SistemaSiembra,
} from '@vigia/shared/optimizacion';
import { Chip } from './Chip';
import { Segmentado } from './Segmentado';
import { numero } from '../utilidades/formato';

const FORMAS = ['Rectangular', 'Irregular'] as const;
const FORMA_A_VALOR: Record<(typeof FORMAS)[number], FormaTerreno> = {
  Rectangular: 'rectangular',
  Irregular: 'irregular',
};

const SISTEMAS = ['En suelo', 'En bolsas'] as const;
const SISTEMA_A_VALOR: Record<(typeof SISTEMAS)[number], SistemaSiembra> = {
  'En suelo': 'suelo',
  'En bolsas': 'bolsas',
};

export function OptimizadorTerreno() {
  const [ancho, setAncho] = useState(40);
  const [largo, setLargo] = useState(80);
  const [forma, setForma] = useState<(typeof FORMAS)[number]>('Rectangular');
  const [sistema, setSistema] = useState<(typeof SISTEMAS)[number]>('En suelo');
  const [avanzado, setAvanzado] = useState(false);
  const [entreHileras, setEntreHileras] = useState<number>();
  const [entrePlantas, setEntrePlantas] = useState<number>();
  const [margen, setMargen] = useState(2);

  const sistemaValor = SISTEMA_A_VALOR[sistema];
  const espaciosDefecto = ESPACIOS_SIEMBRA[sistemaValor];

  const resultado = useMemo(() => {
    if (ancho <= 0 || largo <= 0) return undefined;
    return optimizarTerreno({
      anchoM: ancho,
      largoM: largo,
      forma: FORMA_A_VALOR[forma],
      sistema: sistemaValor,
      entreHileras: avanzado ? entreHileras : undefined,
      entrePlantas: avanzado ? entrePlantas : undefined,
      margenM: margen,
    });
  }, [ancho, largo, forma, sistemaValor, avanzado, entreHileras, entrePlantas, margen]);

  return (
    <div className="tarjeta">
      <h2 className="tarjeta-titulo">
        <Grid3x3 size={18} /> Optimizar un terreno
      </h2>
      <p className="secundario txt-pequeno" style={{ margin: '4px 0 16px' }}>
        Dale el tamaño de un lote y te decimos cuántas hileras y matas de arándano caben, y en qué sentido
        sembrarlas para aprovecharlo mejor.
      </p>

      <div className="optimizador-grid">
        <div className="columna" style={{ gap: 14 }}>
          <div className="fila" style={{ gap: 12 }}>
            <label className="columna" style={{ gap: 6, flex: 1 }}>
              <span className="txt-pequeno-fuerte">Ancho (m)</span>
              <input
                type="number"
                className="campo-texto"
                min={1}
                value={ancho}
                onChange={(e) => setAncho(Math.max(0, Number(e.target.value)))}
              />
            </label>
            <label className="columna" style={{ gap: 6, flex: 1 }}>
              <span className="txt-pequeno-fuerte">Largo (m)</span>
              <input
                type="number"
                className="campo-texto"
                min={1}
                value={largo}
                onChange={(e) => setLargo(Math.max(0, Number(e.target.value)))}
              />
            </label>
          </div>

          <span className="apagado txt-etiqueta">
            {ancho > 0 && largo > 0 ? `${numero(Math.round((ancho * largo) / 100) / 100)} ha en total` : ' '}
          </span>

          <label className="columna" style={{ gap: 6 }}>
            <span className="txt-pequeno-fuerte">Forma del terreno</span>
            <Segmentado opciones={FORMAS} valor={forma} alCambiar={setForma} etiquetaAccesible="Forma del terreno" />
          </label>

          <label className="columna" style={{ gap: 6 }}>
            <span className="txt-pequeno-fuerte">Sistema de siembra</span>
            <Segmentado
              opciones={SISTEMAS}
              valor={sistema}
              alCambiar={setSistema}
              etiquetaAccesible="Sistema de siembra"
            />
          </label>

          <button type="button" className="boton-enlace enlace txt-pequeno-fuerte" onClick={() => setAvanzado((v) => !v)}>
            {avanzado ? 'Ocultar ajustes avanzados' : 'Ajustar espacios y margen'}
          </button>

          {avanzado && (
            <div className="fila" style={{ gap: 12, flexWrap: 'wrap' }}>
              <label className="columna" style={{ gap: 6, flex: 1, minWidth: 120 }}>
                <span className="txt-pequeno-fuerte">Entre hileras (m)</span>
                <input
                  type="number"
                  step="0.1"
                  className="campo-texto"
                  placeholder={String(espaciosDefecto.entreHileras)}
                  value={entreHileras ?? ''}
                  onChange={(e) => setEntreHileras(e.target.value === '' ? undefined : Number(e.target.value))}
                />
              </label>
              <label className="columna" style={{ gap: 6, flex: 1, minWidth: 120 }}>
                <span className="txt-pequeno-fuerte">Entre plantas (m)</span>
                <input
                  type="number"
                  step="0.1"
                  className="campo-texto"
                  placeholder={String(espaciosDefecto.entrePlantas)}
                  value={entrePlantas ?? ''}
                  onChange={(e) => setEntrePlantas(e.target.value === '' ? undefined : Number(e.target.value))}
                />
              </label>
              <label className="columna" style={{ gap: 6, flex: 1, minWidth: 120 }}>
                <span className="txt-pequeno-fuerte">Margen perimetral (m)</span>
                <input
                  type="number"
                  step="0.5"
                  className="campo-texto"
                  value={margen}
                  onChange={(e) => setMargen(Math.max(0, Number(e.target.value)))}
                />
              </label>
            </div>
          )}
        </div>

        <div className="optimizador-resultado">
          {!resultado ? (
            <p className="secundario txt-pequeno">Dale un ancho y un largo mayores a cero para calcular.</p>
          ) : (
            <>
              <div className="optimizador-total">
                <Sprout size={22} />
                <div className="columna">
                  <span className="txt-numero-xl">{numero(resultado.mejor.totalPlantas)}</span>
                  <span className="apagado txt-pequeno">matas caben en este terreno</span>
                </div>
              </div>

              <div className="optimizador-cifras">
                <div>
                  <span className="txt-cuerpo-fuerte">{resultado.mejor.hileras}</span>
                  <span className="apagado txt-etiqueta">hileras</span>
                </div>
                <div>
                  <span className="txt-cuerpo-fuerte">{resultado.mejor.plantasPorHilera}</span>
                  <span className="apagado txt-etiqueta">matas por hilera</span>
                </div>
                <div>
                  <span className="txt-cuerpo-fuerte">{resultado.mejor.largoHileraM} m</span>
                  <span className="apagado txt-etiqueta">largo de hilera</span>
                </div>
                <div>
                  <span className="txt-cuerpo-fuerte">{numero(resultado.densidadPorHectarea)}</span>
                  <span className="apagado txt-etiqueta">matas / ha</span>
                </div>
              </div>

              <div className="optimizador-orientacion">
                <Rows3 size={16} />
                <span className="txt-pequeno">
                  Mejor sembrar con{' '}
                  <strong>
                    {resultado.mejor.orientacion === 'hileras_a_lo_ancho' ? 'las hileras a lo ancho' : 'las hileras a lo largo'}
                  </strong>{' '}
                  del lote — así caben {numero(resultado.mejor.totalPlantas - resultado.alternativa.totalPlantas)} matas
                  más que sembrando en el otro sentido ({numero(resultado.alternativa.totalPlantas)}).
                </span>
              </div>

              <div className="optimizador-orientacion">
                <ArrowLeftRight size={16} />
                <span className="txt-pequeno">
                  Área útil: {numero(resultado.areaUtilM2)} m² de {numero(resultado.areaTotalM2)} m² totales (
                  {resultado.aprovechamientoPct}
                  %) — con {resultado.margenM} m de margen perimetral y{' '}
                  {resultado.entreHileras} m × {resultado.entrePlantas} m de espaciamiento.
                </span>
              </div>

              <div className="optimizador-nota">
                <Info size={14} />
                <span className="txt-etiqueta">
                  Cálculo geométrico (rejilla uniforme + margen + aprovechamiento por forma), no un modelo entrenado.
                  Los espacios por defecto salen de guías agronómicas para arándano en Colombia — ajústalos si tu
                  variedad o tu asesor recomiendan otros.
                </span>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
