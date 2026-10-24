/**
 * Tipos compartidos entre /web y /server.
 * Interfaz única del contrato de datos (CONTRATO_DATOS.md).
 * Si el contrato cambia, se cambia aquí y los dos lados se enteran al compilar.
 */

// ── Estado de una planta o de una celda del mapa ────────────────────────────
/**
 * Ciclo de vida de una planta marcada:
 * alerta (el robot la señaló) → en_revision (alguien va a mirarla en campo)
 * → confirmada (sí está afectada) o de vuelta a ok/riesgo si fue falsa alarma.
 */
export type EstadoCelda =
  | 'ok'
  | 'riesgo'
  | 'alerta'
  | 'en_revision'
  | 'confirmada'
  | 'sin_dato';

// ── Hallazgos del robot ─────────────────────────────────────────────────────
export type TipoHallazgo = 'Botrytis' | 'Alternaria' | 'Oídio';
export type RevisionHallazgo = 'pendiente' | 'en_revision' | 'confirmada' | 'falsa_alarma';

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

// ── Avisos por SMS ──────────────────────────────────────────────────────────
/**
 * Canal de respaldo: en el campo el internet se cae, pero la señal de celular
 * suele aguantar. Es una SIMULACIÓN: el servidor no manda mensajes de verdad,
 * no hay pasarela ni operador conectado.
 */
export type EstadoSms = 'enviado' | 'entregado' | 'fallido';

/** Cuándo se manda el SMS. */
export type CuandoSms = 'siempre' | 'sin_internet';

/** Un país para el selector de indicativo telefónico. La bandera es un emoji — sin imágenes, no hay nada que falle al abrir el dropdown. */
export interface PaisTelefono {
  nombre: string;
  bandera: string;
  /** Ej. "+57". */
  codigo: string;
}

export interface DestinoSms {
  /** Ej. "SMS-1" */
  id: string;
  nombre: string;
  /** Formato internacional, ej. "+57 310 555 0142". */
  numero: string;
  activo: boolean;
}

export interface EnvioSms {
  id: string;
  destinoId: string;
  numero: string;
  nombre: string;
  /** Texto tal como llegaría al celular. */
  texto: string;
  estado: EstadoSms;
  /** ISO 8601 */
  enviadoEn: string;
  /** ISO 8601 — cuándo lo confirmó la pasarela. */
  entregadoEn?: string;
  motivo: 'alerta' | 'prueba';
  alertaId?: string;
  plantaId?: string;
  /** Etiqueta corta de la planta, ej. "C14-P65". */
  etiqueta?: string;
  /** Qué pasarela lo mandó. */
  proveedor: ProveedorSms;
  /** Identificador del mensaje en la pasarela (evidencia del envío real). */
  referencia?: string;
  /** Por qué falló, si falló. */
  error?: string;
  /** Salió, pero con alguna salvedad (ej. la plantilla fija del trial). */
  aviso?: string;
}

// ── Pasarela de mensajes ────────────────────────────────────────────────────
/**
 * `simulado` no manda nada: deja el envío en pantalla y en el registro.
 * `twilio` manda SMS de verdad (en cuenta de prueba, con plantilla fija).
 * `whatsapp` usa el sandbox de WhatsApp de Twilio: gratis y con texto propio.
 * `telegram` manda al chat de un bot, también gratis.
 * Los dos últimos necesitan internet en el celular, así que no cubren el caso
 * de "la finca se quedó sin cobertura": eso solo lo resuelve el SMS.
 */
export type ProveedorSms = 'simulado' | 'twilio' | 'whatsapp' | 'telegram';

/** Resultado de comprobar las credenciales sin mandar ningún mensaje. */
export interface VerificacionPasarela {
  ok: boolean;
  mensaje: string;
  /** Lo que respondió el proveedor, para depurar. */
  detalle?: string;
}

export interface EstadoPasarela {
  proveedor: ProveedorSms;
  /** true solo si hay credenciales y los mensajes salen de verdad. */
  real: boolean;
  /** Nombre para mostrar, ej. "Twilio" o "Simulada". */
  nombre: string;
  /** Desde dónde se manda, ej. el número de Twilio. */
  remitente?: string;
  /** Qué falta configurar para que salga de verdad. */
  falta?: string;
}

export interface ConfiguracionSms {
  activo: boolean;
  cuando: CuandoSms;
  /** Prioridad mínima de la alerta para que salga un SMS. */
  prioridadMinima: PrioridadAlerta;
  /** Estado simulado de la conexión de la finca. */
  hayInternet: boolean;
  destinos: DestinoSms[];
}

export interface SmsRespuesta {
  config: ConfiguracionSms;
  pasarela: EstadoPasarela;
  envios: EnvioSms[];
  /** Caracteres que caben en un mensaje. */
  limite: number;
  /** Cómo quedaría el mensaje de la última alerta. */
  ejemplo: string;
  /** Por qué una alerta alta NO saldría por SMS ahora; null si sí sale. */
  motivoBloqueo: string | null;
  nota: string;
}

// ── Registro de incidentes ──────────────────────────────────────────────────
export type AccionRegistro =
  | 'en_revision'
  | 'confirmada'
  | 'falsa_alarma'
  | 'enviada_a_gafas'
  | 'alerta_nueva'
  | 'equipo'
  | 'sms';

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

// ── Series y análisis ───────────────────────────────────────────────────────
export type RangoSerie = '24h' | '7d' | '30d';

export interface PuntoClima {
  /** ISO 8601 del momento que representa el punto. */
  momento: string;
  /** Etiqueta corta ya formateada para el eje ("14:00", "mar 21"). */
  etiqueta: string;
  /** % de humedad relativa, promedio del bloque. */
  humedad: number;
  /** °C, promedio del bloque. */
  temperatura: number;
}

export interface ClimaDeNave {
  nave: number;
  humedad: number;
  temperatura: number;
  /** Camas de la nave por encima del umbral de riesgo. */
  camasEnRiesgo: number;
}

export interface HallazgosDelDia {
  /** ISO de medianoche del día. */
  dia: string;
  etiqueta: string;
  total: number;
  Botrytis: number;
  Alternaria: number;
  Oidio: number;
}

export interface SeriesRespuesta {
  rango: RangoSerie;
  clima: PuntoClima[];
  porNave: ClimaDeNave[];
  hallazgos: HallazgosDelDia[];
  resumen: {
    humedadMedia: number;
    humedadMaxima: number;
    temperaturaMedia: number;
    temperaturaMaxima: number;
    /** Horas del rango con la humedad por encima del umbral. */
    horasSobreUmbral: number;
    umbralHumedad: number;
    totalHallazgos: number;
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
// La configuración de los avisos por SMS va aparte (GET/PUT /api/sms): vive en
// memoria del servidor y no en la tabla Configuracion, para no mezclar los
// umbrales del cultivo con los datos de contacto.

// ── vigIA: agente de consulta + insights automáticos ────────────────────────
/**
 * vigIA NO es un modelo de lenguaje: cada "pregunta" es un botón que llama a
 * una herramienta determinista sobre datos reales (ver server/src/vigia/).
 * Nunca inventa cifras — si falta un dato, la respuesta lo dice.
 */
export type PrioridadInsight = 'alta' | 'media' | 'baja';
export type EstadoInsight = 'nuevo' | 'revisado' | 'descartado';
export type TipoInsight =
  | 'alerta_nueva'
  | 'zona_recurrente'
  | 'humedad_persistente'
  | 'cambio_ambiental'
  | 'equipo_sin_respuesta'
  | 'resumen_ronda';

export type TipoDetalleVigia = 'planta' | 'hallazgo' | 'cama' | 'nave' | 'equipo';

export interface Insight {
  id: string;
  tipo: TipoInsight;
  titulo: string;
  descripcion: string;
  prioridad: PrioridadInsight;
  /** ISO 8601 */
  fecha: string;
  /** Etiqueta corta de dónde aplica, ej. "C14-P65" o "Nave 5". */
  ubicacion?: string;
  cama?: number;
  planta?: number;
  nave?: number;
  /** Los números que respaldan el insight, tal como estaban al generarlo. */
  datos: unknown;
  /** Qué condiciones contribuyeron, ej. ["humedad 92 %", "3 hallazgos en 7 días"]. */
  factores?: string[];
  /** 0–1 cuando hay una estimación válida (ej. viene de la confianza del robot). */
  confianza?: number;
  explicacion?: string;
  recomendacion?: string;
  detalleTipo?: TipoDetalleVigia;
  detalleId?: string;
  estado: EstadoInsight;
}

/** Las "preguntas" que vigIA sabe responder — cada una es un botón en el chat. */
export type AccionVigia =
  | 'estado_general'
  | 'alertas_pendientes'
  | 'explicar_alerta'
  | 'comparar_camas'
  | 'zonas_recurrentes'
  | 'resumen_ronda'
  | 'informe_diario'
  | 'informe_semanal'
  | 'precision_detecciones'
  | 'sugerir_inspeccion'
  | 'estado_equipos'
  | 'tendencia_humedad'
  | 'consultar_configuracion';

export interface ParametroVigia {
  nombre: string;
  tipo: 'planta' | 'cama' | 'numero' | 'texto';
  requerido: boolean;
  etiqueta: string;
}

export interface AccionVigiaInfo {
  id: AccionVigia;
  etiqueta: string;
  descripcion: string;
  parametros?: ParametroVigia[];
}

export interface EnlaceVigia {
  texto: string;
  tipo: TipoDetalleVigia;
  id: string;
}

export interface RespuestaVigia {
  accion: AccionVigia;
  titulo: string;
  texto: string;
  prioridad?: PrioridadInsight;
  datos?: unknown;
  factores?: string[];
  /** 0–1; solo cuando la respuesta trae una estimación (no un conteo exacto). */
  confianza?: number;
  explicacion?: string;
  recomendacion?: string;
  enlaces?: EnlaceVigia[];
  /** ISO 8601 */
  generadoEn: string;
  /** Si la acción no pudo responder (faltan datos, parámetro inválido). */
  error?: string;
}

export interface VigiaRespuestaAcciones {
  acciones: AccionVigiaInfo[];
}

export interface VigiaInsightsRespuesta {
  insights: Insight[];
  nuevos: number;
}

// ── Simulación: tratar vs no tratar un hallazgo ─────────────────────────────
/**
 * Proyección determinista (no es un modelo epidemiológico real): sirve para
 * mostrar en la demo el contraste entre tratar a tiempo y no hacerlo. Ver
 * server/src/vigia/simulacion.ts para las reglas exactas.
 */
export interface EstadoSimuladoDia {
  dia: number;
  sanas: number;
  riesgo: number;
  alerta: number;
  /** Ids de plantas que pasan a alerta ESE día (para animar/resaltar). */
  nuevasAfectadas: string[];
}

export interface SimulacionRespuesta {
  hallazgoId: string;
  plantaId: string;
  etiqueta: string;
  tipo: TipoHallazgo;
  cama: number;
  dias: number;
  tratada: EstadoSimuladoDia[];
  noTratada: EstadoSimuladoDia[];
  resumen: {
    tratada: string;
    noTratada: string;
  };
  nota: string;
}

// ── Eventos en vivo (SSE) ───────────────────────────────────────────────────
export type EventoVivo =
  | { tipo: 'alerta_nueva'; alerta: Alerta }
  | { tipo: 'estado_cambiado'; plantaId: string; estado: EstadoCelda }
  | { tipo: 'equipos_actualizados'; eventos: EventoEquipo[] }
  | { tipo: 'sms_enviado'; envios: EnvioSms[] }
  | { tipo: 'insight_nuevo'; insight: Insight };

// ── Respuesta de "enviar a las gafas" ───────────────────────────────────────
export interface RespuestaGafas {
  hallazgoId: string;
  gafas: EstadoGafas;
  dispositivo: string;
  /** ISO 8601 */
  enviadoEn: string;
}
