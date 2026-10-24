/** 09 · Inicio de sesión (18:704). */

import { useState } from 'react';
import { AlertTriangle, ArrowRight, Bot, Check, Eye, EyeOff, Lock, Mail } from 'lucide-react';
import { Boton } from '../components/Boton';
import { FondoVerde } from '../components/FondoVerde';

interface Props {
  alEntrar: () => void;
}

export function Login({ alEntrar }: Props) {
  const [verClave, setVerClave] = useState(false);
  const [mantener, setMantener] = useState(true);

  return (
    <div className="acceso">
      <FondoVerde className="acceso-arte">
        <div className="logo" style={{ padding: 0 }}>
          <div className="logo-marca" style={{ background: 'rgba(255,255,255,0.16)' }}>
            <img src="/logo-mono.svg" alt="" width={22} height={20} />
          </div>
          <div className="columna">
            <span className="logo-nombre">Vigía</span>
            <span className="logo-sub txt-pequeno" style={{ color: 'rgba(255,255,255,0.72)' }}>
              Monitor de cultivo
            </span>
          </div>
        </div>

        <div className="columna" style={{ gap: 14 }}>
          <h2 className="txt-pagina" style={{ margin: 0, fontSize: 34, lineHeight: '40px' }}>
            Tu cultivo, siempre a la vista.
          </h2>
          <p className="txt-cuerpo" style={{ margin: 0, color: 'rgba(255,255,255,0.78)' }}>
            Un robot recorre cada cama, la plataforma te avisa si algo cambia y tú decides a tiempo.
          </p>

          <div className="acceso-tarjeta">
            <span className="acceso-icono" style={{ background: 'var(--color-status-ok)' }}>
              <Bot size={20} strokeWidth={2} />
            </span>
            <div className="columna" style={{ flex: 1, minWidth: 0 }}>
              <span className="txt-cuerpo-fuerte">Robot X2 · en ronda</span>
              <div className="pista" style={{ marginTop: 8 }}>
                <div className="barra" style={{ width: '62%' }} />
              </div>
            </div>
            <span className="txt-pequeno" style={{ color: 'rgba(255,255,255,0.72)' }}>
              Nave 6 · 62 %
            </span>
          </div>

          <div className="acceso-tarjeta">
            <span className="acceso-icono" style={{ background: 'var(--color-status-alert)' }}>
              <AlertTriangle size={20} strokeWidth={2} />
            </span>
            <div className="columna">
              <span className="txt-cuerpo-fuerte">Alerta nueva · posible Botrytis cinerea</span>
              <span className="txt-pequeno" style={{ color: 'rgba(255,255,255,0.72)' }}>
                Cama 14 · planta 65 · hace 2 s
              </span>
            </div>
          </div>
        </div>
      </FondoVerde>

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

        <Boton bloque variante="secundario" onClick={alEntrar}>
          Entrar con el código de la finca
        </Boton>

        <p className="secundario txt-pequeno" style={{ margin: 0, textAlign: 'center' }}>
          ¿Tu finca aún no está en Vigía?{' '}
          <a
            className="enlace txt-pequeno-fuerte"
            href="mailto:soporte@vigia.app?subject=Quiero%20acceso%20a%20Vig%C3%ADa"
          >
            Pide acceso
          </a>
        </p>
      </form>
    </div>
  );
}
