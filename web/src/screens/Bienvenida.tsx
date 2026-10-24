/**
 * 10 · Bienvenida (18:952).
 *
 * Fondo claro y sobrio, sin degradados: lo que tiene que mirar el encargado
 * mientras carga es cómo está el bloque, así que la pantalla muestra una
 * previsualización del mapa 2D con los datos reales de /api/mapa.
 */

import { ArrowRight, Check } from 'lucide-react';
import type { MapaRespuesta } from '@vigia/shared/tipos';
import { Boton } from '../components/Boton';
import { PreviaBloque } from '../components/PreviaBloque';
import { numero } from '../utilidades/formato';
import { USUARIO } from '@vigia/shared/config';

interface Props {
  mapa?: MapaRespuesta;
  alEntrar: () => void;
}

function saludo(): string {
  const hora = new Date().getHours();
  if (hora < 12) return 'Buenos días';
  if (hora < 19) return 'Buenas tardes';
  return 'Buenas noches';
}

const LEYENDA = [
  { estado: 'ok', texto: 'Sana' },
  { estado: 'riesgo', texto: 'En riesgo' },
  { estado: 'alerta', texto: 'En alerta' },
  { estado: 'sin_dato', texto: 'Sin dato' },
] as const;

export function Bienvenida({ mapa, alEntrar }: Props) {
  const resumen = mapa?.resumen;

  const pasos = [
    {
      titulo: `${resumen?.robot.nombre ?? 'Robot X2'} conectado`,
      detalle: resumen
        ? `Nave ${resumen.robot.nave} · batería ${resumen.robot.bateria} %`
        : 'Conectando…',
    },
    {
      titulo: `Mapa del bloque ${resumen?.bloque ?? 'B5'} cargado`,
      detalle: mapa
        ? `${numero(mapa.camas.length)} camas · ${numero(resumen?.totalPlantas ?? 0)} plantas`
        : 'Cargando…',
    },
    {
      titulo: 'Alertas al día',
      detalle: resumen ? `${resumen.porRevisar} por revisar` : 'Revisando…',
    },
  ];

  return (
    <div className="bienvenida-clara">
      <div className="bienvenida-panel">
        <div className="fila" style={{ gap: 12 }}>
          <div className="logo-marca">
            <img src="/logo-mono.svg" alt="" width={22} height={20} />
          </div>
          <div className="columna">
            <span className="logo-nombre bienvenida-marca">Vigía</span>
            <span className="logo-sub txt-pequeno apagado">Monitor de cultivo</span>
          </div>
        </div>

        <div className="columna" style={{ gap: 4 }}>
          <h1 className="txt-pagina" style={{ margin: 0, fontSize: 30 }}>
            {saludo()}, {USUARIO.nombre}
          </h1>
          <p className="secundario txt-cuerpo" style={{ margin: 0 }}>
            Estamos preparando tu cultivo
          </p>
        </div>

        <div className="bienvenida-pasos">
          {pasos.map((paso) => (
            <div className="fila" key={paso.titulo} style={{ gap: 10 }}>
              <span className="bienvenida-check">
                <Check size={13} strokeWidth={3} />
              </span>
              <div className="columna">
                <span className="txt-cuerpo-fuerte">{paso.titulo}</span>
                <span className="apagado txt-pequeno">{paso.detalle}</span>
              </div>
            </div>
          ))}
        </div>

        <div className="bienvenida-previa">
          <div className="fila-entre">
            <span className="txt-cuerpo-fuerte">
              Bloque {resumen?.bloque ?? '—'} · vista del mapa
            </span>
            <span className="apagado txt-etiqueta">
              {mapa ? `${mapa.naves.length} naves · ${mapa.camas.length} camas` : 'Cargando el mapa…'}
            </span>
          </div>

          {mapa ? (
            <>
              <PreviaBloque camas={mapa.camas} />
              <div className="leyenda">
                {LEYENDA.map(({ estado, texto }) => (
                  <span className="leyenda-item txt-pequeno" key={estado}>
                    <span className={`leyenda-color ${estado}`} />
                    {texto}
                  </span>
                ))}
              </div>
            </>
          ) : (
            <div className="previa-bloque-esqueleto" aria-hidden="true" />
          )}
        </div>

        <div className="bienvenida-cifras">
          <div>
            <span className="cifra">{resumen ? numero(resumen.sanas) : '—'}</span>
            <span className="apagado txt-pequeno">sanas</span>
          </div>
          <div>
            <span className="cifra">{resumen ? numero(resumen.riesgo) : '—'}</span>
            <span className="apagado txt-pequeno">en riesgo</span>
          </div>
          <div>
            <span className="cifra">{resumen ? numero(resumen.alerta) : '—'}</span>
            <span className="apagado txt-pequeno">en alerta</span>
          </div>
        </div>

        <Boton
          bloque
          onClick={alEntrar}
          iconoDerecha={<ArrowRight size={18} />}
          className="boton-bienvenida"
        >
          Entrar al mapa
        </Boton>
      </div>
    </div>
  );
}
