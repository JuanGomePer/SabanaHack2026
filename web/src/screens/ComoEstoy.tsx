/**
 * Cómo estoy — estado real del robot: batería, autonomía y cuánto alcanza a
 * recorrer con la carga que tiene ahora mismo.
 *
 * Los metros totales de cama salen de la estructura real configurada
 * (`ESTRUCTURA`, @vigia/shared/config) — no son un número inventado. La
 * velocidad de recorrido (0,8 m/s) es la velocidad típica publicada por
 * AgiBot para el X2 Ultra; las 6 h de autonomía con carga completa son el
 * supuesto que dio el equipo — todo esto se puede ajustar en
 * `shared/src/config.ts` si cambian los datos reales.
 */
import { BatteryCharging, Clock, Gauge, MapPinned, Route } from 'lucide-react';
import { ESTRUCTURA, TOTAL_CAMAS } from '@vigia/shared/config';
import type { MapaRespuesta } from '@vigia/shared/tipos';
import { RobotX2UltraAtras, RobotX2UltraFrente } from '../components/RobotX2Ultra';
import { TarjetaKpi } from '../components/TarjetaKpi';
import { haceCuanto } from '../utilidades/formato';

/** Velocidad típica de recorrido publicada por AgiBot para el X2 Ultra (máx. 1,8 m/s; típica ≤ 0,8 m/s). */
const VELOCIDAD_TIPICA_MS = 0.8;

/** Supuesto del equipo: con carga completa, el robot alcanza ~6 h de recolección. */
const HORAS_AUTONOMIA_CARGA_COMPLETA = 6;

interface Props {
  mapa: MapaRespuesta;
}

export function ComoEstoy({ mapa }: Props) {
  const robot = mapa.resumen.robot;
  const bateria = robot.bateria;

  // Metros de cama que hay hoy en el bloque: cada nave mide ESTRUCTURA.largoNave
  // metros, y cada una de sus camas corre a todo lo largo de la nave.
  const metrosPorCama = ESTRUCTURA.largoNave;
  const metrosTotalesHoy = TOTAL_CAMAS * metrosPorCama;

  const segundosCargaCompleta = HORAS_AUTONOMIA_CARGA_COMPLETA * 3600;
  const metrosPorCargaCompleta = VELOCIDAD_TIPICA_MS * segundosCargaCompleta;
  const rondasPorCargaCompleta = metrosPorCargaCompleta / metrosTotalesHoy;

  const fraccionBateria = bateria / 100;
  const metrosRestantes = metrosPorCargaCompleta * fraccionBateria;
  const horasRestantes = HORAS_AUTONOMIA_CARGA_COMPLETA * fraccionBateria;
  const rondasRestantes = metrosRestantes / metrosTotalesHoy;

  const horas = Math.floor(horasRestantes);
  const minutos = Math.round((horasRestantes - horas) * 60);

  return (
    <section>
      <div className="como-estoy-grid">
        <div className="tarjeta como-estoy-robot">
          <div className="como-estoy-ilustracion">
            <div className="columna" style={{ alignItems: 'center', gap: 6 }}>
              <RobotX2UltraFrente className="como-estoy-svg" />
              <span className="apagado txt-etiqueta">De frente</span>
            </div>
            <div className="columna" style={{ alignItems: 'center', gap: 6 }}>
              <RobotX2UltraAtras bateria={bateria} className="como-estoy-svg" />
              <span className="apagado txt-etiqueta">De atrás — batería</span>
            </div>
          </div>
          <p className="secundario txt-pequeno" style={{ margin: '12px 0 0' }}>
            {robot.nombre} · {robot.estado} · Nave {robot.nave} · Última ronda {haceCuanto(robot.ultimaRonda)}
          </p>
        </div>

        <div className="columna" style={{ gap: 16 }}>
          <section className="kpis" style={{ marginBottom: 0 }}>
            <TarjetaKpi
              tono={bateria > 40 ? 'ok' : bateria > 15 ? 'riesgo' : 'alerta'}
              etiqueta="Batería ahora"
              valor={`${bateria} %`}
              detalle={`Ronda ${robot.ronda} de ${robot.rondasTotales} · ${robot.progreso} % recorrido`}
            />
            <TarjetaKpi
              etiqueta="Le alcanza para"
              valor={`${horas} h ${minutos} min`}
              detalle={`De las ${HORAS_AUTONOMIA_CARGA_COMPLETA} h que dura con carga completa`}
            />
            <TarjetaKpi
              etiqueta="Distancia que le queda"
              valor={`${(metrosRestantes / 1000).toFixed(1)} km`}
              detalle={`A ${VELOCIDAD_TIPICA_MS} m/s, la velocidad típica del X2 Ultra`}
            />
            <TarjetaKpi
              etiqueta="Rondas completas que le quedan"
              valor={rondasRestantes.toFixed(1)}
              detalle={`Bloque ${mapa.bloque}: ${metrosTotalesHoy.toLocaleString('es-CO')} m de cama por ronda`}
            />
          </section>

          <div className="tarjeta">
            <h2 className="tarjeta-titulo">
              <Gauge size={17} /> Cómo se calcula
            </h2>
            <div className="como-estoy-cuentas">
              <div className="como-estoy-cuenta">
                <MapPinned size={16} />
                <span className="txt-pequeno">
                  El bloque {mapa.bloque} tiene {TOTAL_CAMAS} camas de {metrosPorCama} m cada una (lo largo de cada
                  nave) → <strong>{metrosTotalesHoy.toLocaleString('es-CO')} m</strong> de cama en total, hoy.
                </span>
              </div>
              <div className="como-estoy-cuenta">
                <Route size={16} />
                <span className="txt-pequeno">
                  A {VELOCIDAD_TIPICA_MS} m/s (velocidad típica publicada del AgiBot X2 Ultra) durante{' '}
                  {HORAS_AUTONOMIA_CARGA_COMPLETA} h de carga completa, el robot recorre hasta{' '}
                  <strong>{(metrosPorCargaCompleta / 1000).toFixed(1)} km</strong> — unas{' '}
                  <strong>{rondasPorCargaCompleta.toFixed(1)} rondas completas</strong> del bloque.
                </span>
              </div>
              <div className="como-estoy-cuenta">
                <BatteryCharging size={16} />
                <span className="txt-pequeno">
                  Con el {bateria} % que tiene ahora, eso se reduce a{' '}
                  <strong>{(metrosRestantes / 1000).toFixed(1)} km</strong> y{' '}
                  <strong>
                    {horas} h {minutos} min
                  </strong>{' '}
                  de recorrido — suficiente para {rondasRestantes.toFixed(1)} rondas más del bloque.
                </span>
              </div>
              <div className="como-estoy-cuenta">
                <Clock size={16} />
                <span className="txt-pequeno">
                  Las {HORAS_AUTONOMIA_CARGA_COMPLETA} h de autonomía con carga completa son el supuesto del equipo;
                  la velocidad y el resto de la estructura (naves, camas, largo) se editan en Configuración y este
                  cálculo se actualiza solo.
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <p className="nota-ejemplo txt-pequeno" style={{ marginTop: 16 }}>
        <span className="punto neutro" style={{ marginTop: 7 }} />
        <span>
          La ilustración del robot es un dibujo vectorial propio, no un modelo CAD importado: en el repo no hay
          ningún archivo 3D real del AgiBot X2 Ultra. Las proporciones (1,31 m de alto, 0,46 m de hombros) y los
          sensores (LiDAR 3D, cámaras RGB-D estéreo al frente, cámara trasera, mochila de cómputo) sí siguen la
          ficha técnica publicada del robot.
        </span>
      </p>
    </section>
  );
}
