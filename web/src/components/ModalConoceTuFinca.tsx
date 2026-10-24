/**
 * "Conoce tu finca": onboarding corto y gamificado desde el login, antes de
 * crear la cuenta. Son preguntas para PERSONALIZAR la demo (qué le importa
 * al visitante, cuántas hectáreas tiene) — no hay ningún backend de cuentas
 * nuevas todavía, así que al final entra a la misma demo que el resto de la
 * app, con sus respuestas resumidas en pantalla primero.
 */
import { useState } from 'react';
import {
  ArrowRight,
  Bug,
  Building2,
  Check,
  Droplets,
  Gauge,
  Lock,
  Mail,
  Sparkles,
  Sprout,
  Trophy,
  User,
} from 'lucide-react';
import { Boton } from './Boton';
import { Modal } from './Modal';

const NECESIDADES = [
  { id: 'enfermedades', texto: 'Detectar enfermedades y plagas a tiempo', Icono: Bug },
  { id: 'riego', texto: 'Controlar la humedad y el riego', Icono: Droplets },
  { id: 'rendimiento', texto: 'Entender el rendimiento de la cosecha', Icono: Gauge },
  { id: 'equipos', texto: 'Vigilar el estado de los equipos', Icono: Building2 },
] as const;

type IdNecesidad = (typeof NECESIDADES)[number]['id'];

function nivelDe(hectareas: number): { texto: string; emoji: string } {
  if (hectareas <= 0) return { texto: 'Por definir', emoji: '🌱' };
  if (hectareas < 1) return { texto: 'Finca semillero', emoji: '🌱' };
  if (hectareas < 5) return { texto: 'Finca en marcha', emoji: '🌿' };
  if (hectareas < 20) return { texto: 'Finca consolidada', emoji: '🌳' };
  return { texto: 'Operación grande', emoji: '🏆' };
}

const TOTAL_PASOS = 4;

interface Props {
  onCerrar: () => void;
  alEntrar: () => void;
}

export function ModalConoceTuFinca({ onCerrar, alEntrar }: Props) {
  const [paso, setPaso] = useState(0);
  const [necesidades, setNecesidades] = useState<Set<IdNecesidad>>(new Set());
  const [hectareas, setHectareas] = useState<number>();
  const [naves, setNaves] = useState<number>();
  const [finca, setFinca] = useState('');
  const [nombre, setNombre] = useState('');
  const [correo, setCorreo] = useState('');

  function alternarNecesidad(id: IdNecesidad) {
    setNecesidades((actual) => {
      const nuevo = new Set(actual);
      if (nuevo.has(id)) nuevo.delete(id);
      else nuevo.add(id);
      return nuevo;
    });
  }

  const nivel = nivelDe(hectareas ?? 0);
  const puedeAvanzar = [
    necesidades.size > 0,
    (hectareas ?? 0) > 0 && (naves ?? 0) > 0,
    true,
    nombre.trim().length > 0 && correo.trim().length > 0,
  ][paso];

  return (
    <Modal titulo="Conoce tu finca" subtitulo={`Paso ${paso + 1} de ${TOTAL_PASOS}`} onCerrar={onCerrar} ancho={480}>
      <div className="wizard-progreso">
        {Array.from({ length: TOTAL_PASOS }, (_, i) => (
          <span key={i} className={`wizard-punto ${i <= paso ? 'activo' : ''}`} />
        ))}
      </div>

      {paso === 0 && (
        <div className="columna" style={{ gap: 14 }}>
          <p className="txt-cuerpo secundario" style={{ margin: 0 }}>
            Vigía se adapta a cada finca. Cuéntanos qué te gustaría vigilar más — puedes elegir varias.
          </p>
          <div className="wizard-opciones">
            {NECESIDADES.map(({ id, texto, Icono }) => {
              const activa = necesidades.has(id);
              return (
                <button
                  key={id}
                  type="button"
                  className={`wizard-opcion ${activa ? 'activa' : ''}`}
                  onClick={() => alternarNecesidad(id)}
                  aria-pressed={activa}
                >
                  <Icono size={18} />
                  <span className="txt-pequeno-fuerte">{texto}</span>
                  {activa && <Check size={16} className="wizard-opcion-check" />}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {paso === 1 && (
        <div className="columna" style={{ gap: 14 }}>
          <p className="txt-cuerpo secundario" style={{ margin: 0 }}>
            Ahora el tamaño de tu cultivo, para calcular todo a tu escala (como en Configuración → Optimizar
            terreno).
          </p>
          <label className="columna" style={{ gap: 6 }}>
            <span className="txt-pequeno-fuerte">¿Cuántas hectáreas tienes?</span>
            <input
              type="number"
              className="campo-texto"
              min={0}
              step="0.1"
              value={hectareas ?? ''}
              onChange={(e) => setHectareas(e.target.value === '' ? undefined : Number(e.target.value))}
              autoFocus
            />
          </label>
          <label className="columna" style={{ gap: 6 }}>
            <span className="txt-pequeno-fuerte">¿Cuántas naves o bloques quieres vigilar?</span>
            <input
              type="number"
              className="campo-texto"
              min={0}
              value={naves ?? ''}
              onChange={(e) => setNaves(e.target.value === '' ? undefined : Number(e.target.value))}
            />
          </label>
          {hectareas !== undefined && hectareas > 0 && (
            <div className="wizard-nivel">
              <span style={{ fontSize: 22 }}>{nivel.emoji}</span>
              <span className="txt-pequeno-fuerte">{nivel.texto}</span>
            </div>
          )}
        </div>
      )}

      {paso === 2 && (
        <div className="columna" style={{ gap: 16, alignItems: 'center', textAlign: 'center', padding: '8px 0' }}>
          <span className="wizard-trofeo">
            <Trophy size={28} />
          </span>
          <h3 className="txt-cuerpo-fuerte" style={{ margin: 0, fontSize: 18 }}>
            {nivel.emoji} {nivel.texto}
          </h3>
          <p className="secundario txt-pequeno" style={{ margin: 0 }}>
            Así quedaría tu finca en Vigía:
          </p>
          <div className="wizard-resumen">
            <div className="wizard-resumen-fila">
              <Sprout size={15} />
              <span className="txt-pequeno">
                {hectareas ?? 0} ha · {naves ?? 0} nave{(naves ?? 0) === 1 ? '' : 's'}
              </span>
            </div>
            <div className="wizard-resumen-fila">
              <Sparkles size={15} />
              <span className="txt-pequeno">
                {necesidades.size > 0
                  ? NECESIDADES.filter((n) => necesidades.has(n.id))
                      .map((n) => n.texto)
                      .join(' · ')
                  : 'Sin prioridades elegidas'}
              </span>
            </div>
          </div>
          <label className="columna" style={{ gap: 6, width: '100%', textAlign: 'left' }}>
            <span className="txt-pequeno-fuerte">Nombre de tu finca (opcional)</span>
            <input
              type="text"
              className="campo-texto"
              value={finca}
              onChange={(e) => setFinca(e.target.value)}
              placeholder="Finca El Roble"
            />
          </label>
        </div>
      )}

      {paso === 3 && (
        <div className="columna" style={{ gap: 14 }}>
          <p className="txt-cuerpo secundario" style={{ margin: 0 }}>
            Por último, crea tu cuenta para entrar con {finca || 'tu finca'} ya configurada.
          </p>
          <label className="columna" style={{ gap: 6 }}>
            <span className="txt-pequeno-fuerte">Tu nombre</span>
            <span className="campo-icono">
              <User size={18} strokeWidth={2} />
              <input value={nombre} onChange={(e) => setNombre(e.target.value)} autoFocus />
            </span>
          </label>
          <label className="columna" style={{ gap: 6 }}>
            <span className="txt-pequeno-fuerte">Correo</span>
            <span className="campo-icono">
              <Mail size={18} strokeWidth={2} />
              <input type="email" value={correo} onChange={(e) => setCorreo(e.target.value)} />
            </span>
          </label>
          <label className="columna" style={{ gap: 6 }}>
            <span className="txt-pequeno-fuerte">Contraseña</span>
            <span className="campo-icono">
              <Lock size={18} strokeWidth={2} />
              <input type="password" defaultValue="arandanos" />
            </span>
          </label>
        </div>
      )}

      <div className="fila-entre wizard-acciones">
        {paso > 0 ? (
          <Boton variante="secundario" onClick={() => setPaso((p) => p - 1)}>
            Atrás
          </Boton>
        ) : (
          <span />
        )}
        {paso < TOTAL_PASOS - 1 ? (
          <Boton
            iconoDerecha={<ArrowRight size={18} />}
            onClick={() => setPaso((p) => p + 1)}
            disabled={!puedeAvanzar}
          >
            Siguiente
          </Boton>
        ) : (
          <Boton iconoDerecha={<ArrowRight size={18} />} onClick={alEntrar} disabled={!puedeAvanzar}>
            Crear mi cuenta
          </Boton>
        )}
      </div>
    </Modal>
  );
}
