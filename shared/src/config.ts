/**
 * SUPUESTOS DEL PROTOTIPO — todos editables desde aquí.
 *
 * Las cifras de estructura, umbrales y equipos son supuestos pendientes de
 * confirmar con el mentor (Agrar Ingeniería). No están repartidas por el
 * código: cambiar un número aquí cambia el backend y el frontend.
 */

import type {
  ConfiguracionEstructura,
  ConfiguracionSms,
  ConfiguracionUmbrales,
  PaisTelefono,
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
  /**
   * Medidas de una nave, en metros. Con 8 naves de 7,8 × 80 m el bloque da
   * 4.992 m²: la media hectárea que tiene el cultivo de referencia.
   */
  anchoNave: 7.8,
  largoNave: 80,
  /** Un robot de arranque; se dan de alta más desde Configuración. */
  robots: [{ id: 'X2-01', nombre: 'Robot X2', nave: 6 }],
};

/** Superficie del bloque en m², a partir de las medidas de sus naves. */
export function metrosCuadradosDe(estructura: ConfiguracionEstructura): number {
  return estructura.naves * estructura.anchoNave * estructura.largoNave;
}

/** La misma superficie en hectáreas. */
export function hectareasDe(estructura: ConfiguracionEstructura): number {
  return metrosCuadradosDe(estructura) / 10_000;
}

/**
 * Media hectárea, con holgura: el cultivo de referencia mide eso, y la etiqueta
 * "≈ media hectárea" ayuda más que un número con cuatro decimales.
 */
export function esMediaHectarea(estructura: ConfiguracionEstructura): boolean {
  const ha = hectareasDe(estructura);
  return ha >= 0.4 && ha <= 0.6;
}

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

/**
 * Camas físicamente pegadas a una: la anterior y la siguiente de la
 * numeración, sin salirse del bloque.
 *
 * Con la numeración seguida, la cama de al lado puede caer en la nave vecina
 * (la 15 es la última de la nave 5 y la 16 la primera de la nave 6). Se
 * incluyen igual: están separadas por un pasillo, y el salpique de agua, el
 * roce de follaje y el aire que corre entre naves no saben de esa frontera.
 */
export function camasVecinasDe(cama: number): number[] {
  return [cama - 1, cama + 1].filter((otra) => otra >= 1 && otra <= TOTAL_CAMAS);
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
  'Trips',
  'Alternaria',
  'Botrytis',
];

/** La alerta nueva del demo: cama 14, planta 65. */
export const ALERTA_DEMO = { cama: 14, planta: 65, tipo: 'Botrytis' as TipoHallazgo };

/**
 * Las alertas llegan solas, una detrás de otra, sin esperar a que el encargado
 * revise la anterior: el robot sigue su ronda pase lo que pase, y en pantalla
 * se van apilando. La primera usa la demora configurable (`segundosAlertaDemo`);
 * las demás, los segundos de aquí desde que el mapa se conecta.
 */
export const GUION_ALERTAS_DEMO: Array<{
  segundos: number;
  cama: number;
  planta: number;
  tipo: TipoHallazgo;
  confianza: number;
}> = [
  { segundos: 3, cama: 14, planta: 65, tipo: 'Botrytis', confianza: 0.93 },
  { segundos: 13, cama: 15, planta: 72, tipo: 'Botrytis', confianza: 0.86 },
  { segundos: 24, cama: 9, planta: 23, tipo: 'Trips', confianza: 0.81 },
  { segundos: 38, cama: 21, planta: 58, tipo: 'Alternaria', confianza: 0.76 },
];

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

/**
 * Nombre científico/común que ve el usuario, por cada tipo interno. El
 * identificador interno (corto, sin tildes ni espacios) es el que vive en
 * la base de datos y en el código; este es solo para mostrar.
 */
export const ETIQUETA_CIENTIFICA_TIPO: Record<TipoHallazgo, string> = {
  Botrytis: 'Botrytis cinerea',
  Alternaria: 'Alternaria sp',
  Trips: 'Trips',
};

// ── Qué hacer, por tipo de hallazgo ─────────────────────────────────────────
export const RECOMENDACIONES: Record<TipoHallazgo, string> = {
  Botrytis:
    'Retira el fruto afectado y los pétalos secos. Baja la humedad de la nave por debajo de 85 % antes de la noche y revisa las plantas vecinas.',
  Alternaria:
    'Quita las hojas con manchas y sácalas del invernadero. Evita el riego por aspersión en esta cama y mejora la circulación de aire.',
  Trips:
    'Instala trampas azules/amarillas pegajosas para confirmar la presión de la plaga. Elimina malezas en floración cerca del invernadero (hospedero habitual) y evita insecticidas de amplio espectro que maten a los ácaros depredadores naturales.',
};

/**
 * Paso 1 de los tres protocolos: apagar lo que esté moviendo aire en la nave.
 *
 * Es el mismo para Botrytis, Alternaria y Trips porque el motivo es el mismo:
 * con los ventiladores, extractores y brazos encendidos, el aire reparte las
 * esporas (y arrastra los trips) a las camas vecinas antes de que alguien
 * llegue a revisar. En la pantalla este paso trae una casilla por equipo
 * encendido, para apagarlos sin salir de ahí.
 */
export const PASO_APAGAR_EQUIPOS =
  'Apaga primero los equipos de clima encendidos en la nave afectada (ventiladores, extractores, brazos y el programador): con el aire en movimiento lo detectado se reparte a las camas vecinas. Puedes apagarlos aquí mismo, uno por uno.';

/**
 * Protocolos de acción paso a paso por tipo, para la pantalla de Protocolos.
 * Son prácticas de manejo integrado de plagas/enfermedades conocidas para
 * arándano — igual que RECOMENDACIONES, la decisión final siempre es del
 * agrónomo, esto no reemplaza su criterio.
 */
export const PROTOCOLOS: Record<TipoHallazgo, string[]> = {
  Botrytis: [
    PASO_APAGAR_EQUIPOS,
    'Retira y saca del invernadero el fruto, flor o pétalo afectado — no lo dejes caer entre las camas, ahí esporula de nuevo.',
    'Baja la humedad relativa por debajo de 85 % antes de que caiga la noche, pero de forma pasiva: abre cortinas y ventanas. Los extractores se vuelven a encender solo cuando el foco ya esté retirado, para no soplar esporas a las camas vecinas.',
    'Mejora la circulación de aire podando follaje denso entre plantas vecinas a la mata afectada.',
    'Si hay flor abierta o fruto a punto de cosecha, coordina con el agrónomo la rotación de fungicida (nunca el mismo modo de acción dos veces seguidas, por resistencia).',
    'Marca la cama en el registro y revisa de nuevo en 48–72 h: Botrytis avanza rápido con humedad alta.',
  ],
  Alternaria: [
    PASO_APAGAR_EQUIPOS,
    'Quita las hojas con manchas concéntricas y sácalas del invernadero — no las dejes en el suelo, ahí sobrevive el hongo.',
    'Evita el riego por aspersión en esta cama, sobre todo en la tarde/noche: la hoja mojada muchas horas es lo que dispara la infección.',
    'Mejora el drenaje y la circulación de aire alrededor de la planta.',
    'Si la presión sube (varias plantas vecinas con síntomas), coordina con el agrónomo un fungicida específico para Alternaria.',
    'Revisa semanalmente las camas vecinas: Alternaria se propaga por salpique de agua y viento.',
  ],
  Trips: [
    PASO_APAGAR_EQUIPOS,
    'Confirma la plaga con trampas azules o amarillas pegajosas cerca de la zona — los trips son pequeños y fáciles de confundir con otra cosa a simple vista.',
    'Revisa y elimina malezas en floración alrededor del invernadero: son el hospedero habitual desde donde migran los trips.',
    'Evita insecticidas de amplio espectro: matan también a los ácaros depredadores (Amblyseius, Orius) que ya controlan la plaga de forma natural.',
    'Si el conteo en trampas supera el umbral, aplica un tratamiento dirigido (ej. base spinosad) solo en la zona afectada, no en todo el bloque.',
    'Vuelve a revisar en una semana: los trips tienen ciclos de vida cortos y la presión puede subir rápido en clima cálido y seco.',
  ],
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

/** Aviso obligatorio en la pantalla de equipos. */
export const NOTA_DATOS_EJEMPLO =
  'Datos de ejemplo: las cifras y estados de esta pantalla todavía no vienen del sistema de control de los equipos.';

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

// ── Clima de referencia de la Sabana de Bogotá ──────────────────────────────
/**
 * Normales mensuales del altiplano cundiboyacense (≈ 2.600 m), donde están
 * estos cultivos: humedad relativa media (%) y temperatura media (°C), con la
 * temporada a la que pertenece el mes.
 *
 * SUPUESTOS DE REFERENCIA, no una serie descargada del IDEAM: son los valores
 * típicos del régimen bimodal de la Sabana —seco en enero-febrero y
 * julio-agosto, lluvioso en abril-mayo y octubre-noviembre— y están aquí para
 * que la predicción tenga en cuenta la época del año. Si el equipo consigue la
 * serie real de la estación más cercana, se reemplazan estos doce números y la
 * predicción mejora sola.
 */
export type TemporadaSabana = 'seca' | 'transición' | 'lluvias';

export const CLIMA_SABANA: Array<{
  /** 1 = enero. */
  mes: number;
  nombre: string;
  humedad: number;
  temperatura: number;
  temporada: TemporadaSabana;
}> = [
  { mes: 1, nombre: 'enero', humedad: 75, temperatura: 13.2, temporada: 'seca' },
  { mes: 2, nombre: 'febrero', humedad: 76, temperatura: 13.5, temporada: 'seca' },
  { mes: 3, nombre: 'marzo', humedad: 78, temperatura: 13.9, temporada: 'transición' },
  { mes: 4, nombre: 'abril', humedad: 81, temperatura: 14.0, temporada: 'lluvias' },
  { mes: 5, nombre: 'mayo', humedad: 81, temperatura: 14.0, temporada: 'lluvias' },
  { mes: 6, nombre: 'junio', humedad: 79, temperatura: 13.7, temporada: 'transición' },
  { mes: 7, nombre: 'julio', humedad: 77, temperatura: 13.3, temporada: 'seca' },
  { mes: 8, nombre: 'agosto', humedad: 75, temperatura: 13.4, temporada: 'seca' },
  { mes: 9, nombre: 'septiembre', humedad: 76, temperatura: 13.4, temporada: 'transición' },
  { mes: 10, nombre: 'octubre', humedad: 80, temperatura: 13.6, temporada: 'lluvias' },
  { mes: 11, nombre: 'noviembre', humedad: 82, temperatura: 13.7, temporada: 'lluvias' },
  { mes: 12, nombre: 'diciembre', humedad: 79, temperatura: 13.4, temporada: 'transición' },
];

/** Clima de referencia del mes de una fecha (1 = enero). */
export function climaSabanaDeMes(mes: number) {
  return CLIMA_SABANA[Math.min(11, Math.max(0, mes - 1))];
}

/**
 * Cuánto pesa el clima de la Sabana en la predicción, frente a la tendencia
 * propia del invernadero (0 = solo tendencia, 1 = solo clima de la región).
 * Dentro del invernadero manda lo que hacen el riego y la ventilación, así que
 * la tendencia propia pesa más que la región.
 */
export const PESO_CLIMA_SABANA = 0.35;

/** Días hacia adelante que proyecta el modelo. */
export const DIAS_PREDICCION = 14;

/** Días de histórico con los que se ajusta la regresión. */
export const DIAS_HISTORICO_PREDICCION = 30;

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

// ── Indicativos telefónicos ─────────────────────────────────────────────────
/**
 * Países del selector de indicativo (al agregar un número en Avisos por SMS).
 * Colombia va primero porque es el país por defecto — ver PAIS_TELEFONO_DEFECTO.
 * Las banderas son emoji: no hay imágenes de por medio, así que no hay nada
 * que falle al abrir el dropdown ni que dependa de internet.
 */
export const PAISES_TELEFONO: PaisTelefono[] = [
  { nombre: 'Colombia', bandera: '🇨🇴', codigo: '+57' },
  { nombre: 'México', bandera: '🇲🇽', codigo: '+52' },
  { nombre: 'Perú', bandera: '🇵🇪', codigo: '+51' },
  { nombre: 'Ecuador', bandera: '🇪🇨', codigo: '+593' },
  { nombre: 'Venezuela', bandera: '🇻🇪', codigo: '+58' },
  { nombre: 'Chile', bandera: '🇨🇱', codigo: '+56' },
  { nombre: 'Argentina', bandera: '🇦🇷', codigo: '+54' },
  { nombre: 'Brasil', bandera: '🇧🇷', codigo: '+55' },
  { nombre: 'Panamá', bandera: '🇵🇦', codigo: '+507' },
  { nombre: 'Costa Rica', bandera: '🇨🇷', codigo: '+506' },
  { nombre: 'España', bandera: '🇪🇸', codigo: '+34' },
  { nombre: 'Estados Unidos', bandera: '🇺🇸', codigo: '+1' },
];

/** Colombia: es donde está el cultivo, así que es el indicativo por defecto. */
export const PAIS_TELEFONO_DEFECTO: PaisTelefono = PAISES_TELEFONO[0];

// ── Avisos por SMS ──────────────────────────────────────────────────────────
/**
 * Canal de respaldo para cuando la finca se queda sin internet: el aviso
 * también sale como mensaje de texto al celular del encargado.
 *
 * El envío real lo hace server/src/pasarela.ts (Twilio, WhatsApp o Telegram);
 * sin credenciales en el .env del servidor, queda en modo simulado.
 */
export const SMS: ConfiguracionSms = {
  activo: true,
  /**
   * Para la demo va en 'siempre', así la alerta nueva hace sonar el celular
   * delante del jurado. 'sin_internet' es el modo que tiene sentido en campo
   * (no duplica avisos) y se cambia desde la misma pantalla.
   */
  cuando: 'siempre',
  prioridadMinima: 'media',
  hayInternet: true,
  /**
   * El segundo aviso: cuando el encargado ya decidió en la app, al que está en
   * campo le llega qué se decidió y dónde tiene que tener cuidado.
   */
  avisarDecision: true,
  /**
   * Ojo con la cuenta de prueba de Twilio: solo escribe a números verificados
   * en la consola. Los demás quedan apagados para que no fallen en la demo.
   */
  destinos: [
    { id: 'SMS-1', nombre: 'Samuel R. · encargado', numero: '+57 312 654 0694', activo: true },
    { id: 'SMS-2', nombre: 'Marcela P. · agrónoma', numero: '+57 311 555 0198', activo: false },
  ],
};

/** Un SMS estándar: pasado de aquí el operador lo parte en dos mensajes. */
export const LIMITE_SMS = 160;

/**
 * Texto que llega al celular. Las llaves se reemplazan con los datos del
 * hallazgo; conviene dejarlo corto para que quepa en un solo mensaje.
 */
export const PLANTILLA_SMS =
  'VIGIA {etiqueta}: posible {tipo} {confianza}%. Nave {nave}, cama {cama}. Humedad {humedad}%. Revisa la planta.';

/**
 * Segundo mensaje, el de la decisión: sale cuando el encargado ya confirmó o
 * descartó en la app, para que el que está en campo sepa si toca tener cuidado
 * y exactamente dónde. {vecinas} son las camas de al lado, que es por donde se
 * propaga.
 */
export const PLANTILLA_SMS_DECISION =
  'VIGIA {etiqueta}: {tipo} CONFIRMADA por {usuario}. Nave {nave}, cama {cama}. Cuidado tambien en {vecinas}. Apaga la ventilacion de la nave.';

/** El mismo aviso cuando la decisión fue descartar: así nadie va de más. */
export const PLANTILLA_SMS_DESCARTE =
  'VIGIA {etiqueta}: falsa alarma. {usuario} descarto {tipo} en nave {nave}, cama {cama}. No hay que hacer nada.';

/** Aviso en la configuración de SMS cuando no hay pasarela conectada. */
export const NOTA_SMS =
  'Ahora mismo no sale ningún mensaje: no hay pasarela conectada. Los envíos quedan en pantalla y en la bitácora. Para mandarlos de verdad, configura la pasarela en el .env del servidor.';

/** Aviso cuando sí hay pasarela: los mensajes salen y se cobran. */
export const NOTA_SMS_REAL =
  'Pasarela conectada: los mensajes salen de verdad al celular y cada envío se cobra en la cuenta del proveedor. Cuidado con el botón de prueba.';
