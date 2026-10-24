/**
 * Protocolos — qué hacer, paso a paso, por cada enfermedad/plaga que vigila
 * la app. Los pasos son prácticas de manejo integrado conocidas para
 * arándano (@vigia/shared/config, PROTOCOLOS); dónde se está concentrando
 * cada una sale de contar los hallazgos reales de los últimos 30 días
 * (GET /api/protocolos) — no es una cifra inventada para la demo.
 */
import { useCallback, useEffect, useState } from 'react';
import { ListChecks, MapPin, ShieldAlert } from 'lucide-react';
import { ETIQUETA_CIENTIFICA_TIPO, PASO_APAGAR_EQUIPOS, PROTOCOLOS } from '@vigia/shared/config';
import type { Equipo, ProtocolosRespuesta, TipoHallazgo } from '@vigia/shared/tipos';
import { api } from '../api/cliente';
import { ApagarEquipos } from '../components/ApagarEquipos';
import { Chip } from '../components/Chip';

const TONO: Record<TipoHallazgo, 'alerta' | 'riesgo' | 'marca'> = {
  Botrytis: 'alerta',
  Alternaria: 'riesgo',
  Trips: 'marca',
};

export function Protocolos() {
  const [datos, setDatos] = useState<ProtocolosRespuesta>();
  const [equipos, setEquipos] = useState<Equipo[]>([]);
  /** Id del equipo que se está apagando o encendiendo ahora mismo. */
  const [ocupado, setOcupado] = useState<string>();

  const cargarEquipos = useCallback(async () => {
    const respuesta = await api.equipos();
    setEquipos(respuesta.equipos);
  }, []);

  useEffect(() => {
    void api.protocolos().then(setDatos);
    void cargarEquipos();
  }, [cargarEquipos]);

  /** El paso 1 de los tres protocolos apaga equipos de verdad. */
  const cambiarEquipo = useCallback(
    async (id: string, desactivado: boolean, tipo: TipoHallazgo) => {
      setOcupado(id);
      try {
        await api.cambiarEquipo(
          id,
          desactivado,
          desactivado ? `Apagado por el protocolo de ${ETIQUETA_CIENTIFICA_TIPO[tipo]}.` : undefined,
        );
        await cargarEquipos();
      } finally {
        setOcupado(undefined);
      }
    },
    [cargarEquipos],
  );

  return (
    <section>
      <p className="secundario txt-pequeno" style={{ margin: '0 0 18px' }}>
        {datos
          ? `Basado en ${datos.total} hallazgo${datos.total === 1 ? '' : 's'} de los últimos ${datos.dias} días.`
          : 'Cargando los hallazgos de los últimos 30 días…'}
      </p>

      <div className="protocolos-lista">
        {(['Botrytis', 'Alternaria', 'Trips'] as TipoHallazgo[]).map((tipo) => {
          const concentracion = datos?.tipos.find((t) => t.tipo === tipo);
          const peor = concentracion?.porNave[0];

          return (
            <div className="tarjeta" key={tipo}>
              <div className="fila-entre">
                <h2 className="tarjeta-titulo">
                  <ShieldAlert size={18} /> {ETIQUETA_CIENTIFICA_TIPO[tipo]}
                </h2>
                <Chip tono={TONO[tipo]}>{concentracion ? `${concentracion.total} hallazgos` : '…'}</Chip>
              </div>

              {concentracion && concentracion.total > 0 && peor ? (
                <div className="protocolo-donde">
                  <MapPin size={15} />
                  <span className="txt-pequeno">
                    Se concentra en <strong>nave {peor.nave}</strong> ({peor.cantidad} de {concentracion.total}) ·{' '}
                    {concentracion.porcentaje} % de todos los hallazgos del bloque · confianza media{' '}
                    {Math.round(concentracion.confianzaMedia * 100)} %
                    {concentracion.porNave.length > 1 &&
                      ` · también en nave${concentracion.porNave.length > 2 ? 's' : ''} ` +
                        concentracion.porNave
                          .slice(1)
                          .map((n) => n.nave)
                          .join(', ')}
                  </span>
                </div>
              ) : datos ? (
                <p className="secundario txt-pequeno" style={{ margin: '4px 0 0' }}>
                  Sin hallazgos de este tipo en los últimos {datos.dias} días — nada que accionar todavía.
                </p>
              ) : null}

              <ol className="protocolo-pasos">
                {PROTOCOLOS[tipo].map((paso, i) => (
                  <li key={i} className={paso === PASO_APAGAR_EQUIPOS ? 'con-casillas' : ''}>
                    <span className="protocolo-numero">{i + 1}</span>
                    <div className="columna" style={{ gap: 0, flex: 1, minWidth: 0 }}>
                      <span className="txt-pequeno">{paso}</span>
                      {paso === PASO_APAGAR_EQUIPOS && (
                        <ApagarEquipos
                          equipos={equipos}
                          naveFoco={peor?.nave}
                          ocupado={ocupado}
                          alCambiar={(id, desactivado) =>
                            void cambiarEquipo(id, desactivado, tipo)
                          }
                        />
                      )}
                    </div>
                  </li>
                ))}
              </ol>
            </div>
          );
        })}
      </div>

      <p className="nota-ejemplo txt-pequeno" style={{ marginTop: 16 }}>
        <ListChecks size={16} style={{ flexShrink: 0, marginTop: 2 }} />
        <span>
          Estos pasos son prácticas de manejo integrado de plagas/enfermedades conocidas para arándano — no
          reemplazan el criterio del agrónomo. La ubicación ("se concentra en…") sí es un dato real, contado sobre
          los hallazgos que ya están en el sistema.
        </span>
      </p>
    </section>
  );
}
