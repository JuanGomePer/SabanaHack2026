/** 10 · Bienvenida (18:952). */

import { ArrowRight, Check } from 'lucide-react';
import type { Resumen } from '@vigia/shared/tipos';
import { Boton } from '../components/Boton';
import { FondoVerde } from '../components/FondoVerde';
import { numero } from '../utilidades/formato';
import { USUARIO } from '@vigia/shared/config';

interface Props {
  resumen?: Resumen;
  alEntrar: () => void;
}

function saludo(): string {
  const hora = new Date().getHours();
  if (hora < 12) return 'Buenos días';
  if (hora < 19) return 'Buenas tardes';
  return 'Buenas noches';
}

export function Bienvenida({ resumen, alEntrar }: Props) {
  const pasos = [
    {
      titulo: `${resumen?.robot.nombre ?? 'Robot X2'} conectado`,
      detalle: resumen
        ? `Nave ${resumen.robot.nave} · batería ${resumen.robot.bateria} %`
        : 'Conectando…',
    },
    {
      titulo: `Mapa del bloque ${resumen?.bloque ?? 'B5'} cargado`,
      detalle: resumen
        ? `${numero(resumen.totalPlantas / 100)} camas · ${numero(resumen.totalPlantas)} plantas`
        : 'Cargando…',
    },
    {
      titulo: 'Alertas al día',
      detalle: resumen ? `${resumen.porRevisar} por revisar` : 'Revisando…',
    },
  ];

  return (
    <FondoVerde className="bienvenida">
      <div className="marca-grande">
        <img src="/logo-mono.svg" alt="" width={36} height={33} />
      </div>

      <h1 className="txt-pagina" style={{ margin: 0, fontSize: 32 }}>
        {saludo()}, {USUARIO.nombre}
      </h1>
      <p className="txt-cuerpo" style={{ margin: 0, color: 'rgba(255,255,255,0.75)' }}>
        Estamos preparando tu cultivo
      </p>

      <div className="bienvenida-pasos">
        {pasos.map((paso) => (
          <div className="fila" key={paso.titulo} style={{ gap: 12 }}>
            <span className="acceso-icono chico" style={{ background: 'var(--color-status-ok)' }}>
              <Check size={15} strokeWidth={3} />
            </span>
            <div className="columna">
              <span className="txt-cuerpo-fuerte">{paso.titulo}</span>
              <span className="txt-pequeno" style={{ color: 'rgba(255,255,255,0.7)' }}>
                {paso.detalle}
              </span>
            </div>
          </div>
        ))}
      </div>

      <div className="bienvenida-cifras">
        <div>
          <span className="cifra">{resumen ? numero(resumen.sanas) : '—'}</span>
          <span className="txt-pequeno">sanas</span>
        </div>
        <div>
          <span className="cifra">{resumen ? numero(resumen.riesgo) : '—'}</span>
          <span className="txt-pequeno">en riesgo</span>
        </div>
        <div>
          <span className="cifra">{resumen ? numero(resumen.alerta) : '—'}</span>
          <span className="txt-pequeno">en alerta</span>
        </div>
      </div>

      <Boton
        variante="secundario"
        onClick={alEntrar}
        iconoDerecha={<ArrowRight size={18} />}
        className="boton-bienvenida"
      >
        Entrar al mapa
      </Boton>
    </FondoVerde>
  );
}
