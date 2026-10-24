/**
 * Estado del cultivo en el frontend.
 * Carga desde la API y se mantiene al día con los eventos en vivo (SSE).
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import type {
  Alerta,
  EventoVivo,
  MapaRespuesta,
  RegistroRespuesta,
} from '@vigia/shared/tipos';
import { api, escucharEventos } from '../api/cliente';

export interface Cultivo {
  mapa?: MapaRespuesta;
  alertas: Alerta[];
  registro?: RegistroRespuesta;
  cargando: boolean;
  error?: string;
  /**
   * Alertas recién llegadas, de la más nueva a la más vieja. Se apilan: el
   * robot sigue encontrando cosas aunque no hayas revisado la anterior.
   */
  alertasNuevas: Alerta[];
  /** La más reciente, que es la que encabeza la pila. */
  alertaNueva?: Alerta;
  descartarAlertaNueva: (id?: string) => void;
  recargar: () => Promise<void>;
}

interface Opciones {
  /** Trae los datos de la API. */
  cargar: boolean;
  /**
   * Abre el canal de eventos. Es lo que arranca la cuenta atrás de la alerta
   * del demo, así que se activa solo cuando el mapa está en pantalla.
   */
  escuchar: boolean;
}

export function useCultivo({ cargar, escuchar }: Opciones): Cultivo {
  const [mapa, setMapa] = useState<MapaRespuesta>();
  const [alertas, setAlertas] = useState<Alerta[]>([]);
  const [registro, setRegistro] = useState<RegistroRespuesta>();
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string>();
  const [alertasNuevas, setAlertasNuevas] = useState<Alerta[]>([]);
  const conectado = useRef(false);

  const recargar = useCallback(async () => {
    try {
      const [datosMapa, datosAlertas, datosRegistro] = await Promise.all([
        api.mapa(),
        api.alertas(),
        api.registro(),
      ]);
      setMapa(datosMapa);
      setAlertas(datosAlertas);
      setRegistro(datosRegistro);
      setError(undefined);
    } catch (fallo) {
      setError(fallo instanceof Error ? fallo.message : 'No se pudo cargar el cultivo');
    } finally {
      setCargando(false);
    }
  }, []);

  useEffect(() => {
    if (!cargar) return;
    void recargar();
  }, [cargar, recargar]);

  // Eventos en vivo: la alerta del demo llega por aquí.
  useEffect(() => {
    if (!escuchar || conectado.current) return;
    conectado.current = true;

    const cerrar = escucharEventos((evento: EventoVivo) => {
      if (evento.tipo === 'alerta_nueva') {
        // Se añade al frente sin pisar las que ya estaban sin revisar.
        setAlertasNuevas((previas) =>
          previas.some((a) => a.id === evento.alerta.id)
            ? previas
            : [evento.alerta, ...previas],
        );
        void recargar();
      } else if (evento.tipo === 'estado_cambiado') {
        void recargar();
      }
    });

    return () => {
      cerrar();
      conectado.current = false;
    };
  }, [escuchar, recargar]);

  const descartarAlertaNueva = useCallback(
    (id?: string) =>
      setAlertasNuevas((previas) => (id ? previas.filter((a) => a.id !== id) : [])),
    [],
  );

  return {
    mapa,
    alertas,
    registro,
    cargando,
    error,
    alertasNuevas,
    alertaNueva: alertasNuevas[0],
    descartarAlertaNueva,
    recargar,
  };
}
