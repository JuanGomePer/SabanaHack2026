/**
 * Previsualización del mapa 2D del bloque: una franja por cama, agrupadas por
 * nave, con el color de estado de cada tramo.
 *
 * No es el mapa de verdad (no se puede tocar y no dibuja cada arándano): cada
 * cama se resume en TRAMOS franjas y cada franja toma el peor estado de las
 * celdas que agrupa — el mismo criterio que usa el mapa cuando una celda junta
 * varias plantas. Entre cama y cama va su pasillo, igual que en el mapa. Los
 * datos son los reales de /api/mapa.
 */
import { Fragment } from 'react';
import type { Cama, EstadoCelda } from '@vigia/shared/tipos';

/** Franjas en las que se resume cada cama. 20 entran bien en una tarjeta. */
const TRAMOS = 20;

/** Lo confirmado pesa más que lo que nadie ha mirado, igual que en el mapa. */
const PESO: Record<EstadoCelda, number> = {
  confirmada: 4,
  alerta: 3,
  en_revision: 2.5,
  riesgo: 2,
  sin_dato: 1,
  ok: 0,
};

function peorEstado(estados: EstadoCelda[]): EstadoCelda {
  return estados.reduce<EstadoCelda>((peor, actual) => (PESO[actual] > PESO[peor] ? actual : peor), 'ok');
}

/** Divide las celdas de una cama en TRAMOS franjas y devuelve el estado de cada una. */
function tramosDeCama(cama: Cama): EstadoCelda[] {
  const porTramo = Math.max(1, Math.ceil(cama.celdas.length / TRAMOS));
  const tramos: EstadoCelda[] = [];
  for (let i = 0; i < cama.celdas.length; i += porTramo) {
    tramos.push(peorEstado(cama.celdas.slice(i, i + porTramo).map((c) => c.estado)));
  }
  return tramos;
}

export function PreviaBloque({ camas }: { camas: Cama[] }) {
  const naves = [...new Set(camas.map((c) => c.nave))].sort((a, b) => a - b);

  return (
    <div className="previa-bloque" aria-hidden="true">
      {naves.map((nave) => (
        <div className="previa-bloque-nave" key={nave}>
          <span className="previa-bloque-nombre txt-etiqueta">N{nave}</span>
          <div className="previa-bloque-camas">
            <span className="previa-bloque-pasillo" />
            {camas
              .filter((c) => c.nave === nave)
              .map((cama) => (
                <Fragment key={cama.numero}>
                  <div className="previa-bloque-cama">
                    {tramosDeCama(cama).map((estado, i) => (
                      <span className={`previa-bloque-tramo ${estado}`} key={i} />
                    ))}
                  </div>
                  <span className="previa-bloque-pasillo" />
                </Fragment>
              ))}
          </div>
        </div>
      ))}
    </div>
  );
}
