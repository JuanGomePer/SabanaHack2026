/**
 * SUPUESTOS DEL PROTOTIPO — todos editables desde aquí.
 *
 * Las cifras de estructura, umbrales y equipos son supuestos pendientes de
 * confirmar con el mentor (Agrar Ingeniería). No están repartidas por el
 * código: cambiar un número aquí cambia el backend y el frontend.
 */

import type {
  ConfiguracionEstructura,
  ConfiguracionUmbrales,
  TipoHallazgo,
} from './tipos';

// ── Estructura del cultivo ──────────────────────────────────────────────────
export const ESTRUCTURA: ConfiguracionEstructura = {
  bloque: 'B5',
  nombre: 'Bloque B5',
  etapa: 'Floración',
  naves: 8,
  camasPorNave: 3,
  plantasPorCama: 100,
  /** Cada celda del mapa agrupa 2,5 plantas → 40 celdas por cama. */
  plantasPorCelda: 2.5,
  /** Las camas se numeran seguidas de 1 a 24. */
  numeracion: 'seguida',
  /** Medidas de una nave, en metros (supuesto). */
  anchoNave: 6.8,
  largoNave: 80,
};

export const CELDAS_POR_CAMA = Math.round(
  ESTRUCTURA.plantasPorCama / ESTRUCTURA.plantasPorCelda,
);

export const TOTAL_CAMAS = ESTRUCTURA.naves * ESTRUCTURA.camasPorNave;

export const TOTAL_PLANTAS = TOTAL_CAMAS * ESTRUCTURA.plantasPorCama;

// ── Umbrales ────────────────────────────────────────────────────────────────
export const UMBRALES: ConfiguracionUmbrales = {
  /** Humedad relativa a partir de la cual la planta se marca "en riesgo" (%). */
  humedadRiesgo: 85,
  /** Humedad que dispara la ventilación automática del programador (%). */
  humedadAlta: 85,
  /** Confianza mínima del robot para abrir una alerta (0–1). */
  confianzaMinima: 0.6,
  ventilacionAutomatica: true,
  avisoEmergente: true,
  /** La alerta del demo llega a los 3 s de entrar al mapa. */
  segundosAlertaDemo: 3,
};

// ── Helpers de estructura ───────────────────────────────────────────────────
/** Nave a la que pertenece una cama. Cama 14 → nave 5 (camas 13–15). */
export function naveDeCama(cama: number): number {
  return Math.floor((cama - 1) / ESTRUCTURA.camasPorNave) + 1;
}

/** Camas que contiene una nave. Nave 5 → [13, 14, 15]. */
export function camasDeNave(nave: number): number[] {
  const primera = (nave - 1) * ESTRUCTURA.camasPorNave + 1;
  return Array.from({ length: ESTRUCTURA.camasPorNave }, (_, i) => primera + i);
}

/** Celda del mapa en la que cae una planta. floor((p - 1) / 2,5). */
export function celdaDePlanta(planta: number): number {
  return Math.floor((planta - 1) / ESTRUCTURA.plantasPorCelda);
}

/** Números de planta que caen en una celda del mapa. */
export function plantasDeCelda(indice: number): number[] {
  const desde = Math.ceil(indice * ESTRUCTURA.plantasPorCelda) + 1;
  const hasta = Math.ceil((indice + 1) * ESTRUCTURA.plantasPorCelda);
  const plantas: number[] = [];
  for (let p = desde; p <= hasta; p++) plantas.push(p);
  return plantas;
}

/** ID de planta en el formato del contrato: "B5-C14-P065". */
export function idPlanta(cama: number, planta: number): string {
  return `${ESTRUCTURA.bloque}-C${cama}-P${String(planta).padStart(3, '0')}`;
}

/** Etiqueta corta para la UI: "C14-P65". */
export function etiquetaPlanta(cama: number, planta: number): string {
  return `C${cama}-P${planta}`;
}

// ── Datos semilla del cultivo ───────────────────────────────────────────────
/** Plantas en alerta al arrancar: [cama, planta]. */
export const PLANTAS_EN_ALERTA: Array<[number, number]> = [
  [14, 60],
  [14, 63],
  [13, 62],
  [15, 66],
  [5, 14],
  [20, 30],
  [2, 50],
];

/** Tipo de hallazgo por planta semilla, en el mismo orden. */
export const TIPOS_SEMILLA: TipoHallazgo[] = [
  'Botrytis',
  'Botrytis',
  'Botrytis',
  'Alternaria',
  'Oídio',
  'Alternaria',
  'Botrytis',
];

/** La alerta nueva del demo: cama 14, planta 65. */
export const ALERTA_DEMO = { cama: 14, planta: 65, tipo: 'Botrytis' as TipoHallazgo };

/**
 * Zonas con humedad por encima del umbral: rangos de plantas de una cama.
 * Con estos rangos el resumen da 48 plantas en riesgo y 3 camas con humedad
 * alta (13, 14 y 15, todas de la nave 5), como en el diseño.
 */
export const ZONAS_EN_RIESGO: Array<{ cama: number; desde: number; hasta: number; humedad: number }> = [
  { cama: 14, desde: 56, hasta: 80, humedad: 91 },
  { cama: 13, desde: 58, hasta: 70, humedad: 88 },
  { cama: 15, desde: 60, hasta: 73, humedad: 87 },
];

/** Camas con sensores fuera de servicio → celdas "sin dato". */
export const ZONAS_SIN_DATO: Array<{ cama: number; desde: number; hasta: number }> = [
  { cama: 9, desde: 86, hasta: 94 },
  { cama: 22, desde: 78, hasta: 100 },
  { cama: 23, desde: 82, hasta: 100 },
  { cama: 24, desde: 74, hasta: 100 },
];

// ── Qué hacer, por tipo de hallazgo ─────────────────────────────────────────
export const RECOMENDACIONES: Record<TipoHallazgo, string> = {
  Botrytis:
    'Retira el fruto afectado y los pétalos secos. Baja la humedad de la nave por debajo de 85 % antes de la noche y revisa las plantas vecinas.',
  Alternaria:
    'Quita las hojas con manchas y sácalas del invernadero. Evita el riego por aspersión en esta cama y mejora la circulación de aire.',
  Oídio:
    'Revisa el envés de las hojas de las plantas vecinas. Ventila para bajar la humedad y evalúa tratamiento con el agrónomo.',
};

// ── Estado del robot (simulado) ─────────────────────────────────────────────
export const ROBOT = {
  nombre: 'Robot X2',
  estado: 'en ronda',
  nave: 6,
  bateria: 78,
  ronda: 3,
  rondasTotales: 4,
  progreso: 62,
};

// ── Equipos de clima ────────────────────────────────────────────────────────
/**
 * Catálogo de familias de equipo de agrar.com.co.
 * Los estados, potencias y cifras son DATOS DE EJEMPLO simulados por este
 * prototipo: no son lecturas reales de Agrar ni de un cultivo real.
 */
export const EQUIPOS_SEMILLA: Array<{
  id: string;
  tipo: string;
  /** Nombre en singular, para los textos cortos de los KPIs. */
  nombreCorto?: string;
  modelo: string;
  /** Nave de referencia para leer la humedad. */
  nave: number;
  /** Cómo se escribe la ubicación en la tarjeta. */
  ubicacion: string;
  estado: 'En marcha' | 'En espera' | 'Aviso' | 'Activo';
  potencia: number;
  /** El programador no tiene barra de potencia. */
  conBarra: boolean;
  /** Icono de lucide-react que usa la tarjeta. */
  icono: 'fan' | 'rotate' | 'wind' | 'extract' | 'droplet' | 'cpu';
  queEstaPasando: string;
}> = [
  {
    id: 'EQ-01',
    tipo: 'Ventiladores de cesta',
    modelo: 'Atem Plus 92 cm',
    nave: 3,
    ubicacion: 'Naves 3 y 4',
    estado: 'En marcha',
    potencia: 62,
    conBarra: true,
    icono: 'fan',
    queEstaPasando: 'Subieron de 40 % a 62 % para acompañar la humedad de la nave 5.',
  },
  {
    id: 'EQ-02',
    tipo: 'Brazos Mecánicos®',
    modelo: 'Giro continuo 360°',
    nave: 5,
    ubicacion: 'Nave 5',
    estado: 'En marcha',
    potencia: 100,
    conBarra: true,
    icono: 'rotate',
    queEstaPasando: 'Barren las camas 13 a 15, donde la humedad pasó del umbral.',
  },
  {
    id: 'EQ-03',
    tipo: 'Recirculadores',
    modelo: 'Multifan',
    nave: 2,
    ubicacion: 'Nave 2',
    estado: 'En espera',
    potencia: 0,
    conBarra: true,
    icono: 'wind',
    queEstaPasando: 'Se encienden solos si la humedad de la nave pasa de 85 %.',
  },
  {
    id: 'EQ-04',
    tipo: 'Extractores',
    modelo: 'Atem 1100',
    nave: 6,
    ubicacion: 'Nave 6',
    estado: 'En marcha',
    potencia: 40,
    conBarra: true,
    icono: 'extract',
    queEstaPasando: 'Renuevan el aire de la nave con caudal bajo. Todo normal.',
  },
  {
    id: 'EQ-05',
    tipo: 'Enfriadores de aire',
    nombreCorto: 'Enfriador',
    modelo: 'Evaporativo',
    nave: 1,
    ubicacion: 'Nave 1',
    estado: 'Aviso',
    potencia: 0,
    conBarra: false,
    icono: 'droplet',
    queEstaPasando: 'No responde desde hace 14 min. Conviene pedir servicio técnico.',
  },
  {
    id: 'EQ-06',
    tipo: 'Automatización y control',
    modelo: 'Programador',
    nave: 5,
    ubicacion: `Bloque ${ESTRUCTURA.bloque}`,
    estado: 'Activo',
    potencia: 100,
    conBarra: false,
    icono: 'cpu',
    queEstaPasando: 'Humedad ≥ 85 % enciende ventilación; la temperatura alta acciona cortinas.',
  },
];

/** Reglas que tiene cargadas el programador de clima. */
export const REGLAS_PROGRAMADOR = 2;

export const SERVICIO_TECNICO = {
  titulo: 'Servicio técnico Agrar',
  texto:
    'Soporte presencial y remoto, capacitación en mantenimiento y seguimiento postventa de tus equipos.',
  telefono: '+57 000 000 0000',
  correo: 'contacto@ejemplo.com',
};

/** Aviso obligatorio en la pantalla de equipos. */
export const NOTA_DATOS_EJEMPLO =
  'Datos de ejemplo. Las cifras y estados de esta pantalla son simulados por el prototipo, no son lecturas reales de los equipos.';

// ── Historial de la semana (para el registro de incidencias) ────────────────
/** Quiénes revisan los hallazgos en el historial de ejemplo. */
export const REVISORES = ['Marcela P. · agrónoma', 'Samuel R.'];

/**
 * Hallazgos ya revisados de días anteriores, para que el registro muestre la
 * semana completa. Cuadran con: 31 hallazgos, 18 confirmados, 5 falsas
 * alarmas y 78 % de precisión.
 */
export const HISTORICO = {
  confirmados: 17,
  falsasAlarmas: 4,
  porRevisar: 1,
  /** Días hacia atrás que cubre el historial. */
  dias: 7,
};

// ── Usuario de la demo ──────────────────────────────────────────────────────
export const USUARIO = {
  nombre: 'Samuel',
  /** Como se firma en el registro. */
  firma: 'Samuel R.',
  iniciales: 'SR',
  rol: 'Encargado de cultivo',
};

/** Nombre del dispositivo al que se "envían" los hallazgos (simulado). */
export const DISPOSITIVO_GAFAS = 'Meta Quest 3';
