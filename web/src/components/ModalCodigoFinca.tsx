/**
 * "Entrar con el código de la finca": en el prototipo no hay un directorio
 * real de fincas, así que solo reconoce el código de la finca de ejemplo
 * (AGRAR-B5) — con cualquier otro, se dice explícitamente que no se
 * reconoce, en vez de fingir que cualquier código funciona.
 */
import { useMemo, useState } from 'react';
import { ArrowRight, Building2, CircleCheck, CircleX } from 'lucide-react';
import { Boton } from './Boton';
import { Modal } from './Modal';

const CODIGO_VALIDO = 'AGRAR-B5';
const FINCA_DEMO = { nombre: 'Finca El Roble (demo)', bloque: 'Bloque B5', ubicacion: 'Rionegro, Antioquia' };

interface Props {
  onCerrar: () => void;
  alEntrar: () => void;
}

export function ModalCodigoFinca({ onCerrar, alEntrar }: Props) {
  const [codigo, setCodigo] = useState('');

  const normalizado = codigo.trim().toUpperCase();
  const valido = normalizado === CODIGO_VALIDO;
  const tieneTexto = normalizado.length > 0;

  const estado = useMemo(() => {
    if (!tieneTexto) return 'vacio' as const;
    return valido ? ('valido' as const) : ('invalido' as const);
  }, [tieneTexto, valido]);

  return (
    <Modal
      titulo="Entrar con el código de la finca"
      subtitulo="El código lo da tu encargado de cuenta en Agrar al activar la finca."
      onCerrar={onCerrar}
    >
      <form
        className="columna"
        style={{ gap: 14 }}
        onSubmit={(evento) => {
          evento.preventDefault();
          if (valido) alEntrar();
        }}
      >
        <label className="columna" style={{ gap: 6 }}>
          <span className="txt-pequeno-fuerte">Código de la finca</span>
          <input
            type="text"
            className="campo-texto"
            placeholder="Ej. AGRAR-B5"
            value={codigo}
            onChange={(evento) => setCodigo(evento.target.value)}
            autoFocus
            style={{ textTransform: 'uppercase', letterSpacing: '0.04em' }}
          />
        </label>

        {estado !== 'vacio' && (
          <div className={`previa-finca ${estado}`}>
            {estado === 'valido' ? (
              <>
                <span className="previa-finca-icono ok">
                  <CircleCheck size={18} />
                </span>
                <div className="columna" style={{ gap: 2, minWidth: 0 }}>
                  <span className="txt-pequeno-fuerte">{FINCA_DEMO.nombre}</span>
                  <span className="apagado txt-etiqueta">
                    {FINCA_DEMO.bloque} · {FINCA_DEMO.ubicacion}
                  </span>
                </div>
              </>
            ) : (
              <>
                <span className="previa-finca-icono mal">
                  <CircleX size={18} />
                </span>
                <span className="txt-pequeno secundario">
                  No reconocemos ese código. Para esta demo, usa <strong>{CODIGO_VALIDO}</strong>.
                </span>
              </>
            )}
          </div>
        )}

        {estado === 'vacio' && (
          <div className="previa-finca vacio">
            <span className="previa-finca-icono">
              <Building2 size={18} />
            </span>
            <span className="txt-pequeno secundario">Escribe el código para ver a qué finca entras.</span>
          </div>
        )}

        <Boton bloque type="submit" disabled={!valido} iconoDerecha={<ArrowRight size={18} />}>
          Entrar a {valido ? FINCA_DEMO.bloque : 'la finca'}
        </Boton>
      </form>
    </Modal>
  );
}
