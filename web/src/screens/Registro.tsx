/** 07 · Registro de incidencias (8:4052). */

import { useMemo, useState } from 'react';
import { Calendar, Download, Search } from 'lucide-react';
import type { RegistroRespuesta, RevisionHallazgo, TipoHallazgo } from '@vigia/shared/tipos';
import { ETIQUETA_CIENTIFICA_TIPO } from '@vigia/shared/config';
import { Boton } from '../components/Boton';
import { Chip, type TonoChip } from '../components/Chip';
import { BarraConfianza } from '../components/BarraConfianza';
import { ModalExportarRegistro } from '../components/ModalExportarRegistro';
import { TarjetaKpi } from '../components/TarjetaKpi';
import { fechaHora, numero } from '../utilidades/formato';

const TEXTO_DECISION: Record<RevisionHallazgo, string> = {
  pendiente: 'Por revisar',
  en_revision: 'En revisión',
  confirmada: 'Afectada',
  falsa_alarma: 'Falsa alarma',
};

const TONO_DECISION: Record<RevisionHallazgo, TonoChip> = {
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

const DECISIONES = ['Todas las decisiones', 'Confirmada', 'Falsa alarma', 'Por revisar'];

/** Cuántas filas se ven sin desplazar la tabla. */
const FILAS_VISIBLES = 12;

export function Registro({ datos }: { datos: RegistroRespuesta }) {
  const [tipo, setTipo] = useState<string>('Todos los tipos');
  const [decision, setDecision] = useState<string>('Todas las decisiones');
  const [busqueda, setBusqueda] = useState('');
  const [exportando, setExportando] = useState(false);

  const filtradas = useMemo(
    () =>
      datos.filas.filter((fila) => {
        if (tipo !== 'Todos los tipos' && fila.tipo !== tipo) return false;
        if (decision !== 'Todas las decisiones' && TEXTO_DECISION[fila.decision] !== decision)
          return false;
        if (busqueda && !fila.etiqueta.toLowerCase().includes(busqueda.toLowerCase().replace(/\s/g, '')))
          return false;
        return true;
      }),
    [datos.filas, tipo, decision, busqueda],
  );

  const visibles = filtradas.slice(0, FILAS_VISIBLES);
  const { resumen } = datos;

  return (
    <section>
      <div className="kpis">
        <TarjetaKpi
          etiqueta="Hallazgos en la semana"
          valor={numero(resumen.hallazgos)}
          detalle={resumen.semana}
        />
        <TarjetaKpi
          tono="ok"
          etiqueta="Confirmados por el agrónomo"
          valor={numero(resumen.confirmados)}
          detalle={`${Math.round((resumen.confirmados / Math.max(resumen.hallazgos, 1)) * 100)} % del total`}
        />
        <TarjetaKpi
          tono="riesgo"
          etiqueta="Falsas alarmas"
          valor={numero(resumen.falsasAlarmas)}
          detalle="Descartadas con un clic"
        />
        <TarjetaKpi
          etiqueta="Precisión del robot"
          valor={`${resumen.precision} %`}
          detalle={`${resumen.confirmados} de ${resumen.confirmados + resumen.falsasAlarmas} hallazgos revisados`}
        />
      </div>

      <div className="barra-filtros">
        <span className="selector estatico">
          <Calendar size={17} strokeWidth={2} />
          {resumen.semana}
        </span>

        <select className="selector" value={tipo} onChange={(e) => setTipo(e.target.value)} aria-label="Tipo de hallazgo">
          {TIPOS.map((opcion) => (
            <option key={opcion} value={opcion}>
              {opcion === 'Todos los tipos' ? opcion : ETIQUETA_CIENTIFICA_TIPO[opcion]}
            </option>
          ))}
        </select>

        <select
          className="selector"
          value={decision}
          onChange={(e) => setDecision(e.target.value)}
          aria-label="Decisión"
        >
          {DECISIONES.map((opcion) => (
            <option key={opcion}>{opcion}</option>
          ))}
        </select>

        <label className="buscar">
          <Search size={18} strokeWidth={2} />
          <input
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            placeholder="Buscar planta"
            aria-label="Buscar planta en el registro"
          />
        </label>

        <div style={{ flex: 1 }} />

        <Boton icono={<Download size={17} />} onClick={() => setExportando(true)}>
          Exportar CSV
        </Boton>
      </div>

      {exportando && <ModalExportarRegistro filas={filtradas} onCerrar={() => setExportando(false)} />}

      <div className="tarjeta" style={{ padding: '20px 10px 10px' }}>
        <table className="tabla">
          <thead>
            <tr>
              <th style={{ width: 150 }}>Fecha y hora</th>
              <th style={{ width: 120 }}>Planta</th>
              <th style={{ width: 110 }}>Nave</th>
              <th>Hallazgo</th>
              <th style={{ width: 200 }}>Confianza</th>
              <th style={{ width: 150 }}>Decisión</th>
              <th style={{ width: 200 }}>Revisó</th>
            </tr>
          </thead>
          <tbody>
            {visibles.map((fila) => (
              <tr key={fila.id}>
                <td className="secundario txt-pequeno">{fechaHora(fila.fecha)}</td>
                <td className="txt-cuerpo-fuerte">{fila.etiqueta}</td>
                <td className="secundario txt-pequeno">Nave {fila.nave}</td>
                <td className="txt-pequeno">{ETIQUETA_CIENTIFICA_TIPO[fila.tipo]}</td>
                <td>
                  <BarraConfianza valor={fila.confianza} />
                </td>
                <td>
                  <Chip tono={TONO_DECISION[fila.decision]}>{TEXTO_DECISION[fila.decision]}</Chip>
                </td>
                <td className="secundario txt-pequeno">{fila.reviso ?? '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>

        {visibles.length === 0 && <p className="cargando">No hay hallazgos con estos filtros.</p>}

        <div className="pie-tabla txt-pequeno">
          <span>
            Mostrando {visibles.length} de {filtradas.length} hallazgos
          </span>
          <span className="apagado">
            El archivo CSV trae cama, planta, tipo, confianza, hora y decisión.
          </span>
        </div>
      </div>
    </section>
  );
}
