/** Barra superior (5:53): título, buscador de planta, campana y avatar. */

import { Bell, Search } from 'lucide-react';
import { useState } from 'react';
import { USUARIO } from '@vigia/shared/config';

interface Props {
  titulo: string;
  subtitulo: string;
  pendientes: number;
  /** Se llama al escribir una planta y pulsar Enter, ej. "C14-P62". */
  alBuscar?: (texto: string) => void;
  alAbrirAlertas?: () => void;
}

export function BarraSuperior({
  titulo,
  subtitulo,
  pendientes,
  alBuscar,
  alAbrirAlertas,
}: Props) {
  const [texto, setTexto] = useState('');

  return (
    <header className="barra-superior">
      <div className="columna">
        <h1 className="txt-pagina" style={{ margin: 0 }}>
          {titulo}
        </h1>
        <p className="subtitulo txt-pequeno" style={{ margin: '2px 0 0' }}>
          {subtitulo}
        </p>
      </div>

      <div className="acciones">
        <form
          className="buscar"
          onSubmit={(evento) => {
            evento.preventDefault();
            if (texto.trim()) alBuscar?.(texto.trim());
          }}
        >
          <Search size={18} strokeWidth={2} />
          <input
            value={texto}
            onChange={(evento) => setTexto(evento.target.value)}
            placeholder="Ir a planta… (ej. C14-P62)"
            aria-label="Buscar planta"
          />
        </form>

        <button
          type="button"
          className="icono-boton"
          onClick={alAbrirAlertas}
          aria-label={`Alertas${pendientes > 0 ? `, ${pendientes} pendientes` : ''}`}
        >
          <Bell size={20} strokeWidth={2} />
          {pendientes > 0 && <span className="contador">{pendientes}</span>}
        </button>

        <div className="avatar" title={`${USUARIO.nombre} · ${USUARIO.rol}`}>
          {USUARIO.iniciales}
        </div>
      </div>
    </header>
  );
}
