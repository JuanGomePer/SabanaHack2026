/** Modal genérico: overlay + tarjeta, Escape y clic afuera para cerrar. */
import { useEffect, useRef } from 'react';
import { X } from 'lucide-react';

interface Props {
  titulo: string;
  subtitulo?: string;
  onCerrar: () => void;
  children: React.ReactNode;
  ancho?: number;
}

export function Modal({ titulo, subtitulo, onCerrar, children, ancho = 440 }: Props) {
  const raiz = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const alEscape = (evento: KeyboardEvent) => {
      if (evento.key === 'Escape') onCerrar();
    };
    document.addEventListener('keydown', alEscape);
    return () => document.removeEventListener('keydown', alEscape);
  }, [onCerrar]);

  return (
    <div
      className="modal-fondo"
      onMouseDown={(evento) => {
        if (evento.target === raiz.current) onCerrar();
      }}
      ref={raiz}
    >
      <div className="modal-tarjeta" style={{ maxWidth: ancho }} role="dialog" aria-modal="true" aria-label={titulo}>
        <div className="modal-cabecera">
          <div className="columna" style={{ gap: 2 }}>
            <h2 className="txt-cuerpo-fuerte" style={{ fontSize: 17 }}>
              {titulo}
            </h2>
            {subtitulo && (
              <p className="secundario txt-pequeno" style={{ margin: 0 }}>
                {subtitulo}
              </p>
            )}
          </div>
          <button type="button" className="cerrar" onClick={onCerrar} aria-label="Cerrar">
            <X size={18} />
          </button>
        </div>
        <div className="modal-cuerpo">{children}</div>
      </div>
    </div>
  );
}
