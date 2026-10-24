/**
 * Exportar registro: filtra por fecha (además de lo que ya esté filtrado en
 * la tabla: tipo, decisión, búsqueda) y arma el CSV en el navegador, a
 * partir de las filas que ya están cargadas — no hace falta otra llamada al
 * servidor.
 */
import { useMemo, useState } from 'react';
import { Download } from 'lucide-react';
import type { FilaRegistro } from '@vigia/shared/tipos';
import { ETIQUETA_CIENTIFICA_TIPO } from '@vigia/shared/config';
import { Boton } from './Boton';
import { Modal } from './Modal';
import { numero } from '../utilidades/formato';

const PRESETS = ['Hoy', '7 días', '30 días', 'Todo', 'Rango'] as const;
type Preset = (typeof PRESETS)[number];

function iniciaDeHoy(diasAtras: number): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - diasAtras);
  return d;
}

function aCsv(filas: FilaRegistro[]): string {
  const cabecera = ['fecha', 'cama', 'planta', 'nave', 'tipo', 'confianza', 'decision', 'reviso'];
  const cuerpo = filas.map((f) =>
    [f.fecha, f.cama, f.plantaId.split('-P')[1], f.nave, f.tipo, f.confianza.toFixed(2), f.decision, f.reviso ?? ''].join(
      ',',
    ),
  );
  return [cabecera.join(','), ...cuerpo].join('\n');
}

interface Props {
  filas: FilaRegistro[];
  onCerrar: () => void;
}

export function ModalExportarRegistro({ filas, onCerrar }: Props) {
  const [preset, setPreset] = useState<Preset>('30 días');
  const [desde, setDesde] = useState(() => iniciaDeHoy(30).toISOString().slice(0, 10));
  const [hasta, setHasta] = useState(() => new Date().toISOString().slice(0, 10));

  const filtradas = useMemo(() => {
    if (preset === 'Todo') return filas;
    const desdeMs = preset === 'Rango' ? new Date(desde).getTime() : iniciaDeHoy(preset === 'Hoy' ? 0 : preset === '7 días' ? 7 : 30).getTime();
    const hastaMs = preset === 'Rango' ? new Date(hasta + 'T23:59:59').getTime() : Date.now();
    return filas.filter((f) => {
      const t = Date.parse(f.fecha);
      return t >= desdeMs && t <= hastaMs;
    });
  }, [filas, preset, desde, hasta]);

  const porTipo = useMemo(() => {
    const conteo = new Map<string, number>();
    for (const f of filtradas) conteo.set(f.tipo, (conteo.get(f.tipo) ?? 0) + 1);
    return [...conteo.entries()];
  }, [filtradas]);

  function exportar() {
    const csv = aCsv(filtradas);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `registro-vigia-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    onCerrar();
  }

  return (
    <Modal titulo="Exportar registro" subtitulo="Elige el periodo que quieres llevarte a CSV." onCerrar={onCerrar}>
      <div className="columna" style={{ gap: 14 }}>
        <div className="exportar-presets">
          {PRESETS.map((opcion) => (
            <button
              key={opcion}
              type="button"
              className={`exportar-preset ${preset === opcion ? 'activo' : ''}`}
              onClick={() => setPreset(opcion)}
            >
              {opcion}
            </button>
          ))}
        </div>

        {preset === 'Rango' && (
          <div className="fila" style={{ gap: 10 }}>
            <label className="columna" style={{ gap: 6, flex: 1 }}>
              <span className="txt-pequeno-fuerte">Desde</span>
              <input type="date" className="campo-texto" value={desde} onChange={(e) => setDesde(e.target.value)} />
            </label>
            <label className="columna" style={{ gap: 6, flex: 1 }}>
              <span className="txt-pequeno-fuerte">Hasta</span>
              <input type="date" className="campo-texto" value={hasta} onChange={(e) => setHasta(e.target.value)} />
            </label>
          </div>
        )}

        <div className="previa-finca vacio" style={{ alignItems: 'flex-start' }}>
          <span className="previa-finca-icono ok">
            <Download size={16} />
          </span>
          <div className="columna" style={{ gap: 4, minWidth: 0 }}>
            <span className="txt-pequeno-fuerte">
              {numero(filtradas.length)} hallazgo{filtradas.length === 1 ? '' : 's'} en este periodo
            </span>
            {porTipo.length > 0 ? (
              <span className="apagado txt-etiqueta">
                {porTipo
                  .map(([tipo, n]) => `${ETIQUETA_CIENTIFICA_TIPO[tipo as keyof typeof ETIQUETA_CIENTIFICA_TIPO] ?? tipo}: ${n}`)
                  .join(' · ')}
              </span>
            ) : (
              <span className="apagado txt-etiqueta">No hay hallazgos en ese rango.</span>
            )}
          </div>
        </div>

        <Boton bloque icono={<Download size={18} />} onClick={exportar} disabled={filtradas.length === 0}>
          Descargar CSV
        </Boton>
      </div>
    </Modal>
  );
}
