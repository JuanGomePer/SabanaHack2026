/** Barra superior (5:53): título, buscador de planta, campana y menú de usuario. */

import { Bell, ChevronDown, LogOut, Search } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { USUARIO } from '@vigia/shared/config';
import type { PerfilUsuario } from '@vigia/shared/tipos';
import { inicialesDe } from '../utilidades/formato';

interface Props {
  titulo: string;
  subtitulo: string;
  pendientes: number;
  /** Nombre/rol editables en Configuración · Equipo y accesos. */
  perfil?: PerfilUsuario;
  /** Se llama al escribir una planta y pulsar Enter, ej. "C14-P62". */
  alBuscar?: (texto: string) => void;
  alAbrirAlertas?: () => void;
  alCerrarSesion?: () => void;
}

export function BarraSuperior({
  titulo,
  subtitulo,
  pendientes,
  perfil,
  alBuscar,
  alAbrirAlertas,
  alCerrarSesion,
}: Props) {
  const nombre = perfil?.nombre ?? USUARIO.nombre;
  const rol = perfil?.rol ?? USUARIO.rol;
  const [texto, setTexto] = useState('');
  const [menuAbierto, setMenuAbierto] = useState(false);
  const raizMenu = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!menuAbierto) return;
    const alClicFuera = (evento: MouseEvent) => {
      if (raizMenu.current && !raizMenu.current.contains(evento.target as Node)) setMenuAbierto(false);
    };
    const alEscape = (evento: KeyboardEvent) => {
      if (evento.key === 'Escape') setMenuAbierto(false);
    };
    document.addEventListener('mousedown', alClicFuera);
    document.addEventListener('keydown', alEscape);
    return () => {
      document.removeEventListener('mousedown', alClicFuera);
      document.removeEventListener('keydown', alEscape);
    };
  }, [menuAbierto]);

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

        <div className="menu-usuario" ref={raizMenu}>
          <button
            type="button"
            className="menu-usuario-boton"
            onClick={() => setMenuAbierto((v) => !v)}
            aria-haspopup="menu"
            aria-expanded={menuAbierto}
            aria-label={`Cuenta de ${nombre}`}
          >
            <span className="avatar" aria-hidden="true">
              {inicialesDe(nombre)}
            </span>
            <span className="menu-usuario-nombre txt-pequeno-fuerte">{nombre}</span>
            <ChevronDown size={14} />
          </button>

          {menuAbierto && (
            <div className="menu-usuario-lista" role="menu">
              <div className="menu-usuario-cabecera">
                <span className="txt-pequeno-fuerte">{nombre}</span>
                <span className="apagado txt-etiqueta">{rol}</span>
              </div>
              <button
                type="button"
                role="menuitem"
                className="menu-usuario-item"
                onClick={() => {
                  setMenuAbierto(false);
                  alCerrarSesion?.();
                }}
              >
                <LogOut size={16} />
                Cerrar sesión
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
