/**
 * 11 · Equipos y servicios (28:15351).
 *
 * Los datos de esta pantalla son de ejemplo y los simula el prototipo.
 * No son lecturas reales de los equipos de Agrar ni un producto de Agrar.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ChevronDown,
  Cpu,
  Droplets,
  Fan,
  LogOut,
  Power,
  PowerOff,
  RotateCw,
  Wind,
} from 'lucide-react';
import { NOTA_DATOS_EJEMPLO, UMBRALES } from '@vigia/shared/config';
import type {
  Equipo,
  EquiposRespuesta,
  EstadoEquipo,
  EventoEquipo,
  IconoEquipo,
} from '@vigia/shared/tipos';
import { api } from '../api/cliente';
import { Boton } from '../components/Boton';
import { Chip } from '../components/Chip';
import { TarjetaKpi } from '../components/TarjetaKpi';
import { haceCuanto, numero } from '../utilidades/formato';

const ICONOS: Record<IconoEquipo, typeof Fan> = {
  fan: Fan,
  rotate: RotateCw,
  wind: Wind,
  extract: LogOut,
  droplet: Droplets,
  cpu: Cpu,
};

/** Cuántos eventos se ven sin tener que abrir el desplegable. */
const EVENTOS_VISIBLES = 4;

const TONO_ESTADO: Record<EstadoEquipo, 'ok' | 'riesgo' | 'alerta' | 'neutro'> = {
  'En marcha': 'ok',
  Activo: 'ok',
  'En espera': 'neutro',
  Aviso: 'alerta',
};

/** Color del punto del recuadro "qué está pasando". */
function tonoNota(equipo: Equipo, naveHumeda: boolean): 'ok' | 'riesgo' | 'alerta' {
  if (equipo.estado === 'Aviso') return 'alerta';
  if (naveHumeda && equipo.estado === 'En marcha') return 'riesgo';
  return 'ok';
}

function tonoEvento(evento: EventoEquipo): 'ok' | 'riesgo' | 'alerta' {
  const texto = evento.texto.toLowerCase();
  if (texto.includes('dejó de responder') || texto.includes('sin respuesta')) return 'alerta';
  if (texto.includes('humedad de') || texto.includes('subieron')) return 'riesgo';
  return 'ok';
}

function TarjetaEquipo({
  equipo,
  naveHumeda,
  ocupado,
  alCambiar,
}: {
  equipo: Equipo;
  naveHumeda: boolean;
  ocupado: boolean;
  alCambiar: (desactivado: boolean) => void;
}) {
  const Icono = ICONOS[equipo.icono];
  const tono = tonoNota(equipo, naveHumeda);

  return (
    <article className={`equipo ${equipo.desactivado ? 'desactivado' : ''}`}>
      <div className="cabecera">
        <span className="equipo-icono">
          <Icono size={20} strokeWidth={2} />
        </span>
        <div className="columna" style={{ flex: 1, minWidth: 0 }}>
          <span className="tarjeta-titulo">{equipo.tipo}</span>
          <span className="secundario txt-pequeno">
            {equipo.modelo} · {equipo.ubicacion}
          </span>
        </div>
        <Chip tono={equipo.desactivado ? 'neutro' : TONO_ESTADO[equipo.estado]}>
          {equipo.desactivado ? 'Desactivado' : equipo.estado}
        </Chip>
      </div>

      <div className="datos">
        {equipo.metricas.map((metrica) => (
          <div className="columna" key={metrica.etiqueta}>
            <span className="txt-pequeno">{metrica.etiqueta}</span>
            <span className="txt-cuerpo-fuerte" style={{ color: 'var(--color-text-primary)' }}>
              {metrica.valor}
            </span>
          </div>
        ))}
      </div>

      {equipo.conBarra && (
        <div className={`medidor ${tono === 'riesgo' ? 'ambar' : 'verde'}`}>
          <span style={{ width: `${Math.max(equipo.potencia, 2)}%` }} />
        </div>
      )}

      <div className={`equipo-nota ${equipo.desactivado ? 'ok' : tono}`}>
        <span className={`punto ${equipo.desactivado ? 'neutro' : tono}`} />
        <span className="txt-pequeno">{equipo.queEstaPasando}</span>
      </div>

      {/*
        Un botón por equipo: apagarlo a mano. Es lo primero que hay que hacer
        cuando se confirma un hongo — con la ventilación encendida el aire
        reparte las esporas por toda la nave.
      */}
      <Boton
        bloque
        variante={equipo.desactivado ? 'secundario' : 'peligro'}
        icono={equipo.desactivado ? <Power size={17} /> : <PowerOff size={17} />}
        disabled={ocupado}
        onClick={() => alCambiar(!equipo.desactivado)}
        className="boton-separado"
      >
        {equipo.desactivado ? 'Volver a activar' : 'Desactivar'}
      </Boton>
    </article>
  );
}

export function Equipos() {
  const [datos, setDatos] = useState<EquiposRespuesta & { nota: string }>();
  const [eventos, setEventos] = useState<EventoEquipo[]>([]);
  const [eventosAbiertos, setEventosAbiertos] = useState(false);
  /** Id del equipo que se está apagando o encendiendo ahora mismo. */
  const [ocupado, setOcupado] = useState<string>();
  const idsPrevios = useRef<Set<string>>(new Set());

  const cargar = useCallback(async () => {
    const [equipos, listaEventos] = await Promise.all([api.equipos(), api.eventosEquipos()]);
    setDatos(equipos);
    setEventos(listaEventos);
  }, []);

  useEffect(() => {
    void cargar();
    // La lista "Qué está pasando" se actualiza sola.
    const intervalo = window.setInterval(() => void cargar(), 8000);
    return () => window.clearInterval(intervalo);
  }, [cargar]);

  useEffect(() => {
    idsPrevios.current = new Set(eventos.map((e) => e.id));
  }, [eventos]);

  const cambiarEquipo = useCallback(
    async (id: string, desactivado: boolean) => {
      setOcupado(id);
      try {
        await api.cambiarEquipo(id, desactivado);
        await cargar();
      } finally {
        setOcupado(undefined);
      }
    },
    [cargar],
  );

  if (!datos) return <p className="cargando">Cargando los equipos…</p>;

  const { resumen, equipos } = datos;
  const camas = resumen.camasHumedas;
  const textoCamas =
    camas.length === 0
      ? 'Ninguna cama sobre el umbral'
      : `Camas ${camas.slice(0, -1).join(', ')}${camas.length > 1 ? ' y ' : ''}${camas[camas.length - 1]}` +
        (resumen.naveCamasHumedas ? ` · nave ${resumen.naveCamasHumedas}` : '');

  return (
    <>
      <section className="kpis">
        <TarjetaKpi
          tono="ok"
          etiqueta="Equipos en marcha"
          valor={`${resumen.enMarcha} de ${resumen.total}`}
          detalle={
            `${resumen.enEspera} en espera · ${resumen.avisos} con aviso` +
            (resumen.desactivados > 0 ? ` · ${resumen.desactivados} desactivados` : '')
          }
        />
        <TarjetaKpi
          etiqueta="Humedad promedio"
          valor={`${resumen.humedadMedia.toFixed(0)} %`}
          detalle={`Umbral de riesgo: ${UMBRALES.humedadAlta} %`}
        />
        <TarjetaKpi
          tono="riesgo"
          etiqueta="Camas con humedad alta"
          valor={numero(camas.length)}
          detalle={textoCamas}
        />
        <TarjetaKpi
          tono="alerta"
          etiqueta="Avisos de equipos"
          valor={numero(resumen.avisos)}
          detalle={resumen.avisoTexto ?? 'Todo responde con normalidad'}
        />
      </section>

      <section className="equipos-grid">
        <div>
          <h2 className="txt-pagina" style={{ margin: '0 0 2px', fontSize: 22, lineHeight: '28px' }}>
            Equipos del ecosistema Agrar
          </h2>
          <p className="secundario txt-pequeno" style={{ margin: '0 0 18px' }}>
            Datos de ejemplo · se conectarán al sistema de control de cada planta
          </p>

          <div className="tarjetas-equipos">
            {equipos.map((equipo) => (
              <TarjetaEquipo
                equipo={equipo}
                naveHumeda={equipo.nave === resumen.naveCamasHumedas}
                ocupado={ocupado === equipo.id}
                alCambiar={(desactivado) => void cambiarEquipo(equipo.id, desactivado)}
                key={equipo.id}
              />
            ))}
          </div>

          <div className="nota-ejemplo txt-pequeno" style={{ marginTop: 18 }}>
            <span className="punto neutro" style={{ marginTop: 7 }} />
            <span>{datos.nota ?? NOTA_DATOS_EJEMPLO}</span>
          </div>
        </div>

        <div className="panel-derecho">
          <div className="tarjeta">
            <button
              type="button"
              className="eventos-cabecera"
              onClick={() => setEventosAbiertos((v) => !v)}
              aria-expanded={eventosAbiertos}
            >
              <h2 className="txt-pagina" style={{ margin: 0, fontSize: 22, lineHeight: '28px' }}>
                Qué está pasando
              </h2>
              <div className="fila" style={{ gap: 8 }}>
                <Chip tono="ok">En vivo</Chip>
                {eventos.length > EVENTOS_VISIBLES && (
                  <span className="apagado txt-pequeno">{eventos.length}</span>
                )}
                <ChevronDown size={18} className={`eventos-chevron ${eventosAbiertos ? 'abierto' : ''}`} />
              </div>
            </button>

            {eventosAbiertos && (
              <div className="eventos">
                {eventos.map((evento) => (
                  <div
                    className={`evento ${idsPrevios.current.has(evento.id) ? '' : 'evento-nuevo'}`}
                    key={evento.id}
                  >
                    <span className={`punto ${tonoEvento(evento)}`} style={{ marginTop: 7 }} />
                    <div className="columna">
                      <span className="txt-pequeno">{evento.texto}</span>
                      <span className="apagado txt-etiqueta">{haceCuanto(evento.fecha)}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {!eventosAbiertos && (
              <div className="eventos eventos-resumen">
                {eventos.slice(0, EVENTOS_VISIBLES).map((evento) => (
                  <div className="evento" key={evento.id}>
                    <span className={`punto ${tonoEvento(evento)}`} style={{ marginTop: 7 }} />
                    <div className="columna">
                      <span className="txt-pequeno">{evento.texto}</span>
                      <span className="apagado txt-etiqueta">{haceCuanto(evento.fecha)}</span>
                    </div>
                  </div>
                ))}
                {eventos.length > EVENTOS_VISIBLES && (
                  <button type="button" className="eventos-ver-todo txt-pequeno" onClick={() => setEventosAbiertos(true)}>
                    Ver los {eventos.length} eventos
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      </section>
    </>
  );
}
