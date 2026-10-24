/**
 * Aprendizaje — qué se hizo para que el robot reconozca enfermedades, y por
 * qué el modelo todavía está a mitad de camino.
 *
 * Todo lo que dice esta pantalla sale de `vision/CLAUDE.md` y
 * `vision/docs/00_resumen_ejecutivo.md` (el módulo de visión del equipo, en
 * `vision/` dentro de este mismo repo) — no son cifras inventadas para la
 * demo. Si ese módulo avanza, esta pantalla se queda desactualizada hasta
 * que alguien la vuelva a revisar contra esos documentos.
 */
import { Camera, CheckCircle2, CircleDashed, Database, FlaskConical, Microscope } from 'lucide-react';

type EstadoEtapa = 'hecho' | 'en_curso' | 'pendiente';

interface Etapa {
  titulo: string;
  texto: string;
  estado: EstadoEtapa;
}

const ETAPAS: Etapa[] = [
  {
    titulo: '1 · Investigar qué datos existen',
    texto:
      '33 fuentes públicas catalogadas. Descargadas y auditadas PlantVillage "Blueberry healthy" (1.502 fotos) y ' +
      'PlantDoc "Blueberry leaf" (117, y no son todas "sanas"). Conclusión dura: no existe ningún dataset público ' +
      'usable de Botrytis ni de trips en arándano — hoy nadie lo tiene publicado.',
    estado: 'hecho',
  },
  {
    titulo: '2 · Probar la receta en un cultivo parecido',
    texto:
      'Mientras no hay datos de arándano, se entrenó un experimento auxiliar en fresa (9 variantes, se eligió un ' +
      'ResNet-18) para validar el método. En test: 0,953 de recall entre enfermedades, con el peor caso en moho ' +
      'gris sobre fruto (0,75, se confunde con oídio). Sirve para probar el proceso, no es un modelo de arándano.',
    estado: 'hecho',
  },
  {
    titulo: '3 · Capturar fotos reales, una ronda a la vez',
    texto:
      'Como no hay dataset completo, el propio robot se convierte en la fuente: cada ronda deja fotos con su ' +
      'ubicación (nave, cama, planta) y su fecha. Ya existen el protocolo de captura, la guía de etiquetado y el ' +
      'esquema de metadatos — falta acumular suficientes rondas para que el conjunto crezca.',
    estado: 'en_curso',
  },
  {
    titulo: '4 · Entrenar el modelo propio de arándano',
    texto:
      'Con las fotos reales acumuladas (más DrBerry, el dataset núcleo con cajas de lesión, pendiente de una ' +
      'clave de acceso) se entrena "blueberry_leaf_condition_v1". Todavía no existe ningún modelo entrenado para ' +
      'arándano — hoy la detección de enfermedad en la demo es una simulación sobre datos de ejemplo.',
    estado: 'pendiente',
  },
  {
    titulo: '5 · Desplegarlo en el robot',
    texto:
      'La inferencia va en la Jetson Orin NX del propio X2 Ultra (157 TOPS), dentro de un contenedor, leyendo la ' +
      'cámara RGB-D Orbbec Gemini 335 en tiempo real. El robot físico todavía no se ha probado con este módulo.',
    estado: 'pendiente',
  },
];

const ESTILO_ESTADO: Record<EstadoEtapa, { texto: string; clase: string; Icono: typeof CheckCircle2 }> = {
  hecho: { texto: 'Hecho', clase: 'ok', Icono: CheckCircle2 },
  en_curso: { texto: 'En curso', clase: 'riesgo', Icono: Camera },
  pendiente: { texto: 'Pendiente', clase: 'neutro', Icono: CircleDashed },
};

export function Aprendizaje() {
  return (
    <section>
      <div className="tarjeta" style={{ marginBottom: 20 }}>
        <h2 className="tarjeta-titulo">
          <Microscope size={18} /> Por qué no hay (todavía) un modelo de arándano
        </h2>
        <p className="secundario txt-pequeno" style={{ margin: '8px 0 0' }}>
          En el mercado no existe hoy un banco de fotos de enfermedades de arándano lo bastante completo como para
          entrenar un modelo serio — sobre todo de Botrytis y de trips, que no tienen ningún dataset público
          utilizable. La apuesta del equipo es que el propio robot construya ese dataset: una foto diaria, con su
          ubicación exacta, va llenando el hueco que no cubre lo que ya existe en internet.
        </p>
      </div>

      <div className="tarjeta aprendizaje-flujo">
        <h2 className="tarjeta-titulo">
          <FlaskConical size={18} /> El camino, paso a paso
        </h2>
        <ol className="aprendizaje-lista">
          {ETAPAS.map((etapa, i) => {
            const { texto, clase, Icono } = ESTILO_ESTADO[etapa.estado];
            return (
              <li className={`aprendizaje-etapa ${etapa.estado}`} key={etapa.titulo}>
                <div className="aprendizaje-punto">
                  <Icono size={18} />
                  {i < ETAPAS.length - 1 && <span className="aprendizaje-linea" />}
                </div>
                <div className="columna" style={{ gap: 4, flex: 1 }}>
                  <div className="fila-entre">
                    <span className="txt-cuerpo-fuerte">{etapa.titulo}</span>
                    <span className={`chip ${clase}`}>{texto}</span>
                  </div>
                  <span className="secundario txt-pequeno">{etapa.texto}</span>
                </div>
              </li>
            );
          })}
        </ol>
      </div>

      <div className="tarjeta" style={{ marginTop: 20 }}>
        <h2 className="tarjeta-titulo">
          <Database size={18} /> Lo que ya está construido, aunque falten los datos
        </h2>
        <ul className="aprendizaje-checklist txt-pequeno">
          <li>Configuración de la cámara X2 Ultra validada (RGB 1280×720, profundidad 16 bits sin alinear).</li>
          <li>Protocolo de captura y guía de etiquetado, listos para usarse ronda tras ronda.</li>
          <li>Esquema de metadatos con su propio validador, para que cada foto quede bien ubicada.</li>
          <li>Taxonomía de evidencia propia (qué tan confiable es cada hallazgo) para arándano.</li>
          <li>Guardas de seguridad de código: nada se ejecuta en la PC de control de movimiento del robot.</li>
        </ul>
      </div>

      <p className="nota-ejemplo txt-pequeno" style={{ marginTop: 16 }}>
        <span className="punto neutro" style={{ marginTop: 7 }} />
        <span>
          Mientras no haya modelo propio, las alertas de la app usan datos de ejemplo simulados — no son lecturas
          de un modelo de visión corriendo sobre el robot real. Esta pantalla documenta el plan real para llegar
          ahí, con las mismas fuentes que usa el equipo de visión en <code>vision/CLAUDE.md</code>.
        </span>
      </p>
    </section>
  );
}
