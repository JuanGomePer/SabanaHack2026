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
/**
 * Las 3 enfermedades/plagas que vigila la app (las que le importan a AGRAR
 * para arándano). El nombre corto es el identificador interno; el nombre
 * científico que ve el usuario está en `ETIQUETA_CIENTIFICA_TIPO`
 * (@vigia/shared/config).
 */
export type TipoHallazgo = 'Botrytis' | 'Alternaria' | 'Trips';
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
  /**
   * `alerta` es el aviso del robot; `decision` es el segundo aviso, el que
   * sale cuando el encargado ya confirmó o descartó en la app.
   */
  motivo: 'alerta' | 'decision' | 'prueba';
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
  /**
   * Avisar también la decisión: cuando el encargado confirma o descarta en la
   * app, al que está en campo le llega si toca tener cuidado y en qué camas.
   */
  avisarDecision: boolean;
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
  /** Cómo quedaría el aviso de la decisión, una vez confirmada la alerta. */
  ejemploDecision: string;
  /** Por qué una alerta alta NO saldría por SMS ahora; null si sí sale. */
  motivoBloqueo: string | null;
  /** Por qué el aviso de la decisión NO saldría ahora; null si sí sale. */
  motivoBloqueoDecision: string | null;
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
  /**
   * Apagado a mano por el encargado (pantalla de Equipos o paso de protocolo).
   * Mientras esté desactivado, el programador no lo vuelve a encender solo.
   */
  desactivado: boolean;
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
  /** Equipos apagados a mano por el encargado. */
  desactivados: number;
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
  /**
   * Cuántas camas de la nave tienen al menos un tramo por encima del umbral.
   * Es el mismo criterio de "cama húmeda" del mapa: una cama de 100 plantas
   * casi nunca pasa el umbral de promedio, pero el hongo arranca en el tramo
   * húmedo, no en el promedio.
   */
  camasEnRiesgo: number;
  /** Qué camas son, para poder nombrarlas en pantalla. */
  camasEnRiesgoLista: number[];
}

/**
 * Proyección de propagación: si hoy hay camas en riesgo, cuántas más caerían
 * si nadie baja la humedad.
 *
 * NO es un modelo epidemiológico. Es una regla de vecindad: Botrytis y
 * Alternaria se propagan por salpique de agua, roce de follaje y aire dentro
 * de la misma nave, así que cada cama en riesgo expone a las camas contiguas
 * de su nave. La pantalla lo dice tal cual.
 */
export interface PropagacionRiesgo {
  /** Camas con al menos una planta sobre el umbral, hoy. */
  camasHoy: number[];
  /** Camas vecinas que todavía no están en riesgo y quedarían expuestas. */
  camasExpuestas: number[];
  /** Camas en riesgo que habría al final de la ventana, si no se atiende. */
  proyeccion: number;
  /** Ventana de la proyección, en horas. */
  horas: number;
  /** Plantas que hay en las camas expuestas. */
  plantasExpuestas: number;
  /** Naves donde está pasando. */
  naves: number[];
  /** Naves en las que caen las camas expuestas (puede ser la de al lado). */
  navesExpuestas: number[];
  /** Hallazgos ya confirmados en campo en las camas de hoy. */
  confirmados: number;
}

export interface HallazgosDelDia {
  /** ISO de medianoche del día. */
  dia: string;
  etiqueta: string;
  total: number;
  Botrytis: number;
  Alternaria: number;
  Trips: number;
}

export interface SeriesRespuesta {
  rango: RangoSerie;
  clima: PuntoClima[];
  porNave: ClimaDeNave[];
  hallazgos: HallazgosDelDia[];
  propagacion: PropagacionRiesgo;
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

// ── Predicción de humedad y temperatura ─────────────────────────────────────
/** Un día del histórico con el que se entrena la regresión. */
export interface DiaHistorico {
  /** ISO de medianoche del día. */
  dia: string;
  etiqueta: string;
  humedad: number;
  temperatura: number;
}

/** Un día proyectado hacia adelante. */
export interface DiaPredicho {
  dia: string;
  etiqueta: string;
  /** Humedad relativa prevista para el promedio del bloque, en %. */
  humedad: number;
  /**
   * Humedad prevista en la zona húmeda del bloque (los tramos que hoy están
   * por encima del umbral). Es la que decide si el día es de cuidado: el hongo
   * arranca ahí, no en el promedio.
   */
  humedadZona: number;
  /** Temperatura prevista, en °C. */
  temperatura: number;
  /** Media banda de confianza, en puntos de humedad (± sobre `humedad`). */
  margen: number;
  /** Probabilidad estimada de pasar el umbral de riesgo (0–1). */
  probabilidad: number;
  /** Día de cuidado: la probabilidad de pasar el umbral llega a la mitad. */
  cuidado: boolean;
}

/** El ajuste en sí, para poder mostrar de qué está hecha la predicción. */
export interface ModeloPrediccion {
  /** Puntos de humedad que sube (o baja) por día, según la regresión. */
  pendiente: number;
  /** Humedad ajustada al primer día del histórico, en %. */
  intercepto: number;
  /** Qué tanto explica la recta el histórico (0–1). */
  r2: number;
  /** Error típico del ajuste, en puntos de humedad. */
  error: number;
  /** Días de histórico usados. */
  dias: number;
  /** Peso del clima de la región frente a la tendencia propia (0–1). */
  pesoClima: number;
  /**
   * Diferencia entre la humedad del invernadero y la normal de la Sabana para
   * este mes, en puntos. Positiva = el invernadero va más húmedo que afuera.
   */
  desviacionRegional: number;
  /** La zona húmeda de hoy: dónde está y a cuánto va. */
  zonaCaliente: {
    /** Camas que tienen tramos por encima del umbral (o los más húmedos). */
    camas: number[];
    /** Humedad media de esos tramos, en %. */
    humedad: number;
    /** Cuántas plantas son. */
    plantas: number;
  };
}

/** Cama que el robot debería revisar con más detalle el día de cuidado. */
export interface CamaPrioritaria {
  cama: number;
  nave: number;
  /** Humedad del tramo más húmedo de la cama, en %. */
  humedad: number;
  /** Plantas de la cama que hoy ya están sobre el umbral. */
  plantasSobreUmbral: number;
  /** Hallazgos de los últimos 30 días en esa cama. */
  hallazgos: number;
}

export interface PrediccionRespuesta {
  /** Umbral de humedad configurado, en %. */
  umbral: number;
  historico: DiaHistorico[];
  prediccion: DiaPredicho[];
  modelo: ModeloPrediccion;
  /** Primer día de cuidado de la proyección, si hay alguno. */
  diaCritico?: DiaPredicho;
  /** Camas a revisar con más detalle ese día, de más a menos riesgo. */
  camasPrioritarias: CamaPrioritaria[];
  /** Clima de referencia de la Sabana usado para el mes del día crítico. */
  climaReferencia: {
    mes: string;
    humedad: number;
    temperatura: number;
    temporada: string;
  };
}

// ── Protocolos: dónde se concentra cada tipo, para los pasos de acción ──────
export interface ConcentracionPorNave {
  nave: number;
  cantidad: number;
}

export interface ConcentracionTipo {
  tipo: TipoHallazgo;
  total: number;
  /** % del total de hallazgos del bloque que es de este tipo. */
  porcentaje: number;
  /** Naves con al menos un hallazgo de este tipo, de más a menos cantidad. */
  porNave: ConcentracionPorNave[];
  /** Confianza promedio de los hallazgos de este tipo (0–1). */
  confianzaMedia: number;
}

export interface ProtocolosRespuesta {
  total: number;
  dias: number;
  tipos: ConcentracionTipo[];
}

// ── Configuración ───────────────────────────────────────────────────────────
export type EtapaCultivo = 'Vegetativa' | 'Floración' | 'Cuajado' | 'Cosecha';
export type NumeracionCamas = 'seguida' | 'por_nave';

/** Un robot dado de alta en el bloque. */
export interface RobotConfigurado {
  id: string;
  nombre: string;
  /** Nave que tiene asignada para sus rondas. */
  nave: number;
}

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
  /**
   * Robots del bloque. Puede haber más de uno: cada uno recorre la nave que
   * tiene asignada. Solo el que está conectado reporta batería y posición en
   * vivo; los demás quedan dados de alta con su nave.
   */
  robots: RobotConfigurado[];
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

export interface PerfilUsuario {
  nombre: string;
  /** Como se firma en el registro, ej. "Samuel R.". */
  firma: string;
  rol: string;
}

export interface Configuracion {
  estructura: ConfiguracionEstructura;
  umbrales: ConfiguracionUmbrales;
  perfil: PerfilUsuario;
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
