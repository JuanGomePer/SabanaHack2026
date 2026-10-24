/**
 * 03 · Detalle de planta (7:2208), con los modos
 * 03b · Revisar con gafas VR (23:9276) y 03c · Enviado a las gafas (23:12758).
 *
 * El envío a las gafas es una SIMULACIÓN de la interfaz: el servidor solo
 * cambia un estado. No hay integración con Meta Quest.
 */

import { useCallback, useEffect, useState } from 'react';
import {
  Camera,
  Check,
  Cloud,
  Droplet,
  Expand,
  Glasses,
  MessageSquare,
  RefreshCw,
  Send,
  ShieldAlert,
  Thermometer,
  Wind,
  X,
} from 'lucide-react';
import { DISPOSITIVO_GAFAS, ETIQUETA_CIENTIFICA_TIPO, UMBRALES } from '@vigia/shared/config';
import type { DetallePlanta as Detalle, EstadoCelda } from '@vigia/shared/tipos';
import { api, urlDeApi } from '../api/cliente';
import { Boton } from '../components/Boton';
import { Chip, type TonoChip } from '../components/Chip';
import { Segmentado } from '../components/Segmentado';
import { GraficoHumedad } from '../components/GraficoHumedad';
import { VistaGafas } from '../components/VistaGafas';
import { SimulacionTratamiento } from '../components/SimulacionTratamiento';
import { haceCuanto } from '../utilidades/formato';

const VISTAS = ['Foto', 'Gafas Meta'] as const;
type Vista = (typeof VISTAS)[number];

const TEXTO_ESTADO: Record<EstadoCelda, string> = {
  ok: 'Sana',
  riesgo: 'En riesgo',
  alerta: 'En alerta',
  en_revision: 'En revisión',
  confirmada: 'Afectada',
  sin_dato: 'Sin dato',
};

const TONO_ESTADO: Record<EstadoCelda, TonoChip> = {
  ok: 'ok',
  riesgo: 'riesgo',
  alerta: 'alerta',
  en_revision: 'revision',
  confirmada: 'confirmada',
  sin_dato: 'neutro',
};

/** "las camas 13 y 15", "la cama 13" o la propia si la cama no tiene vecinas. */
function textoCamas(camas: number[], camaPropia: number): string {
  if (camas.length === 0) return `la cama ${camaPropia}`;
  if (camas.length === 1) return `la cama ${camas[0]}`;
  return `las camas ${camas.slice(0, -1).join(', ')} y ${camas[camas.length - 1]}`;
}

/** Punto de rocío aproximado (Magnus simplificado), solo para mostrar. */
function puntoDeRocio(temperatura: number, humedad: number): number {
  const a = 17.27;
  const b = 237.7;
  const alfa = (a * temperatura) / (b + temperatura) + Math.log(Math.max(humedad, 1) / 100);
  return (b * alfa) / (a - alfa);
}

interface Props {
  plantaId: string;
  alCerrar: () => void;
  alCambiarPlanta: (plantaId: string) => void;
  alRevisar: () => Promise<void> | void;
}

export function DetallePlanta({ plantaId, alCerrar, alCambiarPlanta, alRevisar }: Props) {
  const [detalle, setDetalle] = useState<Detalle>();
  const [vista, setVista] = useState<Vista>('Foto');
  const [gafas, setGafas] = useState<'no_enviado' | 'enviado' | 'recibido'>('no_enviado');
  const [enviando, setEnviando] = useState(false);
  const [guardando, setGuardando] = useState(false);
  /** Decisión ya tomada: lo que se le avisó al campo y dónde hay que cuidar. */
  const [decision, setDecision] = useState<{
    revision: 'confirmada' | 'falsa_alarma';
    camasVigilar: number[];
    avisos: number;
  }>();

  useEffect(() => {
    let vigente = true;
    setDetalle(undefined);
    void api.planta(plantaId).then((datos) => {
      if (!vigente) return;
      setDetalle(datos);
      setGafas(datos.hallazgo?.gafas ?? 'no_enviado');
    });
    return () => {
      vigente = false;
    };
  }, [plantaId]);

  // Cerrar con Escape, como en el prototipo.
  useEffect(() => {
    const alPulsar = (evento: KeyboardEvent) => {
      if (evento.key === 'Escape') alCerrar();
    };
    window.addEventListener('keydown', alPulsar);
    return () => window.removeEventListener('keydown', alPulsar);
  }, [alCerrar]);

  const enviarAGafas = useCallback(async () => {
    if (!detalle?.hallazgo) return;
    setEnviando(true);
    setVista('Gafas Meta');
    try {
      await api.enviarAGafas(detalle.hallazgo.id);
      setGafas('enviado');
      // El acuse del visor llega poco después (simulado).
      window.setTimeout(() => setGafas('recibido'), 1600);
    } finally {
      setEnviando(false);
    }
  }, [detalle]);

  /**
   * Tercer paso de la revisión: cuando ya se decidió, el panel no se cierra de
   * una — primero muestra qué se le avisó a quien está en campo y dónde tiene
   * que tener cuidado. "Tomar para revisar" todavía no es una decisión, así
   * que ese sí cierra directo.
   */
  const revisar = useCallback(
    async (revision: 'en_revision' | 'confirmada' | 'falsa_alarma') => {
      if (!detalle?.hallazgo) return;
      setGuardando(true);
      try {
        const resultado = await api.revisar(detalle.hallazgo.id, revision);
        await alRevisar();
        if (revision === 'en_revision') {
          alCerrar();
          return;
        }
        setDecision({
          revision,
          camasVigilar: resultado.camasVigilar ?? [],
          avisos: resultado.avisos ?? 0,
        });
      } finally {
        setGuardando(false);
      }
    },
    [detalle, alRevisar, alCerrar],
  );

  const planta = detalle?.planta;
  const hallazgo = detalle?.hallazgo;

  return (
    <>
      <div className="velo" onClick={alCerrar} role="presentation" />
      <aside className="panel-planta" aria-label="Detalle de planta">
        <header>
          <div className="fila-entre">
            <div className="columna">
              <h2 className="txt-pagina" style={{ margin: 0, fontSize: 24, lineHeight: '30px' }}>
                Planta {detalle?.etiqueta ?? '…'}
              </h2>
              <span className="secundario txt-pequeno">
                {planta
                  ? `Bloque B5 · Nave ${planta.nave} · Cama ${planta.cama}`
                  : 'Cargando…'}
              </span>
            </div>
            <div className="fila" style={{ gap: 10 }}>
              {planta && <Chip tono={TONO_ESTADO[planta.estado]}>{TEXTO_ESTADO[planta.estado]}</Chip>}
              <button type="button" className="icono-boton redondo" onClick={alCerrar} aria-label="Cerrar">
                <X size={18} />
              </button>
            </div>
          </div>
        </header>

        {!detalle && <p className="cargando">Cargando la planta…</p>}

        {detalle && planta && (
          <>
            <div className="cuerpo">
              <div className="fila" style={{ gap: 10 }}>
                <Segmentado
                  opciones={VISTAS}
                  valor={vista}
                  alCambiar={setVista}
                  etiquetaAccesible="Cómo revisar la planta"
                />
                <div style={{ flex: 1 }} />
                {vista === 'Foto' ? (
                  <Boton icono={<Expand size={17} />} onClick={() => window.open(hallazgo ? urlDeApi(hallazgo.fotoUrl) : undefined, '_blank')} disabled={!hallazgo}>
                    Ver foto ampliada
                  </Boton>
                ) : gafas === 'no_enviado' ? (
                  <Boton icono={<Send size={17} />} onClick={enviarAGafas} disabled={!hallazgo || enviando}>
                    Enviar a las gafas
                  </Boton>
                ) : (
                  <Boton variante="secundario" icono={<RefreshCw size={17} />} onClick={enviarAGafas}>
                    Reenviar a las gafas
                  </Boton>
                )}
              </div>

              {/* ── Foto del robot ─────────────────────────────────────── */}
              {vista === 'Foto' && (
                <div className="foto-hallazgo">
                  {hallazgo ? (
                    <>
                      <img
                        src={urlDeApi(hallazgo.fotoUrl)}
                        alt={`Hallazgo de ${ETIQUETA_CIENTIFICA_TIPO[hallazgo.tipo]} en ${detalle.etiqueta}`}
                      />
                      <span className="foto-chip txt-etiqueta">
                        {ETIQUETA_CIENTIFICA_TIPO[hallazgo.tipo]} · {Math.round(hallazgo.confianza * 100)} %
                      </span>
                      <span className="foto-pie txt-etiqueta">
                        <Camera size={14} /> Robot X2 · {haceCuanto(hallazgo.detectadoEn)}
                      </span>
                    </>
                  ) : (
                    <>
                      {/* Sin hallazgo se muestra la última foto de la ronda. Si
                          no hay fotos en server/fotos/sana/, el servidor
                          responde 404 y la imagen se oculta sola. */}
                      <img
                        src={urlDeApi(`/fotos/planta/${planta.id}`)}
                        alt={`Última foto del robot en ${detalle.etiqueta}`}
                        onError={(evento) => {
                          evento.currentTarget.style.display = 'none';
                        }}
                      />
                      <span className="foto-chip sana txt-etiqueta">Sin hallazgos</span>
                      <span className="foto-pie txt-etiqueta">
                        <Camera size={14} /> Robot X2 · {haceCuanto(planta.ultimaLectura)}
                      </span>
                    </>
                  )}
                </div>
              )}

              {/* ── 03b / 03c · Gafas ──────────────────────────────────── */}
              {vista === 'Gafas Meta' && gafas === 'no_enviado' && (
                <div className="gafas-tarjeta">
                  <VistaGafas cama={planta.cama} planta={planta.planta} />
                  <div className="gafas-dispositivo">
                    <Glasses size={20} strokeWidth={2} />
                    <div className="columna" style={{ flex: 1, minWidth: 0 }}>
                      <span className="txt-pequeno-fuerte">{DISPOSITIVO_GAFAS} · conectada</span>
                      <span className="txt-etiqueta" style={{ color: 'var(--color-text-on-sidebar)' }}>
                        Recibe: vista del campo, planta marcada y fotos del robot
                      </span>
                    </div>
                    <Chip tono="ok">Lista</Chip>
                  </div>
                </div>
              )}

              {vista === 'Gafas Meta' && gafas !== 'no_enviado' && (
                <div className="gafas-enviado">
                  <span className="marca-ok">
                    <Check size={22} strokeWidth={3} />
                  </span>
                  <h3 className="tarjeta-titulo" style={{ color: 'var(--color-status-ok-fg)' }}>
                    Enviado a tus gafas
                  </h3>
                  <p className="secundario txt-pequeno" style={{ margin: 0 }}>
                    Ponte las {DISPOSITIVO_GAFAS} para recorrer la cama {planta.cama} y ver la planta
                    marcada.
                  </p>
                  <div className="gafas-dispositivo claro">
                    <Glasses size={20} strokeWidth={2} />
                    <div className="columna" style={{ flex: 1, minWidth: 0 }}>
                      <span className="txt-pequeno-fuerte">{DISPOSITIVO_GAFAS} · conectada</span>
                      <span className="txt-etiqueta secundario">
                        Recibe: vista del campo, planta marcada y fotos del robot
                      </span>
                    </div>
                    <Chip tono="ok">{gafas === 'recibido' ? 'Recibido' : 'Enviado'}</Chip>
                  </div>
                  <p className="apagado txt-etiqueta" style={{ margin: 0 }}>
                    Vista previa de lo que reciben las gafas. La conexión con el visor todavía no está disponible.
                  </p>
                </div>
              )}

              {/* ── Lecturas ───────────────────────────────────────────── */}
              <div className="lecturas">
                <div className="lectura humedad">
                  <span className="fila txt-etiqueta" style={{ gap: 6 }}>
                    <Droplet size={14} /> Humedad
                  </span>
                  <span className="valor">{planta.humedad.toFixed(0)} %</span>
                </div>
                <div className="lectura temperatura">
                  <span className="fila txt-etiqueta" style={{ gap: 6 }}>
                    <Thermometer size={14} /> Temperatura
                  </span>
                  <span className="valor">{planta.temperatura.toFixed(1).replace('.', ',')} °C</span>
                </div>
                <div className="lectura rocio">
                  <span className="fila txt-etiqueta" style={{ gap: 6 }}>
                    <Cloud size={14} /> Punto de rocío
                  </span>
                  <span className="valor">
                    {puntoDeRocio(planta.temperatura, planta.humedad).toFixed(1).replace('.', ',')} °C
                  </span>
                </div>
              </div>

              <GraficoHumedad
                serie={detalle.serieHumedad.slice(-7)}
                umbral={UMBRALES.humedadRiesgo}
              />

              {/* ── Qué hacer ──────────────────────────────────────────── */}
              <div className="que-hacer">
                <div className="fila" style={{ gap: 8 }}>
                  <Wind size={20} color="var(--color-brand-primary)" />
                  <span className="tarjeta-titulo" style={{ color: 'var(--color-brand-primary)' }}>
                    Qué hacer
                  </span>
                </div>
                <p className="txt-pequeno" style={{ margin: '6px 0 0' }}>
                  {hallazgo
                    ? hallazgo.recomendacion
                    : planta.estado === 'riesgo'
                      ? `La humedad está en ${planta.humedad.toFixed(0)} %. Ventila la nave ${planta.nave} y vuelve a revisar en la próxima ronda.`
                      : 'Sin acciones pendientes para esta planta.'}
                </p>
              </div>

              {/* ── Simulación vigIA: tratar vs. no tratar ─────────────── */}
              {hallazgo && <SimulacionTratamiento hallazgoId={hallazgo.id} />}

              {/* ── Plantas vecinas ────────────────────────────────────── */}
              <div>
                <p className="bloque-titulo">Plantas vecinas</p>
                <div className="vecinas-fila">
                  {detalle.vecinas.map((vecina) => (
                    <button
                      type="button"
                      key={vecina.id}
                      className={`vecina-chip ${vecina.estado} ${vecina.id === planta.id ? 'actual' : ''}`}
                      onClick={() => alCambiarPlanta(vecina.id)}
                      title={`${vecina.etiqueta} · ${TEXTO_ESTADO[vecina.estado]} · ${vecina.humedad.toFixed(0)} %`}
                    >
                      P{vecina.planta}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/*
              La revisión va en dos pasos: primero se toma la alerta para ir a
              mirarla, y ya en campo se decide si la planta está afectada. Así
              el mapa distingue lo que nadie ha visto de lo que ya tiene dueño.
            */}
            {decision ? (
              <footer className="footer-decision">
                <div className={`decision-aviso ${decision.revision}`}>
                  <span className="decision-icono">
                    {decision.revision === 'confirmada' ? (
                      <ShieldAlert size={18} />
                    ) : (
                      <Check size={18} strokeWidth={3} />
                    )}
                  </span>
                  <div className="columna" style={{ gap: 2 }}>
                    <span className="txt-cuerpo-fuerte">
                      {decision.revision === 'confirmada'
                        ? 'Decidido: hay que tener cuidado'
                        : 'Decidido: falsa alarma'}
                    </span>
                    <span className="txt-pequeno">
                      {decision.revision === 'confirmada'
                        ? `Nave ${planta.nave}, cama ${planta.cama}, planta ${detalle.etiqueta}. ` +
                          `Revisa también ${textoCamas(decision.camasVigilar, planta.cama)}, que son las de al lado.`
                        : `Nada por hacer en la cama ${planta.cama} de la nave ${planta.nave}.`}
                    </span>
                    <span className="apagado txt-etiqueta fila" style={{ gap: 6, marginTop: 2 }}>
                      <MessageSquare size={12} />
                      {decision.avisos > 0
                        ? `Avisado a ${decision.avisos} ${decision.avisos === 1 ? 'número' : 'números'} por mensaje de texto.`
                        : 'El aviso de la decisión está apagado: avísale tú a quien esté en campo (Configuración · Alertas y umbrales).'}
                    </span>
                  </div>
                </div>
                <Boton bloque onClick={alCerrar}>
                  Listo
                </Boton>
              </footer>
            ) : (
              <footer>
                {hallazgo?.revision === 'en_revision' ? (
                  <Boton
                    bloque
                    icono={<Check size={18} />}
                    onClick={() => revisar('confirmada')}
                    disabled={guardando}
                  >
                    Sí está afectada
                  </Boton>
                ) : (
                  <Boton
                    bloque
                    icono={<Check size={18} />}
                    onClick={() => revisar('en_revision')}
                    disabled={!hallazgo || guardando || hallazgo.revision === 'confirmada'}
                  >
                    Tomar para revisar
                  </Boton>
                )}
                <Boton
                  bloque
                  variante="peligro"
                  icono={<X size={18} />}
                  onClick={() => revisar('falsa_alarma')}
                  disabled={!hallazgo || guardando}
                >
                  Falsa alarma
                </Boton>
              </footer>
            )}
          </>
        )}
      </aside>
    </>
  );
}
