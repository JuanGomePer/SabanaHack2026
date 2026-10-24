/**
 * Casilla por equipo para apagarlo sin salir del protocolo.
 *
 * Es el paso 1 de los tres protocolos: con el aire en movimiento, lo que
 * encontró el robot se reparte a las camas vecinas. Marcar la casilla apaga el
 * equipo de verdad (PATCH /api/equipos/:id) y el programador deja de
 * encenderlo solo hasta que alguien lo desmarque.
 */
import { Check, Cpu, Droplets, Fan, LogOut, RotateCw, Wind } from 'lucide-react';
import type { Equipo, IconoEquipo } from '@vigia/shared/tipos';

const ICONOS: Record<IconoEquipo, typeof Fan> = {
  fan: Fan,
  rotate: RotateCw,
  wind: Wind,
  extract: LogOut,
  droplet: Droplets,
  cpu: Cpu,
};

interface Props {
  equipos: Equipo[];
  /** Nave donde se concentran los hallazgos de este tipo, si hay alguno. */
  naveFoco?: number;
  /** Id del equipo que se está apagando ahora mismo. */
  ocupado?: string;
  alCambiar: (id: string, desactivado: boolean) => void;
}

export function ApagarEquipos({ equipos, naveFoco, ocupado, alCambiar }: Props) {
  if (equipos.length === 0) {
    return (
      <p className="apagado txt-pequeno" style={{ margin: '10px 0 0' }}>
        No se pudo leer el estado de los equipos.
      </p>
    );
  }

  // Primero los de la nave donde están los hallazgos de este tipo.
  const ordenados = [...equipos].sort((a, b) => {
    const pesoA = a.nave === naveFoco ? 0 : 1;
    const pesoB = b.nave === naveFoco ? 0 : 1;
    return pesoA - pesoB || a.id.localeCompare(b.id);
  });

  const encendidos = ordenados.filter(
    (e) => !e.desactivado && (e.estado === 'En marcha' || e.estado === 'Activo'),
  ).length;

  return (
    <div className="apagar-equipos">
      <div className="fila-entre">
        <span className="txt-pequeno-fuerte">Equipos que hay que apagar</span>
        <span className="apagado txt-etiqueta">
          {encendidos === 0
            ? 'Todo apagado o en espera'
            : `${encendidos} encendido${encendidos === 1 ? '' : 's'}`}
        </span>
      </div>

      <ul className="apagar-lista">
        {ordenados.map((equipo) => {
          const Icono = ICONOS[equipo.icono];
          const sinRespuesta = equipo.estado === 'Aviso';
          return (
            <li key={equipo.id}>
              <button
                type="button"
                className="fila casilla"
                disabled={sinRespuesta || ocupado === equipo.id}
                aria-pressed={equipo.desactivado}
                onClick={() => alCambiar(equipo.id, !equipo.desactivado)}
              >
                <span className={`marca ${equipo.desactivado ? 'activa' : ''}`}>
                  {equipo.desactivado && <Check size={12} strokeWidth={3} />}
                </span>
                <Icono size={15} />
                <span className="columna" style={{ alignItems: 'flex-start' }}>
                  <span className="txt-pequeno-fuerte">{equipo.tipo}</span>
                  <span className="apagado txt-etiqueta">
                    Nave {equipo.nave}
                    {equipo.nave === naveFoco ? ' · donde están los hallazgos' : ''} ·{' '}
                    {sinRespuesta
                      ? 'no responde'
                      : equipo.desactivado
                        ? 'apagado a mano'
                        : equipo.estado.toLowerCase()}
                  </span>
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
