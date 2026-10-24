/**
 * Simulación de "tratar vs. no tratar" un hallazgo (vigIA).
 *
 * Es una proyección estimada con reglas simples, no un modelo epidemiológico
 * real — el texto de abajo lo deja explícito, igual que el servidor.
 */
import { useState } from 'react';
import { AlertTriangle, CheckCircle2, FlaskConical, Loader2 } from 'lucide-react';
import type { SimulacionRespuesta } from '@vigia/shared/tipos';
import { api } from '../api/cliente';
import { Boton } from './Boton';

interface Props {
  hallazgoId: string;
}

function Barra({ sanas, riesgo, alerta }: { sanas: number; riesgo: number; alerta: number }) {
  const total = Math.max(1, sanas + riesgo + alerta);
  return (
    <div className="barra-simulacion" title={`${sanas} sanas · ${riesgo} en riesgo · ${alerta} en alerta`}>
      <span className="segmento ok" style={{ width: `${(sanas / total) * 100}%` }} />
      <span className="segmento riesgo" style={{ width: `${(riesgo / total) * 100}%` }} />
      <span className="segmento alerta" style={{ width: `${(alerta / total) * 100}%` }} />
    </div>
  );
}

export function SimulacionTratamiento({ hallazgoId }: Props) {
  const [abierto, setAbierto] = useState(false);
  const [cargando, setCargando] = useState(false);
  const [resultado, setResultado] = useState<SimulacionRespuesta>();
  const [error, setError] = useState<string>();

  async function correr() {
    setAbierto(true);
    setCargando(true);
    setError(undefined);
    try {
      setResultado(await api.simular(hallazgoId, 7));
    } catch {
      setError('No se pudo correr la simulación.');
    } finally {
      setCargando(false);
    }
  }

  return (
    <div className="simulacion-tratamiento">
      <button type="button" className="simulacion-disparador" onClick={() => (abierto ? setAbierto(false) : correr())}>
        <FlaskConical size={16} />
        <span>{abierto ? 'Ocultar simulación' : 'Simular: ¿y si no se trata?'}</span>
      </button>

      {abierto && (
        <div className="simulacion-panel">
          {cargando && (
            <p className="cargando">
              <Loader2 size={14} className="girando" /> Corriendo la proyección…
            </p>
          )}
          {error && <p className="error-sms txt-pequeno">{error}</p>}

          {resultado && (
            <>
              <div className="simulacion-columnas">
                <div className="simulacion-columna tratada">
                  <div className="fila" style={{ gap: 6 }}>
                    <CheckCircle2 size={16} color="var(--color-status-ok-fg)" />
                    <span className="txt-cuerpo-peq-fuerte">Tratada a tiempo</span>
                  </div>
                  {resultado.tratada.map((dia) => (
                    <div key={dia.dia} className="simulacion-dia">
                      <span className="txt-etiqueta apagado">Día {dia.dia}</span>
                      <Barra sanas={dia.sanas} riesgo={dia.riesgo} alerta={dia.alerta} />
                    </div>
                  ))}
                  <p className="txt-pequeno" style={{ margin: '6px 0 0' }}>{resultado.resumen.tratada}</p>
                </div>

                <div className="simulacion-columna no-tratada">
                  <div className="fila" style={{ gap: 6 }}>
                    <AlertTriangle size={16} color="var(--color-status-alert-fg)" />
                    <span className="txt-cuerpo-peq-fuerte">Sin tratar</span>
                  </div>
                  {resultado.noTratada.map((dia) => (
                    <div key={dia.dia} className="simulacion-dia">
                      <span className="txt-etiqueta apagado">
                        Día {dia.dia}
                        {dia.nuevasAfectadas.length > 0 ? ` · +${dia.nuevasAfectadas.length}` : ''}
                      </span>
                      <Barra sanas={dia.sanas} riesgo={dia.riesgo} alerta={dia.alerta} />
                    </div>
                  ))}
                  <p className="txt-pequeno" style={{ margin: '6px 0 0' }}>{resultado.resumen.noTratada}</p>
                </div>
              </div>

              <p className="apagado txt-etiqueta" style={{ marginTop: 8 }}>{resultado.nota}</p>
            </>
          )}
        </div>
      )}
    </div>
  );
}
