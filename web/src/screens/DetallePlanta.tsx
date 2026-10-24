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
  RefreshCw,
  Send,
  Thermometer,
  Wind,
  X,
} from 'lucide-react';
import { DISPOSITIVO_GAFAS, UMBRALES } from '@vigia/shared/config';
import type { DetallePlanta as Detalle, EstadoCelda } from '@vigia/shared/tipos';
import { api } from '../api/cliente';
import { Boton } from '../components/Boton';
import { Chip } from '../components/Chip';
import { Segmentado } from '../components/Segmentado';
import { GraficoHumedad } from '../components/GraficoHumedad';
import { VistaGafas } from '../components/VistaGafas';
import { haceCuanto } from '../utilidades/formato';

const VISTAS = ['Foto', 'Gafas Meta'] as const;
type Vista = (typeof VISTAS)[number];

const TEXTO_ESTADO: Record<EstadoCelda, string> = {
  ok: 'Sana',
  riesgo: 'En riesgo',
  alerta: 'En alerta',
  sin_dato: 'Sin dato',
};

const TONO_ESTADO: Record<EstadoCelda, 'ok' | 'riesgo' | 'alerta' | 'neutro'> = {
  ok: 'ok',
  riesgo: 'riesgo',
  alerta: 'alerta',
  sin_dato: 'neutro',
};

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

  const revisar = useCallback(
    async (revision: 'confirmada' | 'falsa_alarma') => {
      if (!detalle?.hallazgo) return;
      setGuardando(true);
      try {
        await api.revisar(detalle.hallazgo.id, revision);
        await alRevisar();
        alCerrar();
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
                  alCambiar={(nueva) => {
                    setVista(nueva);
                    if (nueva === 'Gafas Meta' && gafas === 'no_enviado') setGafas('no_enviado');
                  }}
                  etiquetaAccesible="Cómo revisar la planta"
                />
                <div style={{ flex: 1 }} />
                {vista === 'Foto' ? (
                  <Boton icono={<Expand size={17} />} onClick={() => window.open(hallazgo?.fotoUrl, '_blank')} disabled={!hallazgo}>
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
                      <img src={hallazgo.fotoUrl} alt={`Hallazgo de ${hallazgo.tipo} en ${detalle.etiqueta}`} />
                      <span className="foto-chip txt-etiqueta">
                        {hallazgo.tipo} · {Math.round(hallazgo.confianza * 100)} %
                      </span>
                      <span className="foto-pie txt-etiqueta">
                        <Camera size={14} /> Robot X2 · {haceCuanto(hallazgo.detectadoEn)}
                      </span>
                    </>
                  ) : (
                    <p className="cargando">Esta planta no tiene hallazgos del robot.</p>
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
                    Simulación de la interfaz. El prototipo no se conecta a ningún visor.
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

            <footer>
              <Boton
                bloque
                icono={<Check size={18} />}
                onClick={() => revisar('confirmada')}
                disabled={!hallazgo || guardando || hallazgo.revision === 'confirmada'}
              >
                Confirmar alerta
              </Boton>
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
          </>
        )}
      </aside>
    </>
  );
}
