/**
 * Avisos por SMS: el canal de respaldo para cuando la finca se queda sin
 * internet. Se configura en 06 · Config · Alertas y umbrales y se resume
 * arriba de 04 · Alertas.
 *
 * El envío es una SIMULACIÓN del prototipo: no hay pasarela de SMS conectada.
 */

import { useCallback, useEffect, useState } from 'react';
import { MessageSquare, PlugZap, Plus, Send, Smartphone, Trash2, WifiOff } from 'lucide-react';
import type { PrioridadAlerta, SmsRespuesta, VerificacionPasarela } from '@vigia/shared/tipos';
import { api } from '../api/cliente';
import { Boton } from './Boton';
import { Chip } from './Chip';
import { Interruptor } from './Interruptor';
import { Segmentado } from './Segmentado';
import { hora } from '../utilidades/formato';

const CUANDO = ['Siempre', 'Solo sin internet'] as const;
type Cuando = (typeof CUANDO)[number];

const PRIORIDADES: Array<{ valor: PrioridadAlerta; texto: string }> = [
  { valor: 'alta', texto: 'Solo las altas' },
  { valor: 'media', texto: 'Media y alta' },
  { valor: 'baja', texto: 'Todas' },
];

/** Carga /api/sms y expone los datos y una forma de reemplazarlos. */
export function useSms() {
  const [datos, setDatos] = useState<SmsRespuesta>();
  const [error, setError] = useState<string>();

  const recargar = useCallback(async () => {
    try {
      setDatos(await api.sms());
      setError(undefined);
    } catch (fallo) {
      setError(fallo instanceof Error ? fallo.message : 'No se pudo leer la configuración de SMS');
    }
  }, []);

  useEffect(() => {
    void recargar();
  }, [recargar]);

  return { datos, error, setDatos, recargar };
}

/** Resumen de una línea, para la cabecera de la pantalla de Alertas. */
export function ResumenSms({
  datos,
  alConfigurar,
}: {
  datos?: SmsRespuesta;
  alConfigurar: () => void;
}) {
  if (!datos) return null;

  const activos = datos.config.destinos.filter((d) => d.activo);
  const numeros = activos.length === 1 ? '1 número' : `${activos.length} números`;

  return (
    <div className="tira-sms">
      <span className="tira-sms-icono">
        <MessageSquare size={18} />
      </span>
      <div className="columna">
        <span className="txt-cuerpo-fuerte">
          {datos.config.activo
            ? `Las alertas también llegan por SMS a ${numeros}`
            : 'Los avisos por SMS están apagados'}
        </span>
        <span className="apagado txt-pequeno">
          {datos.config.activo
            ? datos.config.cuando === 'sin_internet'
              ? 'Solo cuando la finca se queda sin internet. Respaldo por si el wifi del invernadero falla.'
              : 'En cuanto el robot encuentra algo, sin esperar a que abras la app.'
            : 'Actívalos para que la alerta llegue al celular aunque no haya internet.'}
        </span>
      </div>
      {datos.config.activo && !datos.config.hayInternet && (
        <Chip tono="riesgo">Finca sin internet</Chip>
      )}
      <Chip tono={datos.pasarela.real ? 'marca' : 'neutro'}>
        {datos.pasarela.real ? datos.pasarela.nombre : 'Envío simulado'}
      </Chip>
      <Chip tono={datos.config.activo ? 'ok' : 'neutro'}>
        {datos.config.activo ? 'Activo' : 'Apagado'}
      </Chip>
      <Boton variante="fantasma" onClick={alConfigurar}>
        Configurar
      </Boton>
    </div>
  );
}

/** Tarjeta completa de configuración (pestaña "Alertas y umbrales"). */
export function PanelSms({
  datos,
  setDatos,
  recargar,
}: {
  datos?: SmsRespuesta;
  setDatos: (datos: SmsRespuesta) => void;
  /** Para volver a leer el estado cuando llega el acuse de entrega. */
  recargar: () => Promise<void>;
}) {
  const [nombre, setNombre] = useState('');
  const [numero, setNumero] = useState('');
  const [error, setError] = useState<string>();
  const [aviso, setAviso] = useState<string>();
  const [ocupado, setOcupado] = useState(false);
  const [verificacion, setVerificacion] = useState<VerificacionPasarela>();

  const mostrarAviso = useCallback((texto: string) => {
    setAviso(texto);
    window.setTimeout(() => setAviso(undefined), 4000);
  }, []);

  if (!datos) return null;

  const { config, envios, limite, ejemplo, motivoBloqueo, nota, pasarela } = datos;

  async function ejecutar(accion: () => Promise<SmsRespuesta>, exito?: string) {
    setOcupado(true);
    setError(undefined);
    try {
      setDatos(await accion());
      if (exito) mostrarAviso(exito);
    } catch (fallo) {
      setError(fallo instanceof Error ? fallo.message : 'No se pudo guardar el cambio');
    } finally {
      setOcupado(false);
    }
  }

  async function agregar() {
    const limpio = numero.trim();
    if (!limpio) {
      setError('Escribe el número del celular.');
      return;
    }
    setOcupado(true);
    setError(undefined);
    try {
      const respuesta = await api.agregarNumeroSms(nombre.trim(), limpio);
      setDatos(respuesta);
      setNombre('');
      setNumero('');
      mostrarAviso(`${respuesta.destino.numero} quedó en la lista.`);
    } catch {
      // El servidor valida el formato y explica qué pasó.
      setError('Ese número no parece un celular. Ejemplo: +57 310 555 0142.');
    } finally {
      setOcupado(false);
    }
  }

  return (
    <div className="tarjeta tarjeta-sms">
      <div className="fila-entre">
        <h2 className="tarjeta-titulo">Avisos por SMS</h2>
        <Chip tono={config.activo ? 'ok' : 'neutro'}>{config.activo ? 'Activo' : 'Apagado'}</Chip>
      </div>
      <p className="secundario txt-pequeno" style={{ margin: '4px 0 6px' }}>
        En el invernadero el internet se cae, pero la señal de celular aguanta. Con esto la misma
        alerta sale también como mensaje de texto.
      </p>

      <div className={`pasarela-sms ${pasarela.real ? 'conectada' : 'simulada'}`}>
        <span className="pasarela-icono">
          {pasarela.real ? <Send size={15} /> : <PlugZap size={15} />}
        </span>
        <div className="columna">
          <span className="txt-cuerpo-peq-fuerte">
            Pasarela: {pasarela.nombre}
            {pasarela.remitente ? ` · ${pasarela.remitente}` : ''}
          </span>
          <span className="txt-pequeno">
            {pasarela.real
              ? 'Los mensajes salen de verdad al celular.'
              : (pasarela.falta ?? 'Los mensajes no salen: solo se registran.')}
          </span>
        </div>
      </div>

      <div className="campo">
        <div className="columna">
          <span className="txt-cuerpo-fuerte">Avisar por SMS</span>
          <span className="apagado txt-pequeno">
            La alerta llega al celular además de la app
          </span>
        </div>
        <Interruptor
          activo={config.activo}
          alCambiar={(valor) => void ejecutar(() => api.guardarSms({ activo: valor }))}
          etiquetaAccesible="Avisar por SMS"
        />
      </div>

      <div className="campo">
        <div className="columna">
          <span className="txt-cuerpo-fuerte">Cuándo mandarlo</span>
          <span className="apagado txt-pequeno">
            “Solo sin internet” lo deja como respaldo y no duplica avisos
          </span>
        </div>
        <Segmentado
          opciones={CUANDO}
          valor={config.cuando === 'sin_internet' ? 'Solo sin internet' : 'Siempre'}
          alCambiar={(valor: Cuando) =>
            void ejecutar(() =>
              api.guardarSms({ cuando: valor === 'Siempre' ? 'siempre' : 'sin_internet' }),
            )
          }
          etiquetaAccesible="Cuándo mandar el SMS"
        />
      </div>

      <div className="campo">
        <div className="columna">
          <span className="txt-cuerpo-fuerte">Qué alertas</span>
          <span className="apagado txt-pequeno">La prioridad la da la confianza del robot</span>
        </div>
        <select
          className="selector"
          value={config.prioridadMinima}
          onChange={(e) =>
            void ejecutar(() =>
              api.guardarSms({ prioridadMinima: e.target.value as PrioridadAlerta }),
            )
          }
          aria-label="Prioridad mínima para avisar por SMS"
        >
          {PRIORIDADES.map((opcion) => (
            <option key={opcion.valor} value={opcion.valor}>
              {opcion.texto}
            </option>
          ))}
        </select>
      </div>

      <div className="campo">
        <div className="columna">
          <span className="txt-cuerpo-fuerte">Simular finca sin internet</span>
          <span className="apagado txt-pequeno">
            Para mostrar el respaldo en la demo: apaga la conexión de la finca
          </span>
        </div>
        <Interruptor
          activo={!config.hayInternet}
          alCambiar={(valor) => void ejecutar(() => api.guardarSms({ hayInternet: !valor }))}
          etiquetaAccesible="Simular finca sin internet"
        />
      </div>

      <div className={`estado-sms txt-pequeno ${motivoBloqueo ? 'apagada' : 'activa'}`}>
        {motivoBloqueo ? (
          <>
            <WifiOff size={15} />
            <span>{motivoBloqueo}</span>
          </>
        ) : (
          <>
            <Send size={15} />
            <span>
              Ahora mismo una alerta nueva saldría por SMS a{' '}
              {config.destinos.filter((d) => d.activo).length} número(s).
            </span>
          </>
        )}
      </div>

      <h3 className="subtitulo-tarjeta">Números que reciben las alertas</h3>
      <ul className="lista-numeros">
        {config.destinos.map((destino) => (
          <li key={destino.id}>
            <span className="numero-icono">
              <Smartphone size={16} />
            </span>
            <div className="columna">
              <span className="txt-cuerpo-fuerte">{destino.numero}</span>
              <span className="apagado txt-pequeno">{destino.nombre}</span>
            </div>
            <Interruptor
              activo={destino.activo}
              alCambiar={(valor) =>
                void ejecutar(() => api.cambiarNumeroSms(destino.id, { activo: valor }))
              }
              etiquetaAccesible={`Avisar a ${destino.numero}`}
            />
            <button
              type="button"
              className="quitar-numero"
              onClick={() =>
                void ejecutar(
                  () => api.quitarNumeroSms(destino.id),
                  `${destino.numero} salió de la lista.`,
                )
              }
              aria-label={`Quitar ${destino.numero}`}
            >
              <Trash2 size={16} />
            </button>
          </li>
        ))}
        {config.destinos.length === 0 && (
          <li className="apagado txt-pequeno">Todavía no hay ningún número.</li>
        )}
      </ul>

      <div className="agregar-numero">
        <input
          type="text"
          className="campo-texto"
          value={nombre}
          onChange={(e) => setNombre(e.target.value)}
          placeholder="Nombre (ej. Samuel R.)"
          aria-label="Nombre de quien recibe el SMS"
        />
        <input
          type="tel"
          className="campo-texto"
          value={numero}
          onChange={(e) => setNumero(e.target.value)}
          placeholder="+57 310 555 0142"
          aria-label="Número de celular"
          onKeyDown={(e) => {
            if (e.key === 'Enter') void agregar();
          }}
        />
        <Boton icono={<Plus size={18} />} onClick={() => void agregar()} disabled={ocupado}>
          Añadir número
        </Boton>
      </div>

      {error && <p className="error-sms txt-pequeno">{error}</p>}
      {aviso && <p className="aviso-ok txt-pequeno">{aviso}</p>}

      <h3 className="subtitulo-tarjeta">Así llega el mensaje</h3>
      <div className="burbuja-sms">
        <p className="txt-pequeno">{ejemplo}</p>
        <span className="apagado txt-etiqueta">
          {ejemplo.length} de {limite} caracteres
        </span>
      </div>

      <div className="fila" style={{ gap: 10, marginTop: 14, flexWrap: 'wrap' }}>
        <Boton
          variante="secundario"
          icono={<PlugZap size={17} />}
          disabled={ocupado}
          onClick={() =>
            void ejecutar(async () => {
              const respuesta = await api.verificarPasarela();
              setVerificacion(respuesta.verificacion);
              return respuesta;
            })
          }
        >
          Probar credenciales
        </Boton>
        <Boton
          variante="secundario"
          icono={<Send size={17} />}
          disabled={ocupado}
          onClick={() =>
            void ejecutar(async () => {
              const respuesta = await api.probarSms();
              mostrarAviso(
                pasarela.real
                  ? `Mensaje enviado de verdad a ${respuesta.enviados} número(s) por ${pasarela.nombre}.`
                  : `SMS de prueba a ${respuesta.enviados} número(s) — simulado, no sale de la demo.`,
              );
              // El acuse de entrega llega un momento después.
              window.setTimeout(() => void recargar(), 2200);
              return respuesta;
            })
          }
        >
          Enviar SMS de prueba
        </Boton>
      </div>

      <p className="apagado txt-etiqueta" style={{ marginTop: 8 }}>
        “Probar credenciales” solo le pregunta a la pasarela si las claves sirven; no gasta
        mensajes. “Enviar SMS de prueba”{' '}
        {pasarela.real ? 'sí manda un mensaje de verdad y se cobra.' : 'queda registrado como simulado.'}
      </p>

      {verificacion && (
        <p className={`${verificacion.ok ? 'aviso-ok' : 'error-sms'} txt-pequeno`}>
          {verificacion.mensaje}
          {verificacion.detalle ? ` · ${verificacion.detalle}` : ''}
        </p>
      )}

      {envios.length > 0 && (
        <>
          <h3 className="subtitulo-tarjeta">Últimos envíos</h3>
          <ul className="lista-envios">
            {envios.slice(0, 6).map((envio) => (
              <li key={envio.id}>
                <Chip
                  tono={
                    envio.estado === 'entregado'
                      ? 'ok'
                      : envio.estado === 'fallido'
                        ? 'alerta'
                        : 'marca'
                  }
                >
                  {envio.estado === 'entregado'
                    ? 'Entregado'
                    : envio.estado === 'fallido'
                      ? 'Falló'
                      : 'Enviado'}
                </Chip>
                <div className="columna">
                  <span className="txt-pequeno">
                    {envio.numero}
                    {envio.etiqueta ? ` · ${envio.etiqueta}` : ' · prueba'}
                  </span>
                  {envio.error && <span className="error-sms txt-etiqueta">{envio.error}</span>}
                  {envio.aviso && <span className="salvedad-sms txt-etiqueta">{envio.aviso}</span>}
                </div>
                <span className="apagado txt-etiqueta">{hora(envio.enviadoEn)}</span>
              </li>
            ))}
          </ul>
        </>
      )}

      <div className="nota-ejemplo txt-pequeno">{nota}</div>
    </div>
  );
}
