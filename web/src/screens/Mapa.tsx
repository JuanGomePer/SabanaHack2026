/** 01 · Mapa del cultivo (5:2). */

import { useState } from 'react';
import { Wind } from 'lucide-react';
import type { Alerta, Celda, MapaRespuesta, EstadoCelda } from '@vigia/shared/tipos';
import { ETIQUETA_CIENTIFICA_TIPO } from '@vigia/shared/config';
import { Boton } from '../components/Boton';
import { Chip } from '../components/Chip';
import { TarjetaKpi } from '../components/TarjetaKpi';
import { Segmentado } from '../components/Segmentado';
import { LeyendaCalor, MapaArandanos, type CapaMapa } from '../components/MapaArandanos';
import { Mapa3D } from '../components/Mapa3D';
import { etiquetaDesdeId, hora, haceCuanto, numero, porcentaje } from '../utilidades/formato';
import { urlDeApi } from '../api/cliente';

const CAPAS = ['Estado', 'Humedad', 'Temperatura'] as const;
const VISTAS_MAPA = ['2D', '3D'] as const;

const LEYENDA: Array<{ estado: EstadoCelda; texto: string }> = [
  { estado: 'ok', texto: 'Sana' },
  { estado: 'riesgo', texto: 'En riesgo' },
  { estado: 'alerta', texto: 'En alerta' },
  { estado: 'en_revision', texto: 'En revisión' },
  { estado: 'confirmada', texto: 'Afectada' },
  { estado: 'sin_dato', texto: 'Sin dato' },
];

interface Props {
  mapa: MapaRespuesta;
  alertas: Alerta[];
  plantaResaltada?: string;
  alAbrirPlanta: (plantaId: string) => void;
  alVerAlertas: () => void;
}

export function Mapa({ mapa, alertas, plantaResaltada, alAbrirPlanta, alVerAlertas }: Props) {
  const [capa, setCapa] = useState<CapaMapa>('Estado');
  const [vista, setVista] = useState<(typeof VISTAS_MAPA)[number]>('2D');
  const { resumen } = mapa;

  const pendientes = alertas.filter((a) => a.revision === 'pendiente');

  /**
   * El eje y el texto de la tarjeta salen del propio mapa, que ya viene con la
   * estructura guardada en Configuración: si cambian las plantas por cama o la
   * agrupación, esto cambia solo.
   */
  const celdas = mapa.camas[0]?.celdas ?? [];
  const plantasPorCama = celdas[celdas.length - 1]?.plantas.at(-1) ?? 0;
  const tamanos = celdas.map((celda) => celda.plantas.length);
  const porCelda = tamanos.length
    ? { min: Math.min(...tamanos), max: Math.max(...tamanos) }
    : { min: 1, max: 1 };
  const agrupacion =
    porCelda.min === porCelda.max
      ? porCelda.min === 1
        ? 'una planta'
        : `${porCelda.min} plantas`
      : `${porCelda.min}–${porCelda.max} plantas`;

  return (
    <>
      <section className="kpis">
        <TarjetaKpi
          tono="ok"
          etiqueta="Plantas sanas"
          valor={numero(resumen.sanas)}
          detalle={`${porcentaje(resumen.porcentajeSanas)} del bloque`}
        />
        <TarjetaKpi
          tono="riesgo"
          etiqueta="Plantas en riesgo"
          valor={numero(resumen.riesgo)}
          detalle="Humedad sobre 85 %"
        />
        <TarjetaKpi
          tono="alerta"
          etiqueta="Plantas en alerta"
          valor={numero(resumen.alerta)}
          detalle={`${resumen.porRevisar} por revisar`}
        />
        <TarjetaKpi
          etiqueta="Última ronda del robot"
          valor={hora(resumen.robot.ultimaRonda)}
          detalle={`${resumen.robot.nombre} · ${haceCuanto(resumen.robot.ultimaRonda)}`}
        />
      </section>

      <section className="mapa-y-panel">
        <div className="tarjeta tarjeta-mapa">
          <div className="fila-entre mapa-cabecera" style={{ alignItems: 'flex-start' }}>
            <div className="columna">
              <h2 className="tarjeta-titulo">
                {mapa.nombre} · {mapa.naves.length} naves · {mapa.camas.length} camas
              </h2>
              <p className="secundario txt-pequeno" style={{ margin: '2px 0 0' }}>
                Cada arándano agrupa {agrupacion} y entre cama y cama va el pasillo por
                donde camina el robot. El color muestra el estado: toca uno morado para abrir la
                planta.
              </p>
            </div>
            <div className="fila" style={{ gap: 10 }}>
              <Segmentado
                opciones={VISTAS_MAPA}
                valor={vista}
                alCambiar={setVista}
                etiquetaAccesible="2D o 3D"
              />
              {vista === '2D' && (
                <Segmentado
                  opciones={CAPAS}
                  valor={capa}
                  alCambiar={setCapa}
                  etiquetaAccesible="Capa del mapa"
                />
              )}
            </div>
          </div>

          {vista === '2D' ? (
            <>
              <div className="mapa-eje txt-etiqueta apagado">
                <span>Planta 1</span>
                <span>Planta {Math.round(plantasPorCama / 2)}</span>
                <span>Planta {plantasPorCama}</span>
              </div>

              <MapaArandanos
                camas={mapa.camas}
                naves={mapa.naves}
                capa={capa}
                plantaResaltada={plantaResaltada}
                alElegirCelda={(celda: Celda) => {
                  if (celda.plantaId) alAbrirPlanta(celda.plantaId);
                }}
              />

              {/* La leyenda sigue a la capa: estados o escala de color. */}
              {capa === 'Estado' ? (
                <div className="leyenda">
                  {LEYENDA.map(({ estado, texto }) => (
                    <span className="leyenda-item txt-pequeno" key={estado}>
                      <span className={`leyenda-color ${estado}`} />
                      {texto}
                    </span>
                  ))}
                </div>
              ) : (
                <LeyendaCalor capa={capa} />
              )}
            </>
          ) : (
            <Mapa3D mapa={mapa} alAbrirPlanta={alAbrirPlanta} />
          )}
        </div>

        <div className="panel-derecho">
          <div className="tarjeta">
            <div className="fila-entre">
              <h2 className="tarjeta-titulo">Por revisar</h2>
              <Chip tono="alerta">{pendientes.length} pendientes</Chip>
            </div>

            <div className="lista-alertas">
              {pendientes.slice(0, 3).map((alerta) => (
                <button
                  type="button"
                  key={alerta.id}
                  className="alerta-fila"
                  onClick={() => alAbrirPlanta(alerta.plantaId)}
                >
                  <img className="miniatura" src={urlDeApi(alerta.fotoUrl)} alt="" />
                  <span className="columna" style={{ minWidth: 0 }}>
                    <span className="txt-cuerpo-fuerte">
                      {ETIQUETA_CIENTIFICA_TIPO[alerta.tipo]} · {etiquetaDesdeId(alerta.plantaId)}
                    </span>
                    <span className="secundario txt-pequeno">
                      Nave {alerta.nave} · {alerta.humedad.toFixed(0)} % ·{' '}
                      {haceCuanto(alerta.detectadoEn)}
                    </span>
                  </span>
                </button>
              ))}
              {pendientes.length === 0 && (
                <p className="secundario txt-pequeno" style={{ margin: 0 }}>
                  No queda nada por revisar.
                </p>
              )}
            </div>

            <Boton variante="fantasma" onClick={alVerAlertas}>
              → Ver las {alertas.length} alertas
            </Boton>
          </div>

          <div className="tarjeta">
            <h2 className="tarjeta-titulo">Zonas más húmedas</h2>
            <div className="columna" style={{ gap: 12, marginTop: 12 }}>
              {mapa.zonasHumedas.map((zona) => (
                <div className="columna" style={{ gap: 6 }} key={`${zona.cama}-${zona.desde}`}>
                  <div className="fila-entre">
                    <span className="txt-cuerpo-fuerte">
                      Cama {zona.cama} · plantas {zona.desde}–{zona.hasta}
                    </span>
                    <span className="txt-pequeno-fuerte" style={{ color: 'var(--color-data-humidity-fg)' }}>
                      {zona.humedad.toFixed(0)} %
                    </span>
                  </div>
                  <div className="medidor">
                    <span style={{ width: `${zona.humedad}%` }} />
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="tarjeta tarjeta-sugerencia">
            <div className="fila" style={{ gap: 8 }}>
              <Wind size={20} strokeWidth={2} color="var(--color-brand-primary)" />
              <h2 className="tarjeta-titulo">Sugerencia</h2>
            </div>
            <p className="txt-cuerpo" style={{ margin: '10px 0 0' }}>
              {mapa.sugerencia.texto}
            </p>
            <p className="apagado txt-pequeno" style={{ margin: '10px 0 0' }}>
              {mapa.sugerencia.nota}
            </p>
          </div>
        </div>
      </section>
    </>
  );
}
