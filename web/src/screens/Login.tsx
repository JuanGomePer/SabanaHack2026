/** 09 · Inicio de sesión (18:704). */

import { useState } from 'react';
import {
  ArrowRight,
  Camera,
  Check,
  Eye,
  EyeOff,
  KeySquare,
  Lock,
  Mail,
  ScanSearch,
  SquareCheckBig,
  Trophy,
} from 'lucide-react';
import { Boton } from '../components/Boton';
import { IlustracionArandanos } from '../components/IlustracionArandanos';
import { ModalCodigoFinca } from '../components/ModalCodigoFinca';
import { ModalConoceTuFinca } from '../components/ModalConoceTuFinca';
import { ModalPedirAcceso } from '../components/ModalPedirAcceso';

interface Props {
  alEntrar: () => void;
}

const HISTORIA = [
  { Icono: Camera, texto: 'El robot recorre cada cama, todos los días.' },
  { Icono: ScanSearch, texto: 'Encuentra lo que el ojo humano pasa por alto — el mismo día.' },
  { Icono: SquareCheckBig, texto: 'Tú revisas la alerta y decides, antes de perder la cosecha.' },
] as const;

export function Login({ alEntrar }: Props) {
  const [verClave, setVerClave] = useState(false);
  const [mantener, setMantener] = useState(true);
  const [modal, setModal] = useState<'codigo' | 'acceso' | 'conoce'>();

  return (
    <div className="acceso">
      <div className="acceso-arte acceso-arte-clara">
        <div className="logo" style={{ padding: 0 }}>
          <div className="logo-marca">
            <img src="/logo-mono.svg" alt="" width={22} height={20} />
          </div>
          <div className="columna">
            <span className="logo-nombre">Vigía</span>
            <span className="logo-sub txt-pequeno apagado">Monitor de cultivo</span>
          </div>
        </div>

        <IlustracionArandanos className="acceso-ilustracion" />

        <div className="columna" style={{ gap: 16 }}>
          <h2 className="txt-pagina" style={{ margin: 0, fontSize: 32, lineHeight: '38px' }}>
            Cada arándano, revisado a tiempo.
          </h2>
          <p className="txt-cuerpo secundario" style={{ margin: 0 }}>
            Antes, una enfermedad se podía extender semanas sin que nadie la viera. Ahora el robot recorre cada
            cama, la encuentra a tiempo y tú decides qué hacer con la cosecha todavía por salvar.
          </p>

          <ul className="acceso-historia">
            {HISTORIA.map(({ Icono, texto }) => (
              <li key={texto}>
                <span className="acceso-historia-icono">
                  <Icono size={16} />
                </span>
                <span className="txt-pequeno">{texto}</span>
              </li>
            ))}
          </ul>

          <button type="button" className="wizard-cta" onClick={() => setModal('conoce')}>
            <Trophy size={18} />
            <span className="columna" style={{ gap: 1 }}>
              <span className="txt-pequeno-fuerte">¿Primera vez aquí? Conoce tu finca</span>
              <span className="apagado txt-etiqueta">4 preguntas rápidas y te mostramos cómo quedaría</span>
            </span>
            <ArrowRight size={16} />
          </button>
        </div>
      </div>

      <form
        className="acceso-formulario"
        onSubmit={(evento) => {
          evento.preventDefault();
          alEntrar();
        }}
      >
        <span className="txt-sobretitulo" style={{ color: 'var(--color-brand-primary)' }}>
          Bienvenido de nuevo
        </span>
        <h1 className="txt-pagina" style={{ margin: 0 }}>
          Entra a tu cultivo
        </h1>
        <p className="secundario txt-pequeno" style={{ margin: '-8px 0 6px' }}>
          Mira cómo va cada cama y recibe las alertas al instante.
        </p>

        <label>
          <span className="txt-pequeno-fuerte">Correo</span>
          <span className="campo-icono">
            <Mail size={18} strokeWidth={2} />
            <input type="text" defaultValue="samuel@finca-ejemplo.co" autoComplete="username" />
          </span>
        </label>

        <label>
          <span className="txt-pequeno-fuerte">Contraseña</span>
          <span className="campo-icono">
            <Lock size={18} strokeWidth={2} />
            <input
              type={verClave ? 'text' : 'password'}
              defaultValue="arandanos"
              autoComplete="current-password"
            />
            <button
              type="button"
              className="cerrar"
              onClick={() => setVerClave((v) => !v)}
              aria-label={verClave ? 'Ocultar contraseña' : 'Ver contraseña'}
            >
              {verClave ? <EyeOff size={18} /> : <Eye size={18} />}
            </button>
          </span>
        </label>

        <div className="fila-entre">
          <button
            type="button"
            className="fila casilla"
            onClick={() => setMantener((v) => !v)}
            aria-pressed={mantener}
          >
            <span className={`marca ${mantener ? 'activa' : ''}`}>
              {mantener && <Check size={13} strokeWidth={3} />}
            </span>
            <span className="txt-pequeno secundario">Mantener la sesión</span>
          </button>
          <a
            className="txt-pequeno-fuerte enlace"
            href="mailto:soporte@vigia.app?subject=Olvid%C3%A9%20mi%20contrase%C3%B1a"
          >
            ¿Olvidaste tu contraseña?
          </a>
        </div>

        <Boton bloque type="submit" iconoDerecha={<ArrowRight size={18} />}>
          Entrar
        </Boton>

        <div className="separador">
          <span />
          <em>o</em>
          <span />
        </div>

        <Boton
          bloque
          variante="secundario"
          icono={<KeySquare size={18} />}
          onClick={() => setModal('codigo')}
        >
          Entrar con el código de la finca
        </Boton>

        <p className="secundario txt-pequeno" style={{ margin: 0, textAlign: 'center' }}>
          ¿Tu finca aún no está en Vigía?{' '}
          <button type="button" className="enlace txt-pequeno-fuerte boton-enlace" onClick={() => setModal('acceso')}>
            Pide acceso
          </button>
        </p>
      </form>

      {modal === 'codigo' && <ModalCodigoFinca onCerrar={() => setModal(undefined)} alEntrar={alEntrar} />}
      {modal === 'acceso' && <ModalPedirAcceso onCerrar={() => setModal(undefined)} />}
      {modal === 'conoce' && <ModalConoceTuFinca onCerrar={() => setModal(undefined)} alEntrar={alEntrar} />}
    </div>
  );
}
