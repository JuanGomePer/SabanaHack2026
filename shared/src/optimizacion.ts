/**
 * Optimizador de siembra: cuántas hileras y matas de arándano caben en un
 * terreno, y en qué sentido sembrarlas para aprovecharlo mejor.
 *
 * No usamos ninguna librería de "bin packing" (rectangle-packer,
 * maxrects-packer, potpack, binpackingjs — se investigaron antes de escribir
 * esto): esas empaquetan rectángulos de tamaños distintos en el menor
 * espacio posible, para sprites o cajas. Una siembra en hileras es una
 * rejilla uniforme — todas las hileras con el mismo espacio entre sí y entre
 * plantas — y eso tiene solución cerrada por geometría: no hace falta un
 * algoritmo de empaquetado. La única decisión real es en qué sentido
 * orientar las hileras, así que probamos los dos (hileras a lo largo del
 * terreno e hileras a lo ancho) y nos quedamos con el que más matas deja
 * sembrar — esa es la "optimización".
 *
 * Los espacios por defecto (sistema en suelo: 3 m entre hileras, 1 m entre
 * plantas; en bolsas: 2 m y 0,5 m) salen de guías agronómicas de arándano
 * para la región central de Colombia — son supuestos editables, no una
 * norma fija.
 */

export type FormaTerreno = 'rectangular' | 'irregular';
export type SistemaSiembra = 'suelo' | 'bolsas';

export interface EspaciosPorSistema {
  entreHileras: number;
  entrePlantas: number;
}

/** Supuestos de espaciamiento por sistema de siembra, en metros. */
export const ESPACIOS_SIEMBRA: Record<SistemaSiembra, EspaciosPorSistema> = {
  suelo: { entreHileras: 3, entrePlantas: 1 },
  bolsas: { entreHileras: 2, entrePlantas: 0.5 },
};

/**
 * Cuánto del área realmente se puede sembrar, además del margen perimetral:
 * un terreno rectangular limpio aprovecha casi todo; uno de forma irregular
 * pierde más borde y esquinas muertas. Es una aproximación declarada, no una
 * medición — por eso el resultado la muestra explícita.
 */
export const APROVECHAMIENTO_POR_FORMA: Record<FormaTerreno, number> = {
  rectangular: 0.92,
  irregular: 0.72,
};

export interface ParametrosOptimizacion {
  /** Ancho y largo del terreno, en metros. */
  anchoM: number;
  largoM: number;
  forma: FormaTerreno;
  sistema: SistemaSiembra;
  /** Espacio entre hileras, en metros (si no se da, usa el del sistema). */
  entreHileras?: number;
  /** Espacio entre plantas de una misma hilera, en metros. */
  entrePlantas?: number;
  /** Margen perimetral para maniobra del robot y del personal, en metros. */
  margenM?: number;
}

export interface OrientacionResultado {
  orientacion: 'hileras_a_lo_largo' | 'hileras_a_lo_ancho';
  /** Cuántas hileras caben. */
  hileras: number;
  /** Largo de cada hilera, en metros. */
  largoHileraM: number;
  /** Plantas que caben en una hilera. */
  plantasPorHilera: number;
  totalPlantas: number;
}

export interface ResultadoOptimizacion {
  areaTotalM2: number;
  areaUtilM2: number;
  /** % del área total que de verdad queda sembrada (incluye margen y forma). */
  aprovechamientoPct: number;
  mejor: OrientacionResultado;
  alternativa: OrientacionResultado;
  /** Matas por hectárea, con el resultado elegido. */
  densidadPorHectarea: number;
  entreHileras: number;
  entrePlantas: number;
  margenM: number;
}

/** Cuántos postes de cerca caben en un largo dado, separados `espacio` entre sí. */
function contarEnLinea(largoDisponibleM: number, espacio: number): number {
  if (largoDisponibleM <= 0 || espacio <= 0) return 0;
  return Math.floor(largoDisponibleM / espacio) + 1;
}

function calcularOrientacion(
  anchoUtilM: number,
  largoUtilM: number,
  entreHileras: number,
  entrePlantas: number,
  orientacion: OrientacionResultado['orientacion'],
): OrientacionResultado {
  const hileras = contarEnLinea(anchoUtilM, entreHileras);
  const plantasPorHilera = contarEnLinea(largoUtilM, entrePlantas);
  return {
    orientacion,
    hileras,
    largoHileraM: Math.round(largoUtilM * 10) / 10,
    plantasPorHilera,
    totalPlantas: hileras * plantasPorHilera,
  };
}

export function optimizarTerreno(parametros: ParametrosOptimizacion): ResultadoOptimizacion {
  const { anchoM, largoM, forma, sistema } = parametros;
  const espaciosDefecto = ESPACIOS_SIEMBRA[sistema];
  const entreHileras = parametros.entreHileras ?? espaciosDefecto.entreHileras;
  const entrePlantas = parametros.entrePlantas ?? espaciosDefecto.entrePlantas;
  const margenM = parametros.margenM ?? 2;

  const areaTotalM2 = Math.max(0, anchoM) * Math.max(0, largoM);

  const anchoUtilBruto = Math.max(0, anchoM - margenM * 2);
  const largoUtilBruto = Math.max(0, largoM - margenM * 2);

  const factorForma = APROVECHAMIENTO_POR_FORMA[forma];
  // El factor de forma se aplica como si recortara el mismo porcentaje de
  // cada lado, para no inventar una cifra de área suelta sin figura detrás.
  const factorLado = Math.sqrt(factorForma);
  const anchoUtilM = anchoUtilBruto * factorLado;
  const largoUtilM = largoUtilBruto * factorLado;

  const orientacionA = calcularOrientacion(anchoUtilM, largoUtilM, entreHileras, entrePlantas, 'hileras_a_lo_ancho');
  const orientacionB = calcularOrientacion(largoUtilM, anchoUtilM, entreHileras, entrePlantas, 'hileras_a_lo_largo');

  const [mejor, alternativa] =
    orientacionA.totalPlantas >= orientacionB.totalPlantas ? [orientacionA, orientacionB] : [orientacionB, orientacionA];

  const areaUtilM2 = Math.round(anchoUtilM * largoUtilM);
  const aprovechamientoPct = areaTotalM2 === 0 ? 0 : Math.round((areaUtilM2 / areaTotalM2) * 1000) / 10;
  const densidadPorHectarea = areaTotalM2 === 0 ? 0 : Math.round((mejor.totalPlantas / areaTotalM2) * 10000);

  return {
    areaTotalM2: Math.round(areaTotalM2),
    areaUtilM2,
    aprovechamientoPct,
    mejor,
    alternativa,
    densidadPorHectarea,
    entreHileras,
    entrePlantas,
    margenM,
  };
}
