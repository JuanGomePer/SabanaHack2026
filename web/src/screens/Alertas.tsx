/** 04 · Alertas (8:3326). */

import { useEffect, useMemo, useState } from 'react';
import { ArrowRight, BellRing, Camera, MessageSquare, Search } from 'lucide-react';
import type { Alerta, RevisionHallazgo, TipoHallazgo } from '@vigia/shared/tipos';
import { ETIQUETA_CIENTIFICA_TIPO } from '@vigia/shared/config';
import { Boton } from '../components/Boton';
import { Chip, type TonoChip } from '../components/Chip';
import { BarraConfianza } from '../components/BarraConfianza';
import { ResumenSms, useSms } from '../components/AvisosSms';
import { fechaHora, haceCuanto } from '../utilidades/formato';
import { urlDeApi } from '../api/cliente';

type Filtro = 'pendiente' | 'confirmada' | 'falsa_alarma' | 'todas';

const FILTROS: Array<{ id: Filtro; texto: string }> = [
  { id: 'pendiente', texto: 'Por revisar' },
  { id: 'confirmada', texto: 'Confirmadas' },
  { id: 'falsa_alarma', texto: 'Falsas alarmas' },
  { id: 'todas', texto: 'Todas' },
];

const TEXTO_REVISION: Record<RevisionHallazgo, string> = {
  pendiente: 'Por revisar',
  en_revision: 'En revisión',
  confirmada: 'Afectada',
  falsa_alarma: 'Falsa alarma',
};

const TONO_REVISION: Record<RevisionHallazgo, TonoChip> = {
  pendiente: 'alerta',
  en_revision: 'revision',
  confirmada: 'confirmada',
  falsa_alarma: 'neutro',
};

const TIPOS: Array<TipoHallazgo | 'Todos los tipos'> = [
  'Todos los tipos',
  'Botrytis',
  'Alternaria',
  'Trips',
];

/** Cada cuántos segundos se refresca la lista (lo dice el pie de la tabla). */
const SEGUNDOS_REFRESCO = 15;

interface Props {
  alertas: Alerta[];
  alAbrirPlanta: (plantaId: string) => void;
  alConfigurarAvisos: () => void;
  /** Para que "se actualiza sola" sea real: se llama cada SEGUNDOS_REFRESCO mientras esta pantalla está abierta. */
  alRecargar?: () => void | Promise<void>;
}

export function Alertas({ alertas, alAbrirPlanta, alConfigurarAvisos, alRecargar }: Props) {
  const [filtro, setFiltro] = useState<Filtro>('pendiente');
  const [busqueda, setBusqueda] = useState('');
  const [nave, setNave] = useState('Todas las naves');
  const [tipo, setTipo] = useState<string>('Todos los tipos');
  const sms = useSms();

  useEffect(() => {
    if (!alRecargar) return;
    const intervalo = window.setInterval(() => void alRecargar(), SEGUNDOS_REFRESCO * 1000);
    return () => window.clearInterval(intervalo);
  }, [alRecargar]);

  /** Alertas que ya salieron por mensaje de texto cuando el robot las detectó. */
  const avisadasPorSms = useMemo(
    () =>
      new Set(
        (sms.datos?.envios ?? [])
          .filter((envio) => envio.motivo === 'alerta')
          .map((envio) => envio.alertaId)
          .filter(Boolean),
      ),
    [sms.datos],
  );

  /** Alertas cuya decisión ya se le avisó a quien está en campo (segundo aviso). */
  const decisionAvisada = useMemo(
    () =>
      new Set(
        (sms.datos?.envios ?? [])
          .filter((envio) => envio.motivo === 'decision')
          .map((envio) => envio.alertaId)
          .filter(Boolean),
      ),
    [sms.datos],
  );

  const naves = useMemo(
    () => ['Todas las naves', ...[...new Set(alertas.map((a) => a.nave))].sort((a, b) => a - b).map((n) => `Nave ${n}`)],
    [alertas],
  );

  const visibles = useMemo(
    () =>
      alertas.filter((alerta) => {
        if (filtro !== 'todas' && alerta.revision !== filtro) return false;
        if (nave !== 'Todas las naves' && `Nave ${alerta.nave}` !== nave) return false;
        if (tipo !== 'Todos los tipos' && alerta.tipo !== tipo) return false;
        if (busqueda && !alerta.plantaId.toLowerCase().includes(busqueda.toLowerCase().replace(/\s/g, '')))
          return false;
        return true;
      }),
    [alertas, filtro, nave, tipo, busqueda],
  );

  const cuenta = (id: Filtro) =>
    id === 'todas' ? alertas.length : alertas.filter((a) => a.revision === id).length;

  return (
    <section>
      <ResumenSms datos={sms.datos} error={sms.error} alConfigurar={alConfigurarAvisos} />

      <div className="barra-filtros">
        <div className="grupo-filtros">
          {FILTROS.map(({ id, texto }) => (
            <button
              type="button"
              key={id}
              className={`filtro-pestana ${filtro === id ? 'activo' : ''}`}
              onClick={() => setFiltro(id)}
            >
              {texto}
              <span className={`badge ${id === 'pendiente' ? 'rojo' : ''}`}>{cuenta(id)}</span>
            </button>
          ))}
        </div>

        <label className="buscar">
          <Search size={18} strokeWidth={2} />
          <input
            value={busqueda}
            onChange={(evento) => setBusqueda(evento.target.value)}
            placeholder="Buscar planta (C14-P65)"
            aria-label="Buscar planta en las alertas"
          />
        </label>

        <select className="selector" value={nave} onChange={(e) => setNave(e.target.value)} aria-label="Nave">
          {naves.map((opcion) => (
            <option key={opcion}>{opcion}</option>
          ))}
        </select>

        <select className="selector" value={tipo} onChange={(e) => setTipo(e.target.value)} aria-label="Tipo de hallazgo">
          {TIPOS.map((opcion) => (
            <option key={opcion} value={opcion}>
              {opcion === 'Todos los tipos' ? opcion : ETIQUETA_CIENTIFICA_TIPO[opcion]}
            </option>
          ))}
        </select>
      </div>

      <div className="tarjeta" style={{ padding: '20px 10px 10px' }}>
        <table className="tabla">
          <thead>
            <tr>
              <th style={{ width: 86 }} />
              <th>Planta</th>
              <th>Hallazgo</th>
              <th style={{ width: 190 }}>Confianza</th>
              <th style={{ width: 130 }}>Detectada</th>
              <th style={{ width: 140 }}>Estado</th>
              <th style={{ width: 130 }} />
            </tr>
          </thead>
          <tbody>
            {visibles.map((alerta) => (
              <tr key={alerta.id}>
                <td>
                  <img className="miniatura" src={urlDeApi(alerta.fotoUrl)} alt="" />
                </td>
                <td>
                  <div className="columna">
                    <span className="txt-cuerpo-fuerte">{alerta.plantaId.replace(/^.*?-/, '').replace('P0', 'P')}</span>
                    <span className="apagado txt-pequeno">Nave {alerta.nave}</span>
                  </div>
                </td>
                <td>
                  <div className="columna">
                    <span className="txt-cuerpo-fuerte">{ETIQUETA_CIENTIFICA_TIPO[alerta.tipo]}</span>
                    <span className="apagado txt-pequeno fila" style={{ gap: 6 }}>
                      <Camera size={13} /> Cámara · robot X2
                    </span>
                  </div>
                </td>
                <td>
                  <BarraConfianza valor={alerta.confianza} />
                </td>
                <td className="secundario txt-pequeno" title={fechaHora(alerta.detectadoEn)}>
                  {haceCuanto(alerta.detectadoEn)}
                </td>
                <td>
                  <div className="columna" style={{ gap: 6, alignItems: 'flex-start' }}>
                    <Chip tono={TONO_REVISION[alerta.revision]}>
                      {TEXTO_REVISION[alerta.revision]}
                    </Chip>
                    {avisadasPorSms.has(alerta.id) && (
                      <span className="marca-sms txt-etiqueta" title="También se avisó por mensaje de texto">
                        <MessageSquare size={12} /> Avisada por SMS
                      </span>
                    )}
                    {decisionAvisada.has(alerta.id) && (
                      <span
                        className="marca-sms decision txt-etiqueta"
                        title="La decisión ya le llegó a quien está en campo, con las camas que hay que cuidar"
                      >
                        <BellRing size={12} /> Decisión avisada
                      </span>
                    )}
                  </div>
                </td>
                <td>
                  <Boton
                    variante="fantasma"
                    icono={<ArrowRight size={16} />}
                    onClick={() => alAbrirPlanta(alerta.plantaId)}
                  >
                    Ver planta
                  </Boton>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {visibles.length === 0 && <p className="cargando">No hay alertas con estos filtros.</p>}

        <div className="pie-tabla txt-pequeno">
          <span>
            Mostrando {visibles.length} de {alertas.length} alertas
          </span>
          <span className="apagado">Se actualiza sola cada {SEGUNDOS_REFRESCO} s</span>
        </div>
      </div>
    </section>
  );
}
