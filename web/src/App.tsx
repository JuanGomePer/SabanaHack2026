/**
 * Flujo del prototipo, igual que el prototipo de Figma:
 * Login → Bienvenida → Mapa. En el mapa, a los pocos segundos llega la alerta
 * nueva; tocar el aviso o la mora marcada abre el detalle de la planta.
 */

import { useCallback, useMemo, useState } from 'react';
import { ESTRUCTURA, USUARIO } from '@vigia/shared/config';
import { BarraLateral, type Pantalla } from './components/BarraLateral';
import { BarraSuperior } from './components/BarraSuperior';
import { AvisoAlerta } from './components/AvisoAlerta';
import { useCultivo } from './estado/useCultivo';
import { Login } from './screens/Login';
import { Bienvenida } from './screens/Bienvenida';
import { Mapa } from './screens/Mapa';
import { Alertas } from './screens/Alertas';
import { Equipos } from './screens/Equipos';
import { Registro } from './screens/Registro';
import { Configuracion } from './screens/Configuracion';
import { ComoLlegaUnaAlerta } from './screens/ComoLlegaUnaAlerta';
import { DetallePlanta } from './screens/DetallePlanta';
import { haceCuanto, idDesdeTexto } from './utilidades/formato';

type Flujo = 'login' | 'bienvenida' | 'app';

const TITULOS: Record<Pantalla, { titulo: string; subtitulo: string }> = {
  mapa: { titulo: '', subtitulo: '' },
  alertas: { titulo: 'Alertas', subtitulo: 'Todo lo que el robot encontró y está por revisar.' },
  equipos: {
    titulo: 'Equipos y servicios',
    subtitulo: 'Lo que ofrece Agrar y qué está pasando en las naves ahora mismo.',
  },
  registro: {
    titulo: 'Registro de incidencias',
    subtitulo: 'Evidencia para el reporte.',
  },
  configuracion: {
    titulo: 'Configuración',
    subtitulo: 'Adapta el mapa a tu cultivo: naves, camas y plantas.',
  },
  'como-llega': {
    titulo: 'Cómo llega una alerta',
    subtitulo: 'Del recorrido del robot a la decisión del encargado.',
  },
};

function saludo(): string {
  const hora = new Date().getHours();
  if (hora < 12) return 'Buenos días';
  if (hora < 19) return 'Buenas tardes';
  return 'Buenas noches';
}

export function App() {
  const [flujo, setFlujo] = useState<Flujo>('login');
  const [pantalla, setPantalla] = useState<Pantalla>('mapa');
  const [plantaAbierta, setPlantaAbierta] = useState<string>();

  // Los datos se cargan desde la bienvenida; el canal de eventos (y con él la
  // cuenta atrás de la alerta del demo) solo se abre al llegar al mapa.
  const cultivo = useCultivo({
    cargar: flujo !== 'login',
    escuchar: flujo === 'app' && pantalla === 'mapa',
  });
  const { mapa, alertas, registro, alertaNueva, descartarAlertaNueva, recargar } = cultivo;

  const pendientes = useMemo(
    () => alertas.filter((a) => a.revision === 'pendiente').length,
    [alertas],
  );

  const abrirPlanta = useCallback(
    (plantaId: string) => {
      setPlantaAbierta(plantaId);
      descartarAlertaNueva();
    },
    [descartarAlertaNueva],
  );

  if (flujo === 'login') {
    return <Login alEntrar={() => setFlujo('bienvenida')} />;
  }

  if (flujo === 'bienvenida') {
    return <Bienvenida resumen={mapa?.resumen} alEntrar={() => setFlujo('app')} />;
  }

  const subtituloMapa = mapa
    ? `${alertaNueva ? 'Hay una alerta nueva. ' : 'Tu cultivo está estable. '}` +
      `${mapa.resumen.porRevisar} plantas piden tu atención · Bloque ${mapa.bloque} · Actualizado ${haceCuanto(mapa.resumen.actualizado)}`
    : 'Cargando el cultivo…';

  const encabezado =
    pantalla === 'mapa'
      ? { titulo: `${saludo()}, ${USUARIO.nombre}`, subtitulo: subtituloMapa }
      : pantalla === 'alertas'
        ? {
            titulo: 'Alertas',
            subtitulo: `${pendientes} por revisar · el robot las detecta, tú decides`,
          }
        : pantalla === 'registro' && registro
          ? {
              titulo: 'Registro de incidencias',
              subtitulo: `Semana del ${registro.resumen.semana} · evidencia para el reporte`.replace(
                /^Semana del (\d+) – /,
                'Semana del $1 al ',
              ),
            }
          : TITULOS[pantalla];

  return (
    <div className="app">
      <BarraLateral
        actual={pantalla}
        alNavegar={(destino) => {
          setPantalla(destino);
          setPlantaAbierta(undefined);
        }}
        pendientes={pendientes}
        robot={mapa?.resumen.robot}
      />

      <div className="principal">
        <BarraSuperior
          titulo={encabezado.titulo}
          subtitulo={encabezado.subtitulo}
          pendientes={pendientes}
          alAbrirAlertas={() => setPantalla('alertas')}
          alBuscar={(texto) => {
            const id = idDesdeTexto(texto, ESTRUCTURA.bloque);
            if (id) abrirPlanta(id);
          }}
        />

        <main className="contenido">
          {cultivo.error && (
            <div className="nota-ejemplo txt-pequeno">
              No se pudo hablar con la API ({cultivo.error}). ¿Está corriendo <code>npm run dev</code>?
            </div>
          )}

          {!mapa && !cultivo.error && <p className="cargando">Cargando el cultivo…</p>}

          {mapa && pantalla === 'mapa' && (
            <Mapa
              mapa={mapa}
              alertas={alertas}
              plantaResaltada={alertaNueva?.plantaId}
              alAbrirPlanta={abrirPlanta}
              alVerAlertas={() => setPantalla('alertas')}
            />
          )}

          {pantalla === 'alertas' && (
            <Alertas
              alertas={alertas}
              alAbrirPlanta={abrirPlanta}
              alConfigurarAvisos={() => setPantalla('configuracion')}
            />
          )}

          {pantalla === 'equipos' && <Equipos />}

          {pantalla === 'registro' && registro && <Registro datos={registro} />}

          {pantalla === 'configuracion' && (
            <Configuracion alVerComoLlega={() => setPantalla('como-llega')} />
          )}

          {pantalla === 'como-llega' && <ComoLlegaUnaAlerta />}
        </main>
      </div>

      {alertaNueva && !plantaAbierta && (
        <AvisoAlerta
          alerta={alertaNueva}
          alVerPlanta={() => abrirPlanta(alertaNueva.plantaId)}
          alCerrar={descartarAlertaNueva}
        />
      )}

      {plantaAbierta && (
        <DetallePlanta
          plantaId={plantaAbierta}
          alCerrar={() => setPlantaAbierta(undefined)}
          alCambiarPlanta={setPlantaAbierta}
          alRevisar={async () => {
            await recargar();
          }}
        />
      )}
    </div>
  );
}
