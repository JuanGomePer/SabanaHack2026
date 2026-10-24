/**
 * Barra lateral (5:3) con el ítem de navegación (3:120) y el estado del robot.
 * Los iconos son de lucide-react, que son los mismos del diseño
 * (map, bell, wind, clipboard, sliders, leaf, bot).
 */

import {
  Bell,
  BatteryCharging,
  Bot,
  ChartLine,
  ClipboardList,
  GraduationCap,
  Map,
  ShieldCheck,
  SlidersVertical,
  Wind,
} from 'lucide-react';
import type { EstadoRobot } from '@vigia/shared/tipos';

export type Pantalla =
  | 'mapa'
  | 'alertas'
  | 'analisis'
  | 'equipos'
  | 'registro'
  | 'configuracion'
  | 'como-llega'
  | 'como-estoy'
  | 'aprendizaje'
  | 'protocolos';

const ITEMS: Array<{ id: Pantalla; texto: string; Icono: typeof Map }> = [
  { id: 'mapa', texto: 'Tablero', Icono: Map },
  { id: 'alertas', texto: 'Alertas', Icono: Bell },
  { id: 'analisis', texto: 'Análisis', Icono: ChartLine },
  { id: 'equipos', texto: 'Equipos', Icono: Wind },
  { id: 'como-estoy', texto: 'Cómo estoy', Icono: BatteryCharging },
  { id: 'registro', texto: 'Registro', Icono: ClipboardList },
  { id: 'aprendizaje', texto: 'Aprendizaje', Icono: GraduationCap },
  { id: 'protocolos', texto: 'Protocolos', Icono: ShieldCheck },
  { id: 'configuracion', texto: 'Configuración', Icono: SlidersVertical },
];

interface Props {
  actual: Pantalla;
  alNavegar: (pantalla: Pantalla) => void;
  pendientes: number;
  robot?: EstadoRobot;
}

export function BarraLateral({ actual, alNavegar, pendientes, robot }: Props) {
  return (
    <aside className="barra-lateral">
      <div className="logo">
        <div className="logo-marca">
          <img src="/logo-mono.svg" alt="" width={24} height={22} />
        </div>
        <div className="columna">
          <span className="logo-nombre">Vigía</span>
          <span className="logo-sub txt-pequeno">Monitor de cultivo</span>
        </div>
      </div>

      <div className="seccion txt-sobretitulo">Menú</div>

      {ITEMS.map(({ id, texto, Icono }) => (
        <button
          key={id}
          type="button"
          className={`nav-item ${actual === id ? 'activo' : ''}`}
          onClick={() => alNavegar(id)}
          aria-current={actual === id ? 'page' : undefined}
        >
          <Icono size={20} strokeWidth={2} />
          <span className="texto">{texto}</span>
          {id === 'alertas' && pendientes > 0 && <span className="contador">{pendientes}</span>}
        </button>
      ))}

      <div className="espacio" />

      {robot && (
        <div className="robot">
          <div className="robot-fila">
            <Bot size={20} strokeWidth={2} />
            <div className="columna" style={{ flex: 1, minWidth: 0 }}>
              <span className="txt-pequeno-fuerte">
                {robot.nombre} · {robot.estado}
              </span>
              <span className="robot-sub txt-etiqueta">
                Nave {robot.nave} · batería {robot.bateria} %
              </span>
            </div>
          </div>
          <div className="pista">
            <div className="barra" style={{ width: `${robot.progreso}%` }} />
          </div>
          <span className="robot-pie txt-etiqueta">
            Ronda {robot.ronda} de {robot.rondasTotales} · {robot.progreso} %
          </span>
        </div>
      )}
    </aside>
  );
}
