/**
 * Avisos por SMS: el canal de respaldo para cuando la finca se queda sin
 * internet. La señal de celular aguanta donde el wifi del invernadero no llega,
 * así que la misma alerta sale también como mensaje de texto.
 *
 * La configuración (números, cuándo avisar, prioridad mínima) vive en memoria
 * del proceso, no en la base: son datos de contacto de la demo, no estado del
 * cultivo. Los envíos sí quedan en la bitácora, que es la evidencia del pitch.
 *
 * Quién manda el mensaje de verdad es `pasarela.ts`; aquí solo está la regla
 * de cuándo mandarlo.
 */
import {
  LIMITE_SMS,
  NOTA_SMS,
  NOTA_SMS_REAL,
  PAIS_TELEFONO_DEFECTO,
  PAISES_TELEFONO,
  PLANTILLA_SMS,
  PLANTILLA_SMS_DECISION,
  PLANTILLA_SMS_DESCARTE,
  SMS,
  USUARIO,
  etiquetaPlanta,
} from '@vigia/shared/config';
import type {
  Alerta,
  ConfiguracionSms,
  DestinoSms,
  EnvioSms,
  PrioridadAlerta,
  RevisionHallazgo,
  SmsRespuesta,
} from '@vigia/shared/tipos';
import { anotarRegistro } from '../repositories/registro.js';
import { enviarMensaje, estadoPasarela } from '../pasarela.js';
import { emitir } from '../sse.js';
import { configuracionActual } from './configuracion.js';

/** Configuración viva de los avisos. Arranca de los supuestos de /shared. */
const configSms: ConfiguracionSms = {
  ...SMS,
  destinos: SMS.destinos.map((destino) => ({ ...destino })),
};

/** Los últimos envíos, del más reciente al más antiguo. */
const envios: EnvioSms[] = [];

const MAXIMO_HISTORIAL = 40;
/** Lo que tarda el "acuse de entrega" cuando la pasarela es la simulada. */
const DEMORA_ENTREGA_MS = 1800;

let contadorEnvios = 0;
let contadorDestinos = configSms.destinos.length;

const ORDEN_PRIORIDAD: Record<PrioridadAlerta, number> = { baja: 1, media: 2, alta: 3 };

export function configuracionSms(): ConfiguracionSms {
  return configSms;
}

// ── Preferencias ────────────────────────────────────────────────────────────

export function actualizarPreferencias(
  cambios: Partial<Omit<ConfiguracionSms, 'destinos'>>,
): ConfiguracionSms {
  if (typeof cambios.activo === 'boolean') configSms.activo = cambios.activo;
  if (typeof cambios.hayInternet === 'boolean') configSms.hayInternet = cambios.hayInternet;
  if (typeof cambios.avisarDecision === 'boolean') configSms.avisarDecision = cambios.avisarDecision;
  if (cambios.cuando === 'siempre' || cambios.cuando === 'sin_internet') {
    configSms.cuando = cambios.cuando;
  }
  if (
    cambios.prioridadMinima === 'alta' ||
    cambios.prioridadMinima === 'media' ||
    cambios.prioridadMinima === 'baja'
  ) {
    configSms.prioridadMinima = cambios.prioridadMinima;
  }
  return configSms;
}

// ── Números ─────────────────────────────────────────────────────────────────

/**
 * Deja el número en formato internacional legible: "+57 310 555 0142".
 * Devuelve null si no parece un número de celular.
 */
/**
 * Indicativos ordenados del más largo al más corto, para que un número que
 * empieza por "+593…" (Ecuador, 3 dígitos) no se corte como si fuera "+59…".
 */
const INDICATIVOS_POR_LARGO = [...PAISES_TELEFONO].sort((a, b) => b.codigo.length - a.codigo.length);

export function normalizarNumero(entrada: string): string | null {
  const limpio = String(entrada ?? '').replace(/[\s().-]/g, '');
  if (!/^\+?\d{7,15}$/.test(limpio)) return null;

  // Sin indicativo se asume Colombia, que es donde está el cultivo.
  const internacional = limpio.startsWith('+') ? limpio : `${PAIS_TELEFONO_DEFECTO.codigo}${limpio}`;

  // Si el indicativo es uno de los del selector, se usa tal cual (soporta
  // largos distintos: +1, +57, +593…); si no, se asume de 2 dígitos — el
  // caso más común — para no rechazar un número de un país fuera de la lista.
  const encontrado = INDICATIVOS_POR_LARGO.find((p) => internacional.startsWith(p.codigo));
  const pais = encontrado?.codigo ?? internacional.slice(0, 3);
  const resto = internacional.slice(pais.length);

  const grupos =
    resto.length === 10
      ? [resto.slice(0, 3), resto.slice(3, 6), resto.slice(6)]
      : (resto.match(/\d{1,3}/g) ?? [resto]);

  return `${pais} ${grupos.join(' ')}`.trim();
}

export async function agregarDestino(
  nombre: string,
  numero: string,
): Promise<DestinoSms | { error: string }> {
  const formateado = normalizarNumero(numero);
  if (!formateado) {
    return { error: 'Ese número no parece un celular. Ejemplo: +57 310 555 0142.' };
  }
  if (configSms.destinos.some((d) => d.numero === formateado)) {
    return { error: 'Ese número ya está en la lista.' };
  }

  contadorDestinos += 1;
  const destino: DestinoSms = {
    id: `SMS-${contadorDestinos}`,
    nombre: String(nombre ?? '').trim() || 'Sin nombre',
    numero: formateado,
    activo: true,
  };
  configSms.destinos.push(destino);

  await anotarRegistro({
    accion: 'sms',
    usuario: USUARIO.nombre,
    nota: `Número agregado a los avisos por SMS: ${destino.nombre} (${destino.numero}).`,
  });

  return destino;
}

export function cambiarDestino(
  id: string,
  cambios: Partial<Pick<DestinoSms, 'nombre' | 'numero' | 'activo'>>,
): DestinoSms | { error: string } {
  const destino = configSms.destinos.find((d) => d.id === id);
  if (!destino) return { error: 'Ese número no está en la lista.' };

  if (cambios.numero !== undefined) {
    const formateado = normalizarNumero(cambios.numero);
    if (!formateado) return { error: 'Ese número no parece un celular.' };
    destino.numero = formateado;
  }
  if (cambios.nombre !== undefined) destino.nombre = cambios.nombre.trim() || destino.nombre;
  if (cambios.activo !== undefined) destino.activo = cambios.activo;

  return destino;
}

export async function quitarDestino(id: string): Promise<DestinoSms | { error: string }> {
  const indice = configSms.destinos.findIndex((d) => d.id === id);
  if (indice === -1) return { error: 'Ese número no está en la lista.' };

  const [destino] = configSms.destinos.splice(indice, 1);
  await anotarRegistro({
    accion: 'sms',
    usuario: USUARIO.nombre,
    nota: `Número retirado de los avisos por SMS: ${destino.nombre} (${destino.numero}).`,
  });
  return destino;
}

// ── Texto del mensaje ───────────────────────────────────────────────────────

export function textoDeAlerta(alerta: Alerta): string {
  return PLANTILLA_SMS.replace('{etiqueta}', etiquetaPlanta(alerta.cama, alerta.planta))
    .replace('{tipo}', alerta.tipo)
    .replace('{confianza}', String(Math.round(alerta.confianza * 100)))
    .replace('{nave}', String(alerta.nave))
    .replace('{cama}', String(alerta.cama))
    .replace('{humedad}', String(Math.round(alerta.humedad)))
    .slice(0, LIMITE_SMS);
}

/** "las camas 13 y 15", "la cama 13" o, si la cama no tiene vecinas, la propia. */
function listaDeCamas(camas: number[], camaPropia: number): string {
  if (camas.length === 0) return `la cama ${camaPropia}`;
  if (camas.length === 1) return `la cama ${camas[0]}`;
  return `las camas ${camas.slice(0, -1).join(', ')} y ${camas[camas.length - 1]}`;
}

/**
 * El aviso de la decisión: qué se decidió y dónde hay que tener cuidado.
 * `camasVigilar` son las camas vecinas de la misma nave, que es por donde se
 * propaga; las calcula quien revisa el hallazgo (services/hallazgos.ts).
 */
export function textoDeDecision(
  alerta: Alerta,
  revision: RevisionHallazgo,
  camasVigilar: number[] = [],
  usuario = USUARIO.firma,
): string {
  const plantilla = revision === 'falsa_alarma' ? PLANTILLA_SMS_DESCARTE : PLANTILLA_SMS_DECISION;
  return plantilla
    .replace('{etiqueta}', etiquetaPlanta(alerta.cama, alerta.planta))
    .replace('{tipo}', alerta.tipo)
    .replace('{usuario}', usuario)
    .replace('{nave}', String(alerta.nave))
    .replace('{cama}', String(alerta.cama))
    .replace('{vecinas}', listaDeCamas(camasVigilar, alerta.cama))
    .slice(0, LIMITE_SMS);
}

/** Ejemplo para la pantalla de configuración, sin necesidad de una alerta real. */
export function textoDeEjemplo(): string {
  return textoDeAlerta({
    id: 'A-ejemplo',
    hallazgoId: 'H-ejemplo',
    plantaId: 'B5-C14-P065',
    cama: 14,
    planta: 65,
    nave: 5,
    tipo: 'Botrytis',
    confianza: 0.93,
    humedad: 91,
    prioridad: 'alta',
    revision: 'pendiente',
    detectadoEn: new Date().toISOString(),
    fotoUrl: '',
  });
}

/** Ejemplo del aviso de la decisión, para la pantalla de configuración. */
export function textoDeEjemploDecision(): string {
  return textoDeDecision(
    {
      id: 'A-ejemplo',
      hallazgoId: 'H-ejemplo',
      plantaId: 'B5-C14-P065',
      cama: 14,
      planta: 65,
      nave: 5,
      tipo: 'Botrytis',
      confianza: 0.93,
      humedad: 91,
      prioridad: 'alta',
      revision: 'confirmada',
      detectadoEn: new Date().toISOString(),
      fotoUrl: '',
    },
    'confirmada',
    [13, 15],
  );
}

// ── Reglas de envío ─────────────────────────────────────────────────────────

/**
 * Por qué NO se manda el SMS de esta alerta, o null si sí se manda.
 * El texto se muestra tal cual en la pantalla de configuración.
 */
export function porQueNoSeEnvia(prioridad: PrioridadAlerta): string | null {
  const { activo, cuando, prioridadMinima, hayInternet, destinos } = configSms;

  if (!activo) return 'El aviso por SMS está apagado.';
  if (ORDEN_PRIORIDAD[prioridad] < ORDEN_PRIORIDAD[prioridadMinima]) {
    return `Solo se avisa por SMS desde prioridad ${prioridadMinima}.`;
  }
  if (cuando === 'sin_internet' && hayInternet) {
    return 'Hay internet: la alerta llega por la app y no hace falta el SMS.';
  }
  if (!destinos.some((d) => d.activo)) return 'No hay ningún número activo.';
  return null;
}

/**
 * Por qué NO sale el aviso de la decisión, o null si sí sale.
 *
 * Este segundo aviso no mira la prioridad ni si hay internet: va dirigido a
 * quien está en campo y ya decidió alguien por él — si se confirmó algo, tiene
 * que saber dónde tener cuidado, haya o no wifi en el invernadero.
 */
export function porQueNoSeEnviaDecision(): string | null {
  const { activo, avisarDecision, destinos } = configSms;

  if (!activo) return 'El aviso por SMS está apagado.';
  if (!avisarDecision) return 'El aviso de la decisión está apagado.';
  if (!destinos.some((d) => d.activo)) return 'No hay ningún número activo.';
  return null;
}

// ── Envío ───────────────────────────────────────────────────────────────────

function crearEnvios(texto: string, motivo: EnvioSms['motivo'], alerta?: Alerta): EnvioSms[] {
  const pasarela = estadoPasarela();
  const ahora = new Date().toISOString();

  const nuevos = configSms.destinos
    .filter((destino) => destino.activo)
    .map((destino) => {
      contadorEnvios += 1;
      const envio: EnvioSms = {
        id: `SMS-E-${String(contadorEnvios).padStart(4, '0')}`,
        destinoId: destino.id,
        numero: destino.numero,
        nombre: destino.nombre,
        texto,
        estado: 'enviado',
        enviadoEn: ahora,
        motivo,
        alertaId: alerta?.id,
        plantaId: alerta?.plantaId,
        etiqueta: alerta ? etiquetaPlanta(alerta.cama, alerta.planta) : undefined,
        proveedor: pasarela.proveedor,
      };
      return envio;
    });

  envios.unshift(...nuevos);
  if (envios.length > MAXIMO_HISTORIAL) envios.length = MAXIMO_HISTORIAL;

  if (nuevos.length > 0) {
    // Se muestran como "enviado" y la pasarela confirma (o falla) después.
    emitir({ tipo: 'sms_enviado', envios: nuevos });
    void entregar(nuevos, pasarela.real);
  }

  return nuevos;
}

/** Habla con la pasarela y actualiza el estado de cada envío. */
async function entregar(lote: EnvioSms[], real: boolean): Promise<void> {
  if (!real) {
    await new Promise((seguir) => setTimeout(seguir, DEMORA_ENTREGA_MS));
    const entregadoEn = new Date().toISOString();
    for (const envio of lote) {
      envio.estado = 'entregado';
      envio.entregadoEn = entregadoEn;
    }
    emitir({ tipo: 'sms_enviado', envios: lote });
    return;
  }

  await Promise.all(
    lote.map(async (envio) => {
      const resultado = await enviarMensaje(envio.numero, envio.texto, envio.nombre);
      if (resultado.ok) {
        envio.estado = 'entregado';
        envio.entregadoEn = new Date().toISOString();
        envio.referencia = resultado.referencia;
        envio.aviso = resultado.aviso;
      } else {
        envio.estado = 'fallido';
        envio.error = resultado.error;
        console.error(`[vigía] SMS a ${envio.numero} falló: ${resultado.error}`);
      }
    }),
  );

  emitir({ tipo: 'sms_enviado', envios: lote });
}

/**
 * Manda la alerta por SMS si la configuración lo pide.
 * Se llama desde el servicio que crea el hallazgo; no interrumpe ese flujo.
 */
export async function avisarPorSms(alerta: Alerta): Promise<EnvioSms[]> {
  if (porQueNoSeEnvia(alerta.prioridad) !== null) return [];

  const lote = crearEnvios(textoDeAlerta(alerta), 'alerta', alerta);
  if (lote.length === 0) return [];

  await anotarRegistro({
    plantaId: alerta.plantaId,
    cama: alerta.cama,
    accion: 'sms',
    tipo: alerta.tipo,
    usuario: 'Vigía',
    nota:
      `Alerta de ${etiquetaPlanta(alerta.cama, alerta.planta)} enviada por SMS a ` +
      `${lote.length === 1 ? '1 número' : `${lote.length} números`} ` +
      `(${configSms.hayInternet ? 'canal de respaldo' : 'la finca está sin internet'}).`,
  });

  return lote;
}

/**
 * Segundo aviso: la decisión ya tomada.
 *
 * Se llama al revisar un hallazgo (services/hallazgos.ts). El mensaje dice qué
 * se decidió, quién lo decidió y en qué camas hay que tener cuidado.
 */
export async function avisarDecisionPorSms(
  alerta: Alerta,
  revision: RevisionHallazgo,
  camasVigilar: number[],
  usuario = USUARIO.firma,
): Promise<EnvioSms[]> {
  if (porQueNoSeEnviaDecision() !== null) return [];

  const texto = textoDeDecision(alerta, revision, camasVigilar, usuario);
  const lote = crearEnvios(texto, 'decision', alerta);
  if (lote.length === 0) return [];

  await anotarRegistro({
    plantaId: alerta.plantaId,
    cama: alerta.cama,
    accion: 'sms',
    tipo: alerta.tipo,
    usuario: 'Vigía',
    nota:
      revision === 'falsa_alarma'
        ? `Descarte de ${etiquetaPlanta(alerta.cama, alerta.planta)} avisado por SMS a ` +
          `${lote.length === 1 ? '1 número' : `${lote.length} números`}.`
        : `Decisión de ${etiquetaPlanta(alerta.cama, alerta.planta)} avisada por SMS a ` +
          `${lote.length === 1 ? '1 número' : `${lote.length} números`}: cuidado en ` +
          `${listaDeCamas(camasVigilar, alerta.cama)} de la nave ${alerta.nave}.`,
  });

  return lote;
}

/** SMS de prueba, para comprobar que el número quedó bien. */
export async function enviarPrueba(): Promise<EnvioSms[] | { error: string }> {
  if (!configSms.destinos.some((d) => d.activo)) {
    return { error: 'Agrega un número y actívalo antes de probar.' };
  }

  const lote = crearEnvios(
    `VIGIA: prueba de avisos. Si recibes este mensaje, los avisos del bloque ${configuracionActual().estructura.bloque} están llegando bien a este número.`,
    'prueba',
  );

  await anotarRegistro({
    accion: 'sms',
    usuario: USUARIO.nombre,
    nota: `SMS de prueba enviado a ${lote.length === 1 ? '1 número' : `${lote.length} números`}.`,
  });

  return lote;
}

// ── Respuesta del API ───────────────────────────────────────────────────────

export function respuestaSms(): SmsRespuesta {
  const pasarela = estadoPasarela();
  return {
    config: configSms,
    pasarela,
    envios,
    limite: LIMITE_SMS,
    ejemplo: textoDeEjemplo(),
    ejemploDecision: textoDeEjemploDecision(),
    motivoBloqueo: porQueNoSeEnvia('alta'),
    motivoBloqueoDecision: porQueNoSeEnviaDecision(),
    nota: pasarela.real ? NOTA_SMS_REAL : NOTA_SMS,
  };
}

/** Deja los envíos como al arrancar, para repetir el pitch. */
export function reiniciarSms(): void {
  envios.length = 0;
  contadorEnvios = 0;
}
