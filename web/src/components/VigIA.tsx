/**
 * vigIA: asistente de consulta accesible desde toda la app.
 *
 * NO es un modelo de lenguaje: cada botón llama a una herramienta
 * determinista del backend sobre datos reales (ver server/src/vigia/). El
 * cuadro de texto libre solo intenta adivinar, por palabras clave, cuál de
 * esas herramientas usar — si no reconoce nada, lo dice y sugiere los
 * botones. Nunca inventa una cifra: lo que no sabe, lo dice.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  AlertTriangle,
  Bot,
  ExternalLink,
  Eye,
  EyeOff,
  Send,
  Sparkles,
  X,
} from 'lucide-react';
import type {
  AccionVigia,
  AccionVigiaInfo,
  EventoVivo,
  Insight,
  PrioridadInsight,
  RespuestaVigia,
} from '@vigia/shared/tipos';
import { api, escucharEventos } from '../api/cliente';
import { Chip } from './Chip';

export interface ContextoVigia {
  pantalla: string;
  plantaId?: string;
  hallazgoId?: string;
  cama?: number;
}

interface Turno {
  id: string;
  rol: 'usuario' | 'vigia';
  texto: string;
  respuesta?: RespuestaVigia;
}

const TONO_PRIORIDAD: Record<PrioridadInsight, 'alta' | 'media' | 'baja'> = {
  alta: 'alta',
  media: 'media',
  baja: 'baja',
};

function idCorto(): string {
  return Math.random().toString(36).slice(2, 9);
}

function ChipPrioridad({ prioridad }: { prioridad?: PrioridadInsight }) {
  if (!prioridad) return null;
  const tono = prioridad === 'alta' ? 'alerta' : prioridad === 'media' ? 'riesgo' : 'neutro';
  const texto = prioridad === 'alta' ? 'Prioridad alta' : prioridad === 'media' ? 'Prioridad media' : 'Prioridad baja';
  return <Chip tono={tono}>{texto}</Chip>;
}

function TarjetaRespuesta({ respuesta, alAbrirDetalle }: { respuesta: RespuestaVigia; alAbrirDetalle: (tipo: string, id: string) => void }) {
  return (
    <div className="vigia-tarjeta">
      <div className="fila-entre">
        <span className="txt-cuerpo-peq-fuerte">{respuesta.titulo}</span>
        <ChipPrioridad prioridad={respuesta.prioridad} />
      </div>
      <p className="txt-pequeno" style={{ margin: '4px 0 0' }}>{respuesta.texto}</p>
      {respuesta.explicacion && (
        <p className="apagado txt-etiqueta" style={{ margin: '6px 0 0' }}>{respuesta.explicacion}</p>
      )}
      {respuesta.factores && respuesta.factores.length > 0 && (
        <ul className="vigia-factores">
          {respuesta.factores.map((f) => (
            <li key={f} className="txt-etiqueta apagado">{f}</li>
          ))}
        </ul>
      )}
      {respuesta.recomendacion && (
        <div className="vigia-recomendacion">
          <Sparkles size={13} />
          <span className="txt-etiqueta">{respuesta.recomendacion}</span>
        </div>
      )}
      {respuesta.confianza !== undefined && (
        <span className="apagado txt-etiqueta" style={{ display: 'block', marginTop: 4 }}>
          Confianza de la estimación: {Math.round(respuesta.confianza * 100)} %
        </span>
      )}
      {respuesta.enlaces && respuesta.enlaces.length > 0 && (
        <div className="vigia-enlaces">
          {respuesta.enlaces.map((e) => (
            <button
              key={`${e.tipo}-${e.id}`}
              type="button"
              className="vigia-enlace"
              onClick={() => alAbrirDetalle(e.tipo, e.id)}
            >
              <ExternalLink size={12} /> {e.texto}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

interface Props {
  contexto: ContextoVigia;
  alAbrirPlanta: (plantaId: string) => void;
}

export function VigIA({ contexto, alAbrirPlanta }: Props) {
  const [abierto, setAbierto] = useState(false);
  const [vista, setVista] = useState<'chat' | 'insights'>('chat');
  const [acciones, setAcciones] = useState<AccionVigiaInfo[]>([]);
  const [turnos, setTurnos] = useState<Turno[]>([]);
  const [pregunta, setPregunta] = useState('');
  const [accionConParametros, setAccionConParametros] = useState<AccionVigiaInfo>();
  const [valoresParametros, setValoresParametros] = useState<Record<string, string>>({});
  const [cargando, setCargando] = useState(false);
  const [insights, setInsights] = useState<Insight[]>([]);
  const [nuevos, setNuevos] = useState(0);
  const finalRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    void api.vigiaAcciones().then((d) => setAcciones(d.acciones));
  }, []);

  const cargarInsights = useCallback(() => {
    void api.vigiaInsights().then((d) => {
      setInsights(d.insights);
      setNuevos(d.nuevos);
    });
  }, []);

  useEffect(() => {
    cargarInsights();
  }, [cargarInsights]);

  // Escucha propia: vigIA se usa desde cualquier pantalla, no solo el mapa.
  useEffect(() => {
    const cerrar = escucharEventos((evento: EventoVivo) => {
      if (evento.tipo === 'insight_nuevo') {
        setInsights((previos) => [evento.insight, ...previos].slice(0, 50));
        setNuevos((n) => n + 1);
      }
    });
    return cerrar;
  }, []);

  useEffect(() => {
    finalRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [turnos]);

  async function responder(textoUsuario: string, accion: AccionVigia | null, parametros?: Record<string, string>) {
    const turnoUsuario: Turno = { id: idCorto(), rol: 'usuario', texto: textoUsuario };
    setTurnos((t) => [...t, turnoUsuario]);
    setCargando(true);
    try {
      const respuesta = await api.vigiaConsultar(accion, parametros, accion ? undefined : textoUsuario);
      setTurnos((t) => [...t, { id: idCorto(), rol: 'vigia', texto: respuesta.titulo, respuesta }]);
    } catch {
      setTurnos((t) => [
        ...t,
        { id: idCorto(), rol: 'vigia', texto: 'No pude consultar la API ahora mismo. Intenta de nuevo en un momento.' },
      ]);
    } finally {
      setCargando(false);
    }
  }

  function alPulsarAccion(accion: AccionVigiaInfo) {
    if (!accion.parametros || accion.parametros.length === 0) {
      void responder(accion.etiqueta, accion.id);
      return;
    }
    const valoresIniciales: Record<string, string> = {};
    if (contexto.hallazgoId && accion.parametros.some((p) => p.nombre === 'hallazgoId')) {
      valoresIniciales.hallazgoId = contexto.hallazgoId;
    }
    if (contexto.cama !== undefined) {
      for (const p of accion.parametros) if (p.tipo === 'cama' && !valoresIniciales[p.nombre]) valoresIniciales[p.nombre] = String(contexto.cama);
    }
    setAccionConParametros(accion);
    setValoresParametros(valoresIniciales);
  }

  function enviarAccionConParametros() {
    if (!accionConParametros) return;
    const faltan = accionConParametros.parametros?.some((p) => p.requerido && !valoresParametros[p.nombre]?.trim());
    if (faltan) return;
    void responder(accionConParametros.etiqueta, accionConParametros.id, valoresParametros);
    setAccionConParametros(undefined);
    setValoresParametros({});
  }

  function enviarPreguntaLibre() {
    const texto = pregunta.trim();
    if (!texto) return;
    setPregunta('');
    void responder(texto, null);
  }

  function alAbrirDetalle(tipo: string, id: string) {
    if (tipo === 'planta') {
      alAbrirPlanta(id);
      setAbierto(false);
    }
  }

  const accionContextual = contexto.hallazgoId
    ? acciones.find((a) => a.id === 'explicar_alerta')
    : undefined;

  return (
    <>
      <button
        type="button"
        className="vigia-boton-flotante"
        onClick={() => setAbierto((v) => !v)}
        aria-label={abierto ? 'Cerrar vigIA' : 'Abrir vigIA'}
      >
        {abierto ? <X size={22} /> : <Bot size={22} />}
        {!abierto && nuevos > 0 && <span className="vigia-insignia">{nuevos > 9 ? '9+' : nuevos}</span>}
      </button>

      {abierto && (
        <div className="vigia-panel" role="dialog" aria-label="vigIA">
          <header className="vigia-cabecera">
            <div className="fila" style={{ gap: 8 }}>
              <Bot size={18} />
              <span className="txt-cuerpo-fuerte">vigIA</span>
            </div>
            <div className="fila" style={{ gap: 4 }}>
              <button
                type="button"
                className={`vigia-tab ${vista === 'chat' ? 'activo' : ''}`}
                onClick={() => setVista('chat')}
              >
                Chat
              </button>
              <button
                type="button"
                className={`vigia-tab ${vista === 'insights' ? 'activo' : ''}`}
                onClick={() => {
                  setVista('insights');
                  setNuevos(0);
                }}
              >
                Insights{nuevos > 0 ? ` (${nuevos})` : ''}
              </button>
            </div>
          </header>

          {vista === 'chat' && (
            <>
              <div className="vigia-mensajes">
                {turnos.length === 0 && (
                  <p className="apagado txt-pequeno" style={{ margin: 0 }}>
                    Pregúntame por el estado del cultivo, una alerta puntual, o usa uno de los botones de abajo.
                    Todo lo que respondo sale de datos reales — si algo no lo sé, te lo digo.
                  </p>
                )}
                {turnos.map((t) =>
                  t.rol === 'usuario' ? (
                    <div key={t.id} className="vigia-burbuja usuario">{t.texto}</div>
                  ) : t.respuesta ? (
                    <TarjetaRespuesta key={t.id} respuesta={t.respuesta} alAbrirDetalle={alAbrirDetalle} />
                  ) : (
                    <div key={t.id} className="vigia-burbuja vigia">{t.texto}</div>
                  ),
                )}
                {cargando && <div className="vigia-burbuja vigia apagado">Consultando…</div>}
                <div ref={finalRef} />
              </div>

              {accionContextual && (
                <div className="vigia-contextual">
                  <button type="button" onClick={() => alPulsarAccion(accionContextual)}>
                    <AlertTriangle size={13} /> Explicar esta alerta
                  </button>
                </div>
              )}

              {accionConParametros ? (
                <div className="vigia-form-parametros">
                  <span className="txt-etiqueta apagado">{accionConParametros.etiqueta}</span>
                  {accionConParametros.parametros?.map((p) => (
                    <input
                      key={p.nombre}
                      className="campo-texto"
                      placeholder={p.etiqueta}
                      value={valoresParametros[p.nombre] ?? ''}
                      onChange={(e) => setValoresParametros((v) => ({ ...v, [p.nombre]: e.target.value }))}
                      onKeyDown={(e) => e.key === 'Enter' && enviarAccionConParametros()}
                    />
                  ))}
                  <div className="fila" style={{ gap: 6 }}>
                    <button type="button" className="vigia-chip" onClick={enviarAccionConParametros}>
                      Preguntar
                    </button>
                    <button type="button" className="vigia-chip fantasma" onClick={() => setAccionConParametros(undefined)}>
                      Cancelar
                    </button>
                  </div>
                </div>
              ) : (
                <div className="vigia-chips">
                  {acciones.map((a) => (
                    <button key={a.id} type="button" className="vigia-chip" title={a.descripcion} onClick={() => alPulsarAccion(a)}>
                      {a.etiqueta}
                    </button>
                  ))}
                </div>
              )}

              <div className="vigia-entrada">
                <input
                  className="campo-texto"
                  placeholder="Escribe tu pregunta…"
                  value={pregunta}
                  onChange={(e) => setPregunta(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && enviarPreguntaLibre()}
                />
                <button type="button" className="icono-boton redondo" onClick={enviarPreguntaLibre} aria-label="Preguntar">
                  <Send size={16} />
                </button>
              </div>
            </>
          )}

          {vista === 'insights' && (
            <div className="vigia-insights">
              {insights.length === 0 && (
                <p className="apagado txt-pequeno">Todavía no hay insights — vigIA los genera solo cuando nota algo (alertas, patrones, equipos).</p>
              )}
              {insights.map((i) => (
                <div key={i.id} className={`vigia-insight ${i.estado}`}>
                  <div className="fila-entre">
                    <span className="txt-pequeno-fuerte">{i.titulo}</span>
                    <ChipPrioridad prioridad={i.prioridad} />
                  </div>
                  <p className="txt-etiqueta" style={{ margin: '4px 0' }}>{i.descripcion}</p>
                  <div className="fila-entre">
                    <span className="apagado txt-etiqueta">{new Date(i.fecha).toLocaleString('es-CO')}</span>
                    <div className="fila" style={{ gap: 4 }}>
                      {i.detalleTipo === 'planta' && i.detalleId && (
                        <button type="button" className="icono-boton" onClick={() => alAbrirDetalle('planta', i.detalleId!)} aria-label="Ver detalle">
                          <ExternalLink size={13} />
                        </button>
                      )}
                      {i.estado !== 'descartado' && (
                        <button
                          type="button"
                          className="icono-boton"
                          aria-label="Descartar"
                          onClick={() => void api.marcarInsight(i.id, 'descartado').then(cargarInsights)}
                        >
                          <EyeOff size={13} />
                        </button>
                      )}
                      {i.estado === 'nuevo' && (
                        <button
                          type="button"
                          className="icono-boton"
                          aria-label="Marcar revisado"
                          onClick={() => void api.marcarInsight(i.id, 'revisado').then(cargarInsights)}
                        >
                          <Eye size={13} />
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </>
  );
}
