/**
 * 02 · Llega una alerta nueva (6:1104).
 * Aviso emergente que aparece solo cuando el simulador detecta un hallazgo.
 */

import { AlertTriangle, X } from 'lucide-react';
import type { Alerta } from '@vigia/shared/tipos';
import { ETIQUETA_CIENTIFICA_TIPO } from '@vigia/shared/config';
import { Boton } from './Boton';
import { haceCuanto } from '../utilidades/formato';
import { urlDeApi } from '../api/cliente';

interface Props {
  alerta: Alerta;
  /** Posición en la pila: 0 es la de arriba, las de atrás se ven más apagadas. */
  atras?: number;
  alVerPlanta: () => void;
  alCerrar: () => void;
}

export function AvisoAlerta({ alerta, atras = 0, alVerPlanta, alCerrar }: Props) {
  return (
    <div
      className={`aviso ${atras > 0 ? 'aviso--atras' : ''}`}
      style={atras > 0 ? { opacity: 1 - atras * 0.18 } : undefined}
      role="alert"
      aria-live="assertive"
    >
      <button type="button" className="cerrar aviso-cerrar" onClick={alCerrar} aria-label="Cerrar aviso">
        <X size={16} />
      </button>

      <div className="aviso-cuerpo">
        <span className="aviso-icono">
          <AlertTriangle size={20} strokeWidth={2} />
        </span>

        <div className="columna" style={{ flex: 1, minWidth: 0, gap: 4 }}>
          <span className="tarjeta-titulo">Nueva alerta · posible {ETIQUETA_CIENTIFICA_TIPO[alerta.tipo]}</span>
          <span className="secundario txt-pequeno">
            Cama {alerta.cama} · planta {alerta.planta} · Nave {alerta.nave}. Confianza{' '}
            {Math.round(alerta.confianza * 100)} %. Detectada por el Robot X2 {haceCuanto(alerta.detectadoEn)}.
          </span>
        </div>

        <img className="miniatura" src={urlDeApi(alerta.fotoUrl)} alt="" />
      </div>

      <div className="aviso-acciones">
        <Boton onClick={alVerPlanta}>Ver planta</Boton>
        <Boton variante="fantasma" onClick={alCerrar}>
          Después
        </Boton>
      </div>
    </div>
  );
}
