/**
 * Selector de indicativo telefónico (dropdown con bandera + código).
 *
 * Las banderas son emoji — no hay ninguna imagen que cargar, así que no hay
 * nada que pueda fallar al abrir la lista ni que dependa de tener internet.
 */
import { useEffect, useRef, useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { PAISES_TELEFONO } from '@vigia/shared/config';
import type { PaisTelefono } from '@vigia/shared/tipos';

interface Props {
  pais: PaisTelefono;
  alCambiar: (pais: PaisTelefono) => void;
}

export function SelectorPaisTelefono({ pais, alCambiar }: Props) {
  const [abierto, setAbierto] = useState(false);
  const raiz = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!abierto) return;
    const alClicFuera = (evento: MouseEvent) => {
      if (raiz.current && !raiz.current.contains(evento.target as Node)) setAbierto(false);
    };
    const alEscape = (evento: KeyboardEvent) => {
      if (evento.key === 'Escape') setAbierto(false);
    };
    document.addEventListener('mousedown', alClicFuera);
    document.addEventListener('keydown', alEscape);
    return () => {
      document.removeEventListener('mousedown', alClicFuera);
      document.removeEventListener('keydown', alEscape);
    };
  }, [abierto]);

  return (
    <div className="selector-pais" ref={raiz}>
      <button
        type="button"
        className="selector-pais-boton"
        onClick={() => setAbierto((v) => !v)}
        aria-haspopup="listbox"
        aria-expanded={abierto}
        aria-label={`Indicativo: ${pais.nombre} ${pais.codigo}`}
      >
        <span aria-hidden="true">{pais.bandera}</span>
        <span>{pais.codigo}</span>
        <ChevronDown size={14} />
      </button>

      {abierto && (
        <ul className="selector-pais-lista" role="listbox" aria-label="Elegir país">
          {PAISES_TELEFONO.map((p) => (
            <li key={p.nombre}>
              <button
                type="button"
                role="option"
                aria-selected={p.codigo === pais.codigo}
                className={p.codigo === pais.codigo ? 'activo' : ''}
                onClick={() => {
                  alCambiar(p);
                  setAbierto(false);
                }}
              >
                <span aria-hidden="true">{p.bandera}</span>
                <span className="selector-pais-nombre">{p.nombre}</span>
                <span className="apagado">{p.codigo}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
