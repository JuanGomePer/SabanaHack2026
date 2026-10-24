/**
 * 11 · Equipos y servicios (28:15351).
 *
 * Los datos de esta pantalla son de ejemplo y los simula el prototipo.
 * No son lecturas reales de los equipos de Agrar ni un producto de Agrar.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Cpu,
  Download,
  Droplets,
  Fan,
  LogOut,
  RotateCw,
  Send,
  Wrench,
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

function TarjetaEquipo({ equipo, naveHumeda }: { equipo: Equipo; naveHumeda: boolean }) {
  const Icono = ICONOS[equipo.icono];
  const tono = tonoNota(equipo, naveHumeda);

  return (
    <article className="equipo">
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
        <Chip tono={TONO_ESTADO[equipo.estado]}>{equipo.estado}</Chip>
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

      <div className={`equipo-nota ${tono}`}>
        <span className={`punto ${tono}`} />
        <span className="txt-pequeno">{equipo.queEstaPasando}</span>
      </div>
    </article>
  );
}

export function Equipos() {
  const [datos, setDatos] = useState<EquiposRespuesta & { nota: string }>();
  const [eventos, setEventos] = useState<EventoEquipo[]>([]);
  const [aviso, setAviso] = useState<string>();
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

  const pedir = useCallback(async (tipo: 'servicio' | 'catalogo') => {
    const respuesta = await api.servicio(tipo);
    setAviso(respuesta.mensaje);
    window.setTimeout(() => setAviso(undefined), 4000);
  }, []);

  if (!datos) return <p className="cargando">Cargando los equipos…</p>;

  const { resumen, equipos, servicio } = datos;
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
          detalle={`${resumen.enEspera} en espera · ${resumen.avisos} con aviso`}
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
            <div className="fila-entre">
              <h2 className="txt-pagina" style={{ margin: 0, fontSize: 22, lineHeight: '28px' }}>
                Qué está pasando
              </h2>
              <Chip tono="ok">En vivo</Chip>
            </div>

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
          </div>

          <div className="tarjeta servicio-tarjeta">
            <div className="fila" style={{ gap: 12 }}>
              <span className="equipo-icono oscuro">
                <Wrench size={20} strokeWidth={2} />
              </span>
              <h2 className="txt-pagina" style={{ margin: 0, fontSize: 20, lineHeight: '26px' }}>
                {servicio.titulo}
              </h2>
            </div>
            <p className="secundario txt-pequeno" style={{ margin: '12px 0 16px' }}>
              {servicio.texto}
            </p>
            <Boton bloque icono={<Send size={17} />} onClick={() => void pedir('servicio')}>
              Pedir servicio técnico
            </Boton>
            <Boton
              bloque
              variante="secundario"
              icono={<Download size={17} />}
              onClick={() => void pedir('catalogo')}
              className="boton-separado"
            >
              Ver catálogo técnico
            </Boton>
            {aviso && (
              <p className="txt-pequeno" style={{ margin: '12px 0 0', color: 'var(--color-brand-primary)' }}>
                {aviso}
              </p>
            )}
          </div>
        </div>
      </section>
    </>
  );
}
