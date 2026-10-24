/**
 * 05 · Config · Estructura (10:3452) y
 * 06 · Config · Alertas y umbrales (10:4142).
 *
 * Los valores son supuestos del prototipo: se editan aquí y su origen está en
 * shared/src/config.ts.
 */

import { Fragment, useCallback, useEffect, useState } from 'react';
import { Bot, Check, Minus, Plus, RotateCcw, Trash2, UserPlus } from 'lucide-react';
import type {
  Configuracion as Config,
  ConfiguracionEstructura,
  EtapaCultivo,
  RobotConfigurado,
} from '@vigia/shared/tipos';
import {
  celdasPorCamaEn,
  esMediaHectarea,
  hectareasDe,
  metrosCuadradosDe,
  pasillosDeNave,
} from '@vigia/shared/config';
import { api } from '../api/cliente';
import { Boton } from '../components/Boton';
import { Chip } from '../components/Chip';
import { Interruptor } from '../components/Interruptor';
import { PanelSms, useSms } from '../components/AvisosSms';
import { Segmentado } from '../components/Segmentado';
import { numero } from '../utilidades/formato';

const PESTANAS = ['Estructura del cultivo', 'Alertas y umbrales', 'Equipo y accesos'] as const;
type Pestana = (typeof PESTANAS)[number];

const ETAPAS: EtapaCultivo[] = ['Vegetativa', 'Floración', 'Cuajado', 'Cosecha'];
const AGRUPACIONES = [1, 2, 2.5, 5];
const NUMERACIONES = ['Seguida', 'Por nave'] as const;

/** Campo con − valor + */
function Contador({
  valor,
  minimo,
  paso = 1,
  alCambiar,
  etiqueta,
}: {
  valor: number;
  minimo: number;
  paso?: number;
  alCambiar: (valor: number) => void;
  etiqueta: string;
}) {
  return (
    <div className="contador-campo">
      <button
        type="button"
        onClick={() => alCambiar(Math.max(minimo, valor - paso))}
        aria-label={`Quitar ${etiqueta}`}
      >
        <Minus size={16} />
      </button>
      <input
        type="number"
        value={valor}
        min={minimo}
        onChange={(e) => alCambiar(Math.max(minimo, Number(e.target.value)))}
        aria-label={etiqueta}
      />
      <button type="button" onClick={() => alCambiar(valor + paso)} aria-label={`Añadir ${etiqueta}`}>
        <Plus size={16} />
      </button>
    </div>
  );
}

/**
 * Vista previa del bloque: una columna por nave, y dentro de cada nave una
 * columna por cama con su pasillo a cada lado — así es siempre la estructura,
 * porque por el pasillo es por donde entra el robot a revisar.
 */
function VistaPrevia({ estructura }: { estructura: ConfiguracionEstructura }) {
  const celdas = celdasPorCamaEn(estructura);
  // La vista previa resume cada cama en 12 bloques para que quepa.
  const bloques = Math.min(12, celdas);

  return (
    <div className="previa">
      {Array.from({ length: estructura.naves }, (_, i) => {
        const nave = i + 1;
        return (
          <div className="previa-nave" key={nave}>
            <div className="previa-camas">
              <span className="previa-pasillo" />
              {Array.from({ length: estructura.camasPorNave }, (_, c) => (
                <Fragment key={c}>
                  <div className="previa-cama">
                    {Array.from({ length: bloques }, (_, b) => {
                      // La nave 5 es la que tiene humedad alta y hallazgos.
                      const estado =
                        nave === 5 && b > 6 ? (b > 8 ? 'alerta' : 'riesgo') : nave === 2 && b === 2 ? 'riesgo' : 'ok';
                      return <span className={`previa-celda ${estado}`} key={b} />;
                    })}
                  </div>
                  <span className="previa-pasillo" />
                </Fragment>
              ))}
            </div>
            <span className="apagado txt-etiqueta">N{nave}</span>
          </div>
        );
      })}
    </div>
  );
}

interface Props {
  alVerComoLlega: () => void;
  /** Para que la barra superior refleje el nombre/rol apenas se guardan. */
  alGuardarPerfil?: (perfil: Config['perfil']) => void;
  /**
   * El mapa del tablero se dibuja con la estructura guardada, así que al
   * guardar hay que volver a pedirlo: si no, el tablero se queda con la
   * estructura anterior hasta que alguien recargue la página.
   */
  alGuardarEstructura?: () => void | Promise<void>;
}

export function Configuracion({ alVerComoLlega, alGuardarPerfil, alGuardarEstructura }: Props) {
  const [pestana, setPestana] = useState<Pestana>('Estructura del cultivo');
  const [config, setConfig] = useState<Config>();
  const [original, setOriginal] = useState<Config>();
  const [guardado, setGuardado] = useState(false);
  // Los avisos por SMS se guardan solos en /api/sms, no con este formulario.
  const sms = useSms();

  useEffect(() => {
    void api.configuracion().then((datos) => {
      setConfig(datos);
      setOriginal(datos);
    });
  }, []);

  const guardar = useCallback(async () => {
    if (!config) return;
    const actualizada = await api.guardarConfiguracion({
      estructura: config.estructura,
      umbrales: config.umbrales,
      perfil: config.perfil,
    });
    setConfig(actualizada);
    setOriginal(actualizada);
    setGuardado(true);
    alGuardarPerfil?.(actualizada.perfil);
    await alGuardarEstructura?.();
    window.setTimeout(() => setGuardado(false), 2500);
  }, [config, alGuardarPerfil, alGuardarEstructura]);

  if (!config) return <p className="cargando">Cargando la configuración…</p>;

  const { estructura, umbrales } = config;

  const cambiarEstructura = <K extends keyof ConfiguracionEstructura>(
    clave: K,
    valor: ConfiguracionEstructura[K],
  ) => setConfig({ ...config, estructura: { ...estructura, [clave]: valor } });

  const cambiarUmbral = <K extends keyof typeof umbrales>(clave: K, valor: (typeof umbrales)[K]) =>
    setConfig({ ...config, umbrales: { ...umbrales, [clave]: valor } });

  const cambiarPerfil = <K extends keyof Config['perfil']>(clave: K, valor: Config['perfil'][K]) =>
    setConfig({ ...config, perfil: { ...config.perfil, [clave]: valor } });

  // ── Robots del bloque: puede haber más de uno ─────────────────────────────
  const cambiarRobot = (id: string, cambios: Partial<RobotConfigurado>) =>
    cambiarEstructura(
      'robots',
      estructura.robots.map((robot) => (robot.id === id ? { ...robot, ...cambios } : robot)),
    );

  const agregarRobot = () => {
    // El número sigue al mayor que ya existe, para no repetir ids al quitar y
    // volver a añadir. Se toma el número FINAL del id ("X2-01" → 1): quitar
    // todo lo que no sea dígito daría 201, por el 2 de "X2".
    const usados = estructura.robots
      .map((robot) => Number(robot.id.match(/(\d+)$/)?.[1]))
      .filter((n) => Number.isFinite(n));
    const siguiente = (usados.length ? Math.max(...usados) : 0) + 1;
    cambiarEstructura('robots', [
      ...estructura.robots,
      {
        id: `X2-${String(siguiente).padStart(2, '0')}`,
        nombre: `Robot X2-${siguiente}`,
        nave: Math.min(siguiente, estructura.naves),
      },
    ]);
  };

  const quitarRobot = (id: string) =>
    cambiarEstructura(
      'robots',
      estructura.robots.filter((robot) => robot.id !== id),
    );

  const camas = estructura.naves * estructura.camasPorNave;
  const plantas = camas * estructura.plantasPorCama;
  const metros = metrosCuadradosDe(estructura);
  const hectareas = hectareasDe(estructura);

  return (
    <section>
      <div className="fila-entre" style={{ marginBottom: 18 }}>
        <Segmentado
          opciones={PESTANAS}
          valor={pestana}
          alCambiar={setPestana}
          etiquetaAccesible="Sección de configuración"
        />
        {guardado && <Chip tono="ok">Guardado</Chip>}
      </div>

      <div className="config-grid">
        {pestana === 'Estructura del cultivo' && (
          <>
            <div className="tarjeta">
              <h2 className="tarjeta-titulo">Estructura del bloque</h2>
              <p className="secundario txt-pequeno" style={{ margin: '4px 0 6px' }}>
                Cambia los números y el mapa se redibuja solo.
              </p>

              <div className="campo">
                <div className="columna">
                  <span className="txt-cuerpo-fuerte">Nombre del bloque</span>
                </div>
                <input
                  type="text"
                  className="campo-texto"
                  value={estructura.nombre}
                  onChange={(e) => cambiarEstructura('nombre', e.target.value)}
                  aria-label="Nombre del bloque"
                />
              </div>

              <div className="campo">
                <div className="columna">
                  <span className="txt-cuerpo-fuerte">Etapa del cultivo</span>
                  <span className="apagado txt-pequeno">Cambia los umbrales de humedad</span>
                </div>
                <select
                  className="selector"
                  value={estructura.etapa}
                  onChange={(e) => cambiarEstructura('etapa', e.target.value as EtapaCultivo)}
                  aria-label="Etapa del cultivo"
                >
                  {ETAPAS.map((etapa) => (
                    <option key={etapa}>{etapa}</option>
                  ))}
                </select>
              </div>

              <div className="campo">
                <div className="columna">
                  <span className="txt-cuerpo-fuerte">Naves</span>
                  <span className="apagado txt-pequeno">
                    Cada nave mide ≈ {estructura.anchoNave.toString().replace('.', ',')} m ×{' '}
                    {estructura.largoNave} m
                  </span>
                </div>
                <Contador
                  valor={estructura.naves}
                  minimo={1}
                  etiqueta="naves"
                  alCambiar={(valor) => cambiarEstructura('naves', valor)}
                />
              </div>

              {/* Las medidas mandan la superficie: el cultivo de referencia es
                  media hectárea, y de aquí sale ese número. */}
              <div className="campo">
                <div className="columna">
                  <span className="txt-cuerpo-fuerte">Medidas de una nave</span>
                  <span className="apagado txt-pequeno">
                    Ancho × largo, en metros. Con estas medidas el bloque da{' '}
                    {numero(Math.round(metros))} m²
                    {esMediaHectarea(estructura) ? ' — media hectárea' : ''}
                  </span>
                </div>
                <div className="fila" style={{ gap: 8 }}>
                  <input
                    type="number"
                    className="campo-texto campo-medida"
                    value={estructura.anchoNave}
                    min={1}
                    step={0.1}
                    onChange={(e) =>
                      cambiarEstructura('anchoNave', Math.max(1, Number(e.target.value)))
                    }
                    aria-label="Ancho de la nave, en metros"
                  />
                  <span className="apagado txt-pequeno">×</span>
                  <input
                    type="number"
                    className="campo-texto campo-medida"
                    value={estructura.largoNave}
                    min={1}
                    step={1}
                    onChange={(e) =>
                      cambiarEstructura('largoNave', Math.max(1, Number(e.target.value)))
                    }
                    aria-label="Largo de la nave, en metros"
                  />
                </div>
              </div>

              <div className="campo">
                <div className="columna">
                  <span className="txt-cuerpo-fuerte">Camas por nave</span>
                  <span className="apagado txt-pequeno">
                    Se numeran seguidas: 1 a {camas}. Cada nave lleva{' '}
                    {pasillosDeNave(estructura.camasPorNave)} pasillos —uno entre cada par de camas
                    y uno contra cada muro— por donde camina el robot; ya van dentro de los{' '}
                    {estructura.anchoNave.toString().replace('.', ',')} m de ancho.
                  </span>
                </div>
                <Contador
                  valor={estructura.camasPorNave}
                  minimo={1}
                  etiqueta="camas por nave"
                  alCambiar={(valor) => cambiarEstructura('camasPorNave', valor)}
                />
              </div>

              <div className="campo">
                <div className="columna">
                  <span className="txt-cuerpo-fuerte">Plantas por cama</span>
                  <span className="apagado txt-pequeno">
                    Así se ubica cada planta: {estructura.bloque}-C14-P065
                  </span>
                </div>
                <Contador
                  valor={estructura.plantasPorCama}
                  minimo={1}
                  paso={10}
                  etiqueta="plantas por cama"
                  alCambiar={(valor) => cambiarEstructura('plantasPorCama', valor)}
                />
              </div>

              <div className="campo">
                <div className="columna">
                  <span className="txt-cuerpo-fuerte">Cada cuadro del mapa agrupa</span>
                  <span className="apagado txt-pequeno">Menos plantas = mapa más detallado</span>
                </div>
                <select
                  className="selector"
                  value={estructura.plantasPorCelda}
                  onChange={(e) => cambiarEstructura('plantasPorCelda', Number(e.target.value))}
                  aria-label="Plantas por cuadro del mapa"
                >
                  {AGRUPACIONES.map((valor) => (
                    <option key={valor} value={valor}>
                      {valor.toString().replace('.', ',')} plantas
                    </option>
                  ))}
                </select>
              </div>

              <div className="campo">
                <div className="columna">
                  <span className="txt-cuerpo-fuerte">Numeración de camas</span>
                </div>
                <Segmentado
                  opciones={NUMERACIONES}
                  valor={estructura.numeracion === 'seguida' ? 'Seguida' : 'Por nave'}
                  alCambiar={(valor) =>
                    cambiarEstructura('numeracion', valor === 'Seguida' ? 'seguida' : 'por_nave')
                  }
                  etiquetaAccesible="Numeración de camas"
                />
              </div>

              <div className="fila" style={{ gap: 10, marginTop: 18 }}>
                <Boton icono={<Check size={18} />} onClick={() => void guardar()}>
                  Guardar cambios
                </Boton>
                <Boton
                  variante="secundario"
                  icono={<RotateCcw size={17} />}
                  onClick={() => original && setConfig(original)}
                >
                  Restaurar
                </Boton>
              </div>
            </div>

            <div className="tarjeta">
              <div className="fila-entre">
                <h2 className="tarjeta-titulo">Así queda tu cultivo</h2>
                <Chip tono="ok">Se actualiza al instante</Chip>
              </div>

              <div className="previa-cifras">
                <div>
                  <span className="cifra-previa">{numero(estructura.naves)}</span>
                  <span className="apagado txt-pequeno">naves</span>
                </div>
                <div>
                  <span className="cifra-previa">{numero(camas)}</span>
                  <span className="apagado txt-pequeno">camas</span>
                </div>
                <div>
                  <span className="cifra-previa">{numero(plantas)}</span>
                  <span className="apagado txt-pequeno">plantas</span>
                </div>
                <div>
                  <span className="cifra-previa">
                    ≈ {hectareas.toFixed(2).replace('.', ',')}
                  </span>
                  <span className="apagado txt-pequeno">
                    hectáreas
                    {esMediaHectarea(estructura) ? ' · media hectárea' : ''}
                  </span>
                </div>
              </div>

              <VistaPrevia estructura={estructura} />

              <div className="aviso-ambar txt-pequeno">
                Si cambias la estructura, los códigos de planta ({estructura.bloque}-C14-P065) y el
                historial se vuelven a asociar al guardar. Revisa antes de confirmar.
              </div>

              <Boton variante="secundario" onClick={alVerComoLlega} className="boton-separado">
                Ver cómo llega una alerta
              </Boton>
            </div>

            {/*
              El bloque puede tener más de un robot: uno no alcanza a recorrer
              todas las naves en una ronda. Cada uno queda con su nave
              asignada; el que esté conectado es el que reporta batería y
              posición en vivo.
            */}
            <div className="tarjeta tarjeta-ancha">
              <div className="fila-entre">
                <h2 className="tarjeta-titulo">Robots del bloque</h2>
                <Chip tono={estructura.robots.length > 0 ? 'ok' : 'neutro'}>
                  {estructura.robots.length === 1
                    ? '1 robot'
                    : `${estructura.robots.length} robots`}
                </Chip>
              </div>
              <p className="secundario txt-pequeno" style={{ margin: '4px 0 10px' }}>
                Da de alta un robot por cada uno que recorra el bloque y asígnale su nave. Con{' '}
                {estructura.naves} naves, un solo robot tiene que repartir la ronda entre todas.
              </p>

              <ul className="lista-robots">
                {estructura.robots.map((robot) => (
                  <li key={robot.id}>
                    <span className="robot-marca">
                      <Bot size={17} />
                    </span>
                    <input
                      type="text"
                      className="campo-texto"
                      value={robot.nombre}
                      onChange={(e) => cambiarRobot(robot.id, { nombre: e.target.value })}
                      aria-label={`Nombre del robot ${robot.id}`}
                    />
                    <label className="fila" style={{ gap: 8 }}>
                      <span className="apagado txt-pequeno">Nave</span>
                      <select
                        className="selector"
                        value={robot.nave}
                        onChange={(e) => cambiarRobot(robot.id, { nave: Number(e.target.value) })}
                        aria-label={`Nave asignada al robot ${robot.id}`}
                      >
                        {Array.from({ length: estructura.naves }, (_, i) => i + 1).map((nave) => (
                          <option key={nave} value={nave}>
                            {nave}
                          </option>
                        ))}
                      </select>
                    </label>
                    <span className="apagado txt-etiqueta">{robot.id}</span>
                    <button
                      type="button"
                      className="icono-boton"
                      aria-label={`Quitar ${robot.nombre}`}
                      onClick={() => quitarRobot(robot.id)}
                    >
                      <Trash2 size={16} />
                    </button>
                  </li>
                ))}
              </ul>

              {estructura.robots.length === 0 && (
                <p className="apagado txt-pequeno" style={{ margin: '4px 0 0' }}>
                  No hay ningún robot dado de alta: el mapa se queda sin rondas.
                </p>
              )}

              <div className="fila" style={{ gap: 10, marginTop: 14 }}>
                <Boton variante="secundario" icono={<Plus size={17} />} onClick={agregarRobot}>
                  Añadir robot
                </Boton>
                <Boton icono={<Check size={18} />} onClick={() => void guardar()}>
                  Guardar cambios
                </Boton>
              </div>
            </div>
          </>
        )}

        {pestana === 'Alertas y umbrales' && (
          <>
            <div className="tarjeta">
              <h2 className="tarjeta-titulo">Umbrales</h2>
              <p className="secundario txt-pequeno" style={{ margin: '4px 0 6px' }}>
                Ajusta los umbrales a tu cultivo: cambian el mapa, las alertas y la ventilación.
              </p>

              <div className="campo">
                <div className="columna">
                  <span className="txt-cuerpo-fuerte">Humedad de riesgo</span>
                  <span className="apagado txt-pequeno">
                    Por encima de este valor la planta se marca en riesgo
                  </span>
                </div>
                <Contador
                  valor={umbrales.humedadRiesgo}
                  minimo={50}
                  etiqueta="humedad de riesgo"
                  alCambiar={(valor) => cambiarUmbral('humedadRiesgo', valor)}
                />
              </div>

              <div className="campo">
                <div className="columna">
                  <span className="txt-cuerpo-fuerte">Humedad que enciende la ventilación</span>
                  <span className="apagado txt-pequeno">
                    El programador de clima actúa a partir de aquí
                  </span>
                </div>
                <Contador
                  valor={umbrales.humedadAlta}
                  minimo={50}
                  etiqueta="humedad de ventilación"
                  alCambiar={(valor) => cambiarUmbral('humedadAlta', valor)}
                />
              </div>

              <div className="campo">
                <div className="columna">
                  <span className="txt-cuerpo-fuerte">Confianza mínima del robot</span>
                  <span className="apagado txt-pequeno">
                    {Math.round(umbrales.confianzaMinima * 100)} % para abrir una alerta
                  </span>
                </div>
                <input
                  type="range"
                  min={0.3}
                  max={0.95}
                  step={0.05}
                  value={umbrales.confianzaMinima}
                  onChange={(e) => cambiarUmbral('confianzaMinima', Number(e.target.value))}
                  aria-label="Confianza mínima del robot"
                />
              </div>

              <div className="fila" style={{ marginTop: 18 }}>
                <Boton icono={<Check size={18} />} onClick={() => void guardar()}>
                  Guardar cambios
                </Boton>
              </div>
            </div>

            <div className="tarjeta">
              <h2 className="tarjeta-titulo">Avisos</h2>
              <p className="secundario txt-pequeno" style={{ margin: '4px 0 6px' }}>
                Qué hace la plataforma cuando el robot encuentra algo.
              </p>

              <div className="campo">
                <div className="columna">
                  <span className="txt-cuerpo-fuerte">Aviso emergente en el mapa</span>
                  <span className="apagado txt-pequeno">
                    Muestra la tarjeta de alerta nueva sin que tengas que buscarla
                  </span>
                </div>
                <Interruptor
                  activo={umbrales.avisoEmergente}
                  alCambiar={(valor) => cambiarUmbral('avisoEmergente', valor)}
                  etiquetaAccesible="Aviso emergente en el mapa"
                />
              </div>

              <div className="campo">
                <div className="columna">
                  <span className="txt-cuerpo-fuerte">Ventilación automática</span>
                  <span className="apagado txt-pequeno">
                    El programador enciende ventilación y sube los brazos mecánicos
                  </span>
                </div>
                <Interruptor
                  activo={umbrales.ventilacionAutomatica}
                  alCambiar={(valor) => cambiarUmbral('ventilacionAutomatica', valor)}
                  etiquetaAccesible="Ventilación automática"
                />
              </div>

              <div className="campo">
                <div className="columna">
                  <span className="txt-cuerpo-fuerte">Demora del primer aviso</span>
                  <span className="apagado txt-pequeno">
                    Segundos desde que entras al mapa hasta el primer aviso del robot
                  </span>
                </div>
                <Contador
                  valor={umbrales.segundosAlertaDemo}
                  minimo={1}
                  etiqueta="segundos"
                  alCambiar={(valor) => cambiarUmbral('segundosAlertaDemo', valor)}
                />
              </div>
            </div>

            <PanelSms datos={sms.datos} errorCarga={sms.error} setDatos={sms.setDatos} recargar={sms.recargar} />
          </>
        )}

        {pestana === 'Equipo y accesos' && (
          <>
            <div className="tarjeta" style={{ marginBottom: 20 }}>
              <h2 className="tarjeta-titulo">Mi perfil</h2>
              <p className="secundario txt-pequeno" style={{ margin: '4px 0 14px' }}>
                El nombre y el rol que ves arriba, en la barra superior y en el registro.
              </p>

              <div className="campo">
                <div className="columna" style={{ flex: 1 }}>
                  <span className="txt-cuerpo-fuerte">Nombre</span>
                  <input
                    type="text"
                    className="campo-texto"
                    value={config.perfil.nombre}
                    onChange={(e) => cambiarPerfil('nombre', e.target.value)}
                    aria-label="Tu nombre"
                  />
                </div>
              </div>
              <div className="campo">
                <div className="columna" style={{ flex: 1 }}>
                  <span className="txt-cuerpo-fuerte">Cómo te firmas en el registro</span>
                  <input
                    type="text"
                    className="campo-texto"
                    value={config.perfil.firma}
                    onChange={(e) => cambiarPerfil('firma', e.target.value)}
                    aria-label="Tu firma"
                  />
                </div>
              </div>
              <div className="campo">
                <div className="columna" style={{ flex: 1 }}>
                  <span className="txt-cuerpo-fuerte">Rol</span>
                  <input
                    type="text"
                    className="campo-texto"
                    value={config.perfil.rol}
                    onChange={(e) => cambiarPerfil('rol', e.target.value)}
                    aria-label="Tu rol"
                  />
                </div>
              </div>

              <Boton icono={<Check size={18} />} onClick={() => void guardar()} className="boton-separado">
                Guardar cambios
              </Boton>
            </div>

            <div className="tarjeta">
            <h2 className="tarjeta-titulo">Equipo y accesos</h2>
            <p className="secundario txt-pequeno" style={{ margin: '4px 0 14px' }}>
              Quién entra a la plataforma y qué puede hacer.
            </p>

            {[
              { nombre: 'Samuel R.', rol: 'Encargado de cultivo', permiso: 'Confirma y descarta' },
              { nombre: 'Marcela P.', rol: 'Agrónoma', permiso: 'Confirma y descarta' },
              { nombre: 'Robot X2', rol: 'Robot de rondas', permiso: 'Solo crea hallazgos' },
            ].map((persona) => (
              <div className="campo" key={persona.nombre}>
                <div className="columna">
                  <span className="txt-cuerpo-fuerte">{persona.nombre}</span>
                  <span className="apagado txt-pequeno">{persona.rol}</span>
                </div>
                <Chip tono="neutro">{persona.permiso}</Chip>
              </div>
            ))}

            <Boton
              variante="secundario"
              icono={<UserPlus size={17} />}
              className="boton-separado"
              onClick={() => {
                window.location.href =
                  'mailto:?subject=' +
                  encodeURIComponent('Te invito a Vigía') +
                  '&body=' +
                  encodeURIComponent('Entra a Vigía para ver el cultivo y las alertas: ' + window.location.origin);
              }}
            >
              Invitar a alguien
            </Boton>
            </div>
          </>
        )}
      </div>
    </section>
  );
}
