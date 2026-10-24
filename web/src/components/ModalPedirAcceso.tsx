/**
 * "Pide acceso": en el prototipo no hay un backend de solicitudes, así que
 * el envío real se hace abriendo el correo del usuario con todo ya
 * redactado — no se finge un "enviado" que en realidad no llegó a nadie.
 */
import { useState } from 'react';
import { ArrowRight, Mail, Sprout } from 'lucide-react';
import { Boton } from './Boton';
import { Modal } from './Modal';

interface Props {
  onCerrar: () => void;
}

export function ModalPedirAcceso({ onCerrar }: Props) {
  const [nombre, setNombre] = useState('');
  const [correo, setCorreo] = useState('');
  const [finca, setFinca] = useState('');
  const [mensaje, setMensaje] = useState('');
  const [enviado, setEnviado] = useState(false);

  const listo = nombre.trim() && correo.trim() && finca.trim();

  function enviar() {
    if (!listo) return;
    const cuerpo =
      `Nombre: ${nombre}\n` +
      `Correo: ${correo}\n` +
      `Finca: ${finca}\n` +
      (mensaje.trim() ? `Mensaje: ${mensaje}\n` : '');
    window.location.href =
      'mailto:soporte@vigia.app?subject=' +
      encodeURIComponent(`Pide acceso a Vigía: ${finca}`) +
      '&body=' +
      encodeURIComponent(cuerpo);
    setEnviado(true);
  }

  if (enviado) {
    return (
      <Modal titulo="Solicitud lista" onCerrar={onCerrar}>
        <div className="columna" style={{ gap: 12, alignItems: 'center', textAlign: 'center', padding: '12px 0' }}>
          <span className="previa-finca-icono ok" style={{ width: 44, height: 44 }}>
            <Mail size={22} />
          </span>
          <p className="txt-pequeno secundario" style={{ margin: 0 }}>
            Abrimos tu correo con la solicitud ya redactada para <strong>soporte@vigia.app</strong>. Solo falta que
            le des enviar.
          </p>
          <Boton bloque onClick={onCerrar}>
            Listo
          </Boton>
        </div>
      </Modal>
    );
  }

  return (
    <Modal
      titulo="Pide acceso para tu finca"
      subtitulo="Te escribimos en cuanto quede activada — normalmente toma un día hábil."
      onCerrar={onCerrar}
    >
      <form
        className="columna"
        style={{ gap: 12 }}
        onSubmit={(evento) => {
          evento.preventDefault();
          enviar();
        }}
      >
        <label className="columna" style={{ gap: 6 }}>
          <span className="txt-pequeno-fuerte">Tu nombre</span>
          <input
            type="text"
            className="campo-texto"
            value={nombre}
            onChange={(evento) => setNombre(evento.target.value)}
            placeholder="Samuel Rodríguez"
            autoFocus
          />
        </label>
        <label className="columna" style={{ gap: 6 }}>
          <span className="txt-pequeno-fuerte">Correo</span>
          <input
            type="email"
            className="campo-texto"
            value={correo}
            onChange={(evento) => setCorreo(evento.target.value)}
            placeholder="tucorreo@finca.co"
          />
        </label>
        <label className="columna" style={{ gap: 6 }}>
          <span className="txt-pequeno-fuerte">Nombre de la finca</span>
          <input
            type="text"
            className="campo-texto"
            value={finca}
            onChange={(evento) => setFinca(evento.target.value)}
            placeholder="Finca El Roble"
          />
        </label>
        <label className="columna" style={{ gap: 6 }}>
          <span className="txt-pequeno-fuerte">Cuéntanos de tu cultivo (opcional)</span>
          <textarea
            className="campo-texto"
            value={mensaje}
            onChange={(evento) => setMensaje(evento.target.value)}
            placeholder="Cuántas naves, qué etapa, qué te gustaría vigilar…"
            rows={3}
          />
        </label>

        {(nombre || correo || finca) && (
          <div className="previa-finca vacio" style={{ alignItems: 'flex-start' }}>
            <span className="previa-finca-icono">
              <Sprout size={18} />
            </span>
            <div className="columna" style={{ gap: 2, minWidth: 0 }}>
              <span className="txt-pequeno-fuerte">{finca || 'Tu finca'}</span>
              <span className="apagado txt-etiqueta">
                {nombre || 'Tu nombre'} · {correo || 'tucorreo@finca.co'}
              </span>
            </div>
          </div>
        )}

        <Boton bloque type="submit" disabled={!listo} iconoDerecha={<ArrowRight size={18} />}>
          Enviar solicitud
        </Boton>
      </form>
    </Modal>
  );
}
