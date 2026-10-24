/**
 * Tipos compartidos entre /web y /server.
 * Interfaz única del contrato de datos (CONTRATO_DATOS.md).
 * Si el contrato cambia, se cambia aquí y los dos lados se enteran al compilar.
 */

// ── Estado de una planta o de una celda del mapa ────────────────────────────
export type EstadoCelda = 'ok' | 'riesgo' | 'alerta' | 'sin_dato';

// ── Hallazgos del robot ─────────────────────────────────────────────────────
export type TipoHallazgo = 'Botrytis' | 'Alternaria' | 'Oídio';
export type RevisionHallazgo = 'pendiente' | 'confirmada' | 'falsa_alarma';

/** Caja del hallazgo sobre la foto, en coordenadas normalizadas 0–1. */
export interface BBox {
  x: number;
  y: number;
  w: number;
  h: number;
}

export type EstadoGafas = 'no_enviado' | 'enviado' | 'recibido';

export interface Hallazgo {
  /** Ej. "H-0007" */
  id: string;
  /** Ej. "B5-C14-P065" */
  plantaId: string;
  cama: number;
  planta: number;
  nave: number;
  tipo: TipoHallazgo;
  /** 0–1 */
  confianza: number;
  bbox: BBox;
  revision: RevisionHallazgo;
  /** ISO 8601 */
  detectadoEn: string;
  /** % de humedad relativa en el momento de la detección */
  humedad: number;
  /** Placeholder SVG servido por el API; se reemplaza por la foto real del robot. */
  fotoUrl: string;
  gafas: EstadoGafas;
  /** Qué hacer, según el tipo de hallazgo (viene de la configuración). */
  recomendacion: string;
}

// ── Plantas, celdas y camas ─────────────────────────────────────────────────
export interface Planta {
  /** Ej. "B5-C14-P065" */
  id: string;
  cama: number;
  /** 1–100 */
  planta: number;
  nave: number;
  estado: EstadoCelda;
  /** % humedad relativa */
  humedad: number;
  /** °C */
  temperatura: number;
  hallazgoId?: string;
  /** ISO 8601 */
  ultimaLectura: string;
}

/** Una celda del mapa agrupa ~2,5 plantas (40 celdas por cama). */
export interface Celda {
  /** 0–39 */
  indice: number;
  cama: number;
  nave: number;
  estado: EstadoCelda;
  humedad: number;
  temperatura: number;
  /** Números de planta (1–100) que caen en esta celda. */
  plantas: number[];
  /** Si la celda está en alerta, el hallazgo que la causó. */
  hallazgoId?: string;
  /** Planta concreta del hallazgo, para abrir el detalle. */
  plantaId?: string;
}

export interface Cama {
  /** 1–24 */
  numero: number;
  nave: number;
  celdas: Celda[];
}

export interface Nave {
  numero: number;
  camas: number[];
  /** Promedio de humedad de la nave, en %. */
  humedad: number;
}

export interface ZonaHumeda {
  cama: number;
  nave: number;
  desde: number;
  hasta: number;
  humedad: number;
}

export interface EstadoRobot {
  nombre: string;
  estado: string;
  nave: number;
  bateria: number;
  ronda: number;
  rondasTotales: number;
  progreso: number;
  /** ISO 8601 */
  ultimaRonda: string;
}

export interface Resumen {
  bloque: string;
  totalPlantas: number;
  sanas: number;
  riesgo: number;
  alerta: number;
  porRevisar: number;
  /** % de plantas sanas sobre el total del bloque. */
  porcentajeSanas: number;
  robot: EstadoRobot;
  /** ISO 8601 */
  actualizado: string;
}

export interface MapaRespuesta {
  bloque: string;
  camas: Cama[];
  naves: Nave[];
  resumen: Resumen;
  zonasHumedas: ZonaHumeda[];
  sugerencia: {
    texto: string;
    nota: string;
  };
}

/** Respuesta de GET /api/plantas/:id */
export interface DetallePlanta {
  planta: Planta;
  /** Etiqueta corta, ej. "C14-P65". */
  etiqueta: string;
  hallazgo: Hallazgo | null;
  serieHumedad: Array<{ hora: string; valor: number }>;
  vecinas: Array<Planta & { etiqueta: string }>;
}

// ── Alertas ─────────────────────────────────────────────────────────────────
export type PrioridadAlerta = 'alta' | 'media' | 'baja';

export interface Alerta {
  id: string;
  hallazgoId: string;
  plantaId: string;
  cama: number;
  planta: number;
  nave: number;
  tipo: TipoHallazgo;
  confianza: number;
  humedad: number;
  prioridad: PrioridadAlerta;
  revision: RevisionHallazgo;
  /** ISO 8601 */
  detectadoEn: string;
  fotoUrl: string;
}

// ── Registro de incidentes ──────────────────────────────────────────────────
export type AccionRegistro =
  | 'confirmada'
  | 'falsa_alarma'
  | 'enviada_a_gafas'
  | 'alerta_nueva'
  | 'equipo';

export interface EntradaRegistro {
  id: string;
  /** ISO 8601 */
  fecha: string;
  plantaId?: string;
  cama?: number;
  accion: AccionRegistro;
  tipo?: TipoHallazgo;
  usuario: string;
  nota: string;
}

/** Una fila de la tabla "Registro de incidencias": un hallazgo y su decisión. */
export interface FilaRegistro {
  id: string;
  /** ISO 8601 — cuándo lo detectó el robot. */
  fecha: string;
  plantaId: string;
  /** Etiqueta corta, ej. "C14-P65". */
  etiqueta: string;
  cama: number;
  nave: number;
  tipo: TipoHallazgo;
  confianza: number;
  decision: RevisionHallazgo;
  /** Quién lo revisó; vacío si sigue por revisar. */
  reviso?: string;
}

export interface ResumenRegistro {
  /** Hallazgos de la semana mostrada. */
  hallazgos: number;
  confirmados: number;
  falsasAlarmas: number;
  porRevisar: number;
  /** Confirmados / revisados, en %. */
  precision: number;
  /** Rango de fechas mostrado, ya formateado. */
  semana: string;
}

export interface RegistroRespuesta {
  filas: FilaRegistro[];
  resumen: ResumenRegistro;
}

// ── Equipos de clima ────────────────────────────────────────────────────────
export type EstadoEquipo = 'En marcha' | 'En espera' | 'Aviso' | 'Activo';

export type IconoEquipo = 'fan' | 'rotate' | 'wind' | 'extract' | 'droplet' | 'cpu';

export interface Equipo {
  id: string;
  /** Familia del equipo, ej. "Ventiladores de cesta". */
  tipo: string;
  modelo: string;
  nave: number;
  /** Cómo se escribe la ubicación en la tarjeta, ej. "Naves 3 y 4". */
  ubicacion: string;
  estado: EstadoEquipo;
  /** 0–100 % */
  potencia: number;
  /** % humedad de la nave donde está el equipo */
  humedad: number;
  /** ISO 8601 */
  ultimoDato: string;
  queEstaPasando: string;
  icono: IconoEquipo;
  /** Los equipos sin potencia regulable no muestran la barra. */
  conBarra: boolean;
  /** Las dos cifras que muestra la tarjeta, ya formateadas. */
  metricas: Array<{ etiqueta: string; valor: string }>;
}

export interface EventoEquipo {
  id: string;
  /** ISO 8601 */
  fecha: string;
  texto: string;
  nave?: number;
  equipoId?: string;
  /** Alerta de cultivo con la que se relaciona el evento, si aplica. */
  plantaId?: string;
}

export interface ResumenEquipos {
  enMarcha: number;
  total: number;
  enEspera: number;
  avisos: number;
  /** Promedio de humedad de las naves, en %. */
  humedadMedia: number;
  /** Camas cuyo promedio de humedad pasa el umbral. */
  camasHumedas: number[];
  /** Nave donde están esas camas, si todas son de la misma. */
  naveCamasHumedas?: number;
  /** Equipo con aviso, para el texto del KPI. */
  avisoTexto?: string;
}

export interface EquiposRespuesta {
  equipos: Equipo[];
  resumen: ResumenEquipos;
  servicio: {
    titulo: string;
    texto: string;
    telefono: string;
    correo: string;
  };
}

// ── Configuración ───────────────────────────────────────────────────────────
export type EtapaCultivo = 'Vegetativa' | 'Floración' | 'Cuajado' | 'Cosecha';
export type NumeracionCamas = 'seguida' | 'por_nave';

export interface ConfiguracionEstructura {
  bloque: string;
  /** Nombre que se muestra, ej. "Bloque B5". */
  nombre: string;
  etapa: EtapaCultivo;
  naves: number;
  camasPorNave: number;
  plantasPorCama: number;
  plantasPorCelda: number;
  numeracion: NumeracionCamas;
  /** Medidas de una nave, en metros. */
  anchoNave: number;
  largoNave: number;
}

export interface ConfiguracionUmbrales {
  humedadRiesgo: number;
  humedadAlta: number;
  confianzaMinima: number;
  ventilacionAutomatica: boolean;
  avisoEmergente: boolean;
  /** Segundos que tarda la alerta del demo en llegar al mapa. */
  segundosAlertaDemo: number;
}

export interface Configuracion {
  estructura: ConfiguracionEstructura;
  umbrales: ConfiguracionUmbrales;
}

// ── Eventos en vivo (SSE) ───────────────────────────────────────────────────
export type EventoVivo =
  | { tipo: 'alerta_nueva'; alerta: Alerta }
  | { tipo: 'estado_cambiado'; plantaId: string; estado: EstadoCelda }
  | { tipo: 'equipos_actualizados'; eventos: EventoEquipo[] };

// ── Respuesta de "enviar a las gafas" ───────────────────────────────────────
export interface RespuestaGafas {
  hallazgoId: string;
  gafas: EstadoGafas;
  dispositivo: string;
  /** ISO 8601 */
  enviadoEn: string;
}
