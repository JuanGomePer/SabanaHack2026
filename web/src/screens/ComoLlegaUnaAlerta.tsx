/** 08 · Cómo llega una alerta (11:3515). */

import { AlertTriangle, ArrowRight, Bell, Bot, Camera, Check } from 'lucide-react';
import { UMBRALES } from '@vigia/shared/config';
import { Chip } from '../components/Chip';
import { Boton } from '../components/Boton';

const PASOS = [
  {
    Icono: Bot,
    titulo: 'El robot recorre las camas',
    texto: 'Pasa por cada cama y toma fotos, temperatura y humedad.',
    pie: 'Foto · T · HR · posición',
    tono: 'neutro' as const,
  },
  {
    Icono: Camera,
    titulo: 'Detecta y clasifica',
    texto: 'Revisa cada foto: Botrytis, Alternaria, Oídio u otro.',
    pie: 'Botrytis · confianza 84 %',
    tono: 'neutro' as const,
  },
  {
    Icono: AlertTriangle,
    titulo: 'Decide el estado',
    texto: 'Cruza la foto con humedad y punto de rocío.',
    pie: 'Estado: en alerta',
    tono: 'alerta' as const,
  },
  {
    Icono: Bell,
    titulo: 'Te avisa',
    texto: 'Plataforma, WhatsApp o correo, como lo hayas configurado.',
    pie: 'Menos de 1 minuto',
    tono: 'ok' as const,
  },
  {
    Icono: Check,
    titulo: 'Tú decides',
    texto: 'Confirmas o descartas con un clic y queda en el registro.',
    pie: 'Registro + CSV',
    tono: 'ok' as const,
  },
];

export function ComoLlegaUnaAlerta() {
  return (
    <section className="como-llega">
      <h2 className="txt-pagina" style={{ margin: '0 0 6px', fontSize: 34, lineHeight: '42px' }}>
        De la hoja al celular del agrónomo, en menos de un minuto
      </h2>
      <p className="secundario txt-cuerpo" style={{ margin: '0 0 28px' }}>
        El robot detecta, la plataforma avisa y la decisión siempre es de quien conoce el cultivo.
      </p>

      <div className="pasos-fila">
        {PASOS.map(({ Icono, titulo, texto, pie, tono }, indice) => (
          <div className="paso-con-flecha" key={titulo}>
            <article className="tarjeta paso-tarjeta">
              <div className="fila-entre" style={{ alignItems: 'flex-start' }}>
                <span className="equipo-icono">
                  <Icono size={20} strokeWidth={2} />
                </span>
                <span className="paso-numero-grande">{indice + 1}</span>
              </div>
              <h3 className="tarjeta-titulo" style={{ marginTop: 16 }}>
                {titulo}
              </h3>
              <p className="secundario txt-pequeno" style={{ margin: '6px 0 16px' }}>
                {texto}
              </p>
              <div style={{ marginTop: 'auto' }}>
                <Chip tono={tono}>{pie}</Chip>
              </div>
            </article>
            {indice < PASOS.length - 1 && (
              <span className="flecha-paso" aria-hidden="true">
                <ArrowRight size={18} />
              </span>
            )}
          </div>
        ))}
      </div>

      <h3 className="txt-pagina" style={{ margin: '32px 0 16px', fontSize: 22, lineHeight: '28px' }}>
        Así llega a cada canal
      </h3>

      <div className="canales">
        <div>
          <p className="txt-sobretitulo apagado">En la plataforma · aviso emergente</p>
          <div className="canal-aviso">
            <div className="aviso-cuerpo">
              <span className="aviso-icono">
                <AlertTriangle size={20} strokeWidth={2} />
              </span>
              <div className="columna" style={{ gap: 4 }}>
                <span className="tarjeta-titulo">Nueva alerta · posible Botrytis</span>
                <span className="secundario txt-pequeno">
                  Cama 14 · planta 65 · Nave 5. Confianza 84 %. Detectada por el Robot X2 hace 2 s.
                </span>
              </div>
            </div>
            <div className="aviso-acciones">
              <Boton>Ver planta</Boton>
              <Boton variante="fantasma">Después</Boton>
            </div>
          </div>
        </div>

        <div>
          <p className="txt-sobretitulo apagado">WhatsApp o SMS</p>
          <div className="canal-mensaje">
            <span className="txt-pequeno-fuerte" style={{ color: 'var(--color-status-alert)' }}>
              Vigía · Alerta nueva
            </span>
            <div className="canal-foto">
              <img src="/api/fotos/H-0001.svg" alt="Foto del robot del hallazgo" />
            </div>
            <p className="txt-pequeno" style={{ margin: 0 }}>
              Posible Botrytis (84 %) en cama 14, planta 65. Nave 5 · humedad 91 %.
            </p>
            <span className="apagado txt-etiqueta">vigia.app/p/B5-C14-P065 · 14:32</span>
            <div className="canal-botones">
              <span>Confirmar</span>
              <span>Falsa alarma</span>
            </div>
          </div>
        </div>

        <div>
          <p className="txt-sobretitulo apagado">Correo electrónico</p>
          <div className="canal-correo">
            <span className="txt-cuerpo-fuerte">Alerta en C14-P65 · Botrytis 84 %</span>
            <p className="secundario txt-pequeno" style={{ margin: '6px 0 0' }}>
              Resumen de las últimas 15 min: 2 alertas nuevas y 1 zona con humedad alta. Abre la
              plataforma para ver las fotos.
            </p>
          </div>
        </div>
      </div>

      <p className="apagado txt-pequeno" style={{ marginTop: 22 }}>
        Los canales de WhatsApp, SMS y correo son una maqueta: el prototipo no envía mensajes. El
        umbral de confianza actual es {Math.round(UMBRALES.confianzaMinima * 100)} %.
      </p>
    </section>
  );
}
