/**
 * Pasarela de mensajes: lo único que toca cambiar para que los avisos salgan
 * de verdad.
 *
 * Sin credenciales queda en modo `simulado` (el prototipo funciona igual y no
 * manda nada). Con credenciales en el archivo `.env` de la raíz, los mensajes
 * salen por la pasarela elegida:
 *
 *   SMS_PROVEEDOR=twilio
 *   TWILIO_ACCOUNT_SID=ACxxxxxxxx
 *   TWILIO_AUTH_TOKEN=xxxxxxxx
 *   TWILIO_FROM=+15551234567          (o TWILIO_MESSAGING_SERVICE_SID=MGxxxx)
 *
 *   SMS_PROVEEDOR=telegram
 *   TELEGRAM_BOT_TOKEN=123456:ABC...
 *   TELEGRAM_CHAT_ID=987654321
 *
 * Ver .env.ejemplo y NOTAS.md.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { EstadoPasarela, ProveedorSms, VerificacionPasarela } from '@vigia/shared/tipos';

const AQUI = path.dirname(fileURLToPath(import.meta.url));
const RAIZ = path.resolve(AQUI, '../..');
/** Si la pasarela no responde en este tiempo, el envío se marca como fallido. */
const TIEMPO_LIMITE_MS = 10_000;

/**
 * Lee el .env de la raíz sin depender de ningún paquete.
 * Formato: una variable por línea, `CLAVE=valor`, `#` para comentarios.
 */
function cargarEnv(): void {
  const ruta = path.join(RAIZ, '.env');
  if (!fs.existsSync(ruta)) return;

  for (const linea of fs.readFileSync(ruta, 'utf8').split(/\r?\n/)) {
    const limpia = linea.trim();
    if (!limpia || limpia.startsWith('#')) continue;

    const corte = limpia.indexOf('=');
    if (corte < 1) continue;

    const clave = limpia.slice(0, corte).trim();
    let valor = limpia.slice(corte + 1).trim();
    if (
      (valor.startsWith('"') && valor.endsWith('"')) ||
      (valor.startsWith("'") && valor.endsWith("'"))
    ) {
      valor = valor.slice(1, -1);
    }
    // Lo que ya venga del entorno manda sobre el archivo.
    if (process.env[clave] === undefined) process.env[clave] = valor;
  }
}

cargarEnv();

const env = (clave: string): string | undefined => {
  const valor = process.env[clave]?.trim();
  return valor ? valor : undefined;
};

/** Número del sandbox de WhatsApp de Twilio, igual para todas las cuentas. */
const SANDBOX_WHATSAPP = '+14155238886';

function proveedorElegido(): ProveedorSms {
  const pedido = env('SMS_PROVEEDOR')?.toLowerCase();
  if (
    pedido === 'twilio' ||
    pedido === 'whatsapp' ||
    pedido === 'telegram' ||
    pedido === 'simulado'
  ) {
    return pedido;
  }

  // Sin SMS_PROVEEDOR, se deduce de las credenciales que haya.
  if (env('TWILIO_ACCOUNT_SID') && env('TWILIO_AUTH_TOKEN')) return 'twilio';
  if (env('TELEGRAM_BOT_TOKEN') && env('TELEGRAM_CHAT_ID')) return 'telegram';
  return 'simulado';
}

export function estadoPasarela(): EstadoPasarela {
  const proveedor = proveedorElegido();

  if (proveedor === 'twilio') {
    const sid = env('TWILIO_ACCOUNT_SID');
    const token = env('TWILIO_AUTH_TOKEN');
    const desde = env('TWILIO_FROM') ?? env('TWILIO_MESSAGING_SERVICE_SID');

    const falta = !sid
      ? 'Falta TWILIO_ACCOUNT_SID en el .env.'
      : !token
        ? 'Falta TWILIO_AUTH_TOKEN en el .env.'
        : !desde
          ? 'Falta TWILIO_FROM (o TWILIO_MESSAGING_SERVICE_SID) en el .env.'
          : undefined;

    return {
      proveedor,
      real: !falta,
      nombre: 'Twilio',
      remitente: env('TWILIO_FROM'),
      falta,
    };
  }

  if (proveedor === 'whatsapp') {
    const sid = env('TWILIO_ACCOUNT_SID');
    const token = env('TWILIO_AUTH_TOKEN');
    const falta = !sid
      ? 'Falta TWILIO_ACCOUNT_SID en el .env.'
      : !token
        ? 'Falta TWILIO_AUTH_TOKEN en el .env.'
        : undefined;

    return {
      proveedor,
      real: !falta,
      nombre: 'WhatsApp (Twilio)',
      remitente: env('TWILIO_WHATSAPP_FROM') ?? SANDBOX_WHATSAPP,
      falta,
    };
  }

  if (proveedor === 'telegram') {
    const token = env('TELEGRAM_BOT_TOKEN');
    const chat = env('TELEGRAM_CHAT_ID');
    const falta = !token
      ? 'Falta TELEGRAM_BOT_TOKEN en el .env.'
      : !chat
        ? 'Falta TELEGRAM_CHAT_ID en el .env.'
        : undefined;

    return {
      proveedor,
      real: !falta,
      nombre: 'Telegram',
      remitente: chat ? `chat ${chat}` : undefined,
      falta,
    };
  }

  return {
    proveedor: 'simulado',
    real: false,
    nombre: 'Simulada',
    falta: 'Configura una pasarela en el .env para que los mensajes salgan de verdad.',
  };
}

export interface ResultadoEnvio {
  ok: boolean;
  /** Identificador del mensaje en la pasarela. */
  referencia?: string;
  error?: string;
  /** Salió, pero con alguna salvedad que hay que contar. */
  aviso?: string;
}

/**
 * Las cuentas de prueba de Twilio no dejan mandar texto propio: solo aceptan
 * el nombre de una de sus plantillas fijas (error 572006). Para que la demo
 * igual haga sonar el celular, si pasa eso se reintenta con esta plantilla.
 * Al pasar la cuenta a de pago, el texto real sale sin tocar nada.
 */
const PLANTILLA_TRIAL = 'sms_account_alerts';
const ERROR_PLANTILLA = 572006;

async function pedirATwilio(cuerpo: URLSearchParams): Promise<{
  ok: boolean;
  sid?: string;
  code?: number;
  message?: string;
  estado?: number;
}> {
  const sid = env('TWILIO_ACCOUNT_SID')!;
  const token = env('TWILIO_AUTH_TOKEN')!;

  const respuesta = await fetch(
    `https://api.twilio.com/2010-04-01/Accounts/${encodeURIComponent(sid)}/Messages.json`,
    {
      method: 'POST',
      headers: {
        Authorization: `Basic ${Buffer.from(`${sid}:${token}`).toString('base64')}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: cuerpo,
      signal: AbortSignal.timeout(TIEMPO_LIMITE_MS),
    },
  );

  const datos = (await respuesta.json().catch(() => ({}))) as {
    sid?: string;
    message?: string;
    code?: number;
  };

  return { ok: respuesta.ok, estado: respuesta.status, ...datos };
}

/** Pistas para los errores de WhatsApp que más salen al montar el sandbox. */
function pistaWhatsApp(codigo?: number): string | undefined {
  if (codigo === 21654 || codigo === 63015 || codigo === 63016) {
    return (
      'Pasa cuando el número no tiene una conversación abierta con el sandbox: desde ese celular,' +
      ' manda por WhatsApp "join <tu-código>" al número del sandbox y vuelve a intentar' +
      ' (la ventana dura 24 horas).'
    );
  }
  if (codigo === 63007) {
    return 'Revisa TWILIO_WHATSAPP_FROM: debe ser el número del sandbox de tu cuenta.';
  }
  return undefined;
}

async function enviarPorTwilio(
  numero: string,
  texto: string,
  canal: 'sms' | 'whatsapp' = 'sms',
): Promise<ResultadoEnvio> {
  const limpio = numero.replace(/\s/g, '');
  const esWhatsApp = canal === 'whatsapp';

  const desde = esWhatsApp
    ? `whatsapp:${env('TWILIO_WHATSAPP_FROM') ?? SANDBOX_WHATSAPP}`
    : env('TWILIO_FROM');
  const servicio = esWhatsApp ? undefined : env('TWILIO_MESSAGING_SERVICE_SID');

  const base = () => {
    const cuerpo = new URLSearchParams({ To: esWhatsApp ? `whatsapp:${limpio}` : limpio });
    if (desde) cuerpo.set('From', desde);
    else if (servicio) cuerpo.set('MessagingServiceSid', servicio);
    return cuerpo;
  };

  const conTexto = base();
  conTexto.set('Body', texto);
  const primera = await pedirATwilio(conTexto);

  if (primera.ok) return { ok: true, referencia: primera.sid };

  if (esWhatsApp) {
    const pista = pistaWhatsApp(primera.code);
    return {
      ok: false,
      error:
        (primera.message
          ? `WhatsApp ${primera.code ?? primera.estado}: ${primera.message}`
          : `WhatsApp respondió ${primera.estado}.`) + (pista ? ` ${pista}` : ''),
    };
  }

  // Cuenta de prueba: no acepta texto propio. Se reintenta con su plantilla.
  if (primera.code === ERROR_PLANTILLA) {
    const plantilla = env('TWILIO_PLANTILLA_TRIAL') ?? PLANTILLA_TRIAL;
    const conPlantilla = base();
    conPlantilla.set('Body', plantilla);
    const segunda = await pedirATwilio(conPlantilla);

    if (segunda.ok) {
      return {
        ok: true,
        referencia: segunda.sid,
        aviso:
          `Cuenta de prueba: Twilio no deja mandar texto propio, así que salió su plantilla ` +
          `"${plantilla}" en vez del aviso del cultivo. Con la cuenta de pago sale el texto real.`,
      };
    }
    return {
      ok: false,
      error: segunda.message
        ? `Twilio ${segunda.code ?? segunda.estado}: ${segunda.message}`
        : `Twilio respondió ${segunda.estado}.`,
    };
  }

  return {
    ok: false,
    error: primera.message
      ? `Twilio ${primera.code ?? primera.estado}: ${primera.message}`
      : `Twilio respondió ${primera.estado}.`,
  };
}

async function enviarPorTelegram(
  numero: string,
  texto: string,
  nombre: string,
): Promise<ResultadoEnvio> {
  const token = env('TELEGRAM_BOT_TOKEN')!;
  const chat = env('TELEGRAM_CHAT_ID')!;

  const respuesta = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    // El bot escribe a un chat, no a un número: se dice a quién iba dirigido.
    body: JSON.stringify({ chat_id: chat, text: `${texto}\n\n— para ${nombre} (${numero})` }),
    signal: AbortSignal.timeout(TIEMPO_LIMITE_MS),
  });

  const datos = (await respuesta.json().catch(() => ({}))) as {
    ok?: boolean;
    description?: string;
    result?: { message_id?: number };
  };

  if (!respuesta.ok || datos.ok === false) {
    return { ok: false, error: `Telegram: ${datos.description ?? respuesta.status}` };
  }

  return { ok: true, referencia: datos.result?.message_id?.toString() };
}

/**
 * Comprueba que las credenciales sirven SIN mandar ningún mensaje (ni gastar
 * crédito): le pregunta al proveedor por la propia cuenta.
 */
export async function verificarCredenciales(): Promise<VerificacionPasarela> {
  const pasarela = estadoPasarela();

  if (pasarela.proveedor === 'simulado') {
    return {
      ok: false,
      mensaje: 'No hay pasarela configurada: el .env está en modo simulado.',
    };
  }
  if (!pasarela.real) {
    return { ok: false, mensaje: pasarela.falta ?? 'Faltan credenciales en el .env.' };
  }

  try {
    if (pasarela.proveedor === 'twilio' || pasarela.proveedor === 'whatsapp') {
      const sid = env('TWILIO_ACCOUNT_SID')!;
      const token = env('TWILIO_AUTH_TOKEN')!;

      const respuesta = await fetch(
        `https://api.twilio.com/2010-04-01/Accounts/${encodeURIComponent(sid)}.json`,
        {
          headers: {
            Authorization: `Basic ${Buffer.from(`${sid}:${token}`).toString('base64')}`,
          },
          signal: AbortSignal.timeout(TIEMPO_LIMITE_MS),
        },
      );
      const datos = (await respuesta.json().catch(() => ({}))) as {
        friendly_name?: string;
        status?: string;
        type?: string;
        message?: string;
        code?: number;
      };

      if (!respuesta.ok) {
        return {
          ok: false,
          mensaje: 'Twilio rechazó las credenciales. Revisa el Account SID y el Auth Token.',
          detalle: datos.message ? `${datos.code ?? respuesta.status}: ${datos.message}` : undefined,
        };
      }

      const prueba = datos.type === 'Trial';
      const salvedad =
        pasarela.proveedor === 'whatsapp'
          ? ' Por WhatsApp sí se puede mandar el texto real, pero cada número tiene que entrar' +
            ' antes al sandbox mandando "join <código>" desde su celular.'
          : prueba
            ? ' Es cuenta de prueba: solo escribe a números verificados y no deja mandar texto' +
              ' propio, así que el mensaje sale con una plantilla fija de Twilio.'
            : '';

      return {
        ok: true,
        mensaje:
          `Twilio responde: cuenta "${datos.friendly_name ?? sid}" (${datos.status ?? 'activa'}).` +
          salvedad,
        detalle: pasarela.remitente ? `Se mandará desde ${pasarela.remitente}.` : undefined,
      };
    }

    const token = env('TELEGRAM_BOT_TOKEN')!;
    const respuesta = await fetch(`https://api.telegram.org/bot${token}/getMe`, {
      signal: AbortSignal.timeout(TIEMPO_LIMITE_MS),
    });
    const datos = (await respuesta.json().catch(() => ({}))) as {
      ok?: boolean;
      description?: string;
      result?: { username?: string };
    };

    if (!respuesta.ok || datos.ok === false) {
      return {
        ok: false,
        mensaje: 'Telegram rechazó el token del bot.',
        detalle: datos.description,
      };
    }

    return {
      ok: true,
      mensaje: `Telegram responde: bot @${datos.result?.username ?? 'sin nombre'} listo.`,
      detalle: pasarela.remitente ? `Escribirá al ${pasarela.remitente}.` : undefined,
    };
  } catch (fallo) {
    const motivo = fallo instanceof Error ? fallo.message : 'error desconocido';
    return {
      ok: false,
      mensaje: `No se pudo hablar con ${pasarela.nombre}. ¿Hay internet en este equipo?`,
      detalle: motivo,
    };
  }
}

/**
 * Manda un mensaje por la pasarela configurada.
 * En modo simulado no sale nada: responde ok para que el flujo siga igual.
 */
export async function enviarMensaje(
  numero: string,
  texto: string,
  nombre: string,
): Promise<ResultadoEnvio> {
  const pasarela = estadoPasarela();
  if (!pasarela.real) return { ok: true };

  try {
    if (pasarela.proveedor === 'twilio') return await enviarPorTwilio(numero, texto, 'sms');
    if (pasarela.proveedor === 'whatsapp') return await enviarPorTwilio(numero, texto, 'whatsapp');
    return await enviarPorTelegram(numero, texto, nombre);
  } catch (fallo) {
    const motivo = fallo instanceof Error ? fallo.message : 'error desconocido';
    return { ok: false, error: `No se pudo hablar con ${pasarela.nombre}: ${motivo}` };
  }
}
