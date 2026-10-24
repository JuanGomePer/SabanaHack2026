/**
 * Vista 3D del bloque, con el recorrido del robot.
 *
 * Representación ESTILIZADA, no un modelo CAD del AgiBot X2 Ultra: no hay
 * ningún archivo 3D del robot en el repo, así que el cuerpo sale de
 * geometrías simples (torso, cabeza, piernas) con sus proporciones
 * aproximadas, no de un modelo importado. Los datos (estado de cada celda,
 * naves, camas) sí son los reales de /api/mapa.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import * as THREE from 'three';
import { idPlanta } from '@vigia/shared/config';
import type { Cama, EstadoCelda, MapaRespuesta } from '@vigia/shared/tipos';

const COLOR_ESTADO: Record<EstadoCelda, string> = {
  ok: '#2f9e6a',
  riesgo: '#e39a1b',
  alerta: '#cc3b33',
  sin_dato: '#8d9a90',
};

const ESPACIO_CELDA = 0.9;
const ESPACIO_CAMA = 2.4;
const CELDAS_POR_CAMA = 40;

function anchoTotal(): number {
  return (CELDAS_POR_CAMA - 1) * ESPACIO_CELDA;
}

/** Una cama: una fila de "arbustos" coloreados por el estado de su celda. */
function FilaCama({
  cama,
  z,
  alElegirPlanta,
}: {
  cama: Cama;
  z: number;
  alElegirPlanta: (plantaId: string) => void;
}) {
  const ref = useRef<THREE.InstancedMesh>(null);
  const colorObjeto = useMemo(() => new THREE.Color(), []);

  // Posiciona cada instancia una vez montado el mesh (el ref no existe aún
  // durante el render, así que esto tiene que ir en un efecto, no en useMemo).
  useEffect(() => {
    const malla = ref.current;
    if (!malla) return;
    const matriz = new THREE.Matrix4();
    cama.celdas.forEach((celda, i) => {
      matriz.setPosition(i * ESPACIO_CELDA - anchoTotal() / 2, 0.18, 0);
      malla.setMatrixAt(i, matriz);
      colorObjeto.set(COLOR_ESTADO[celda.estado]);
      malla.setColorAt(i, colorObjeto);
    });
    malla.instanceMatrix.needsUpdate = true;
    if (malla.instanceColor) malla.instanceColor.needsUpdate = true;
  }, [cama, colorObjeto]);

  return (
    <group position={[0, 0, z]}>
      {/* Base de tierra/sustrato de la cama. */}
      <mesh position={[0, 0.02, 0]} receiveShadow>
        <boxGeometry args={[anchoTotal() + ESPACIO_CELDA, 0.06, 0.7]} />
        <meshStandardMaterial color="#6b4a33" />
      </mesh>
      <instancedMesh
        ref={ref}
        args={[undefined, undefined, cama.celdas.length]}
        onClick={(evento) => {
          evento.stopPropagation();
          const i = evento.instanceId;
          if (i === undefined) return;
          const celda = cama.celdas[i];
          const plantaId = celda.plantaId ?? (celda.plantas[0] ? idPlanta(cama.numero, celda.plantas[0]) : undefined);
          if (plantaId) alElegirPlanta(plantaId);
        }}
      >
        <sphereGeometry args={[0.22, 8, 8]} />
        <meshStandardMaterial />
      </instancedMesh>
    </group>
  );
}

interface RobotProps {
  camas: Cama[];
  alCambiarPosicion: (texto: string) => void;
}

/** Robot estilizado (geometría simple, no un modelo real) recorriendo cama por cama. */
function Robot({ camas, alCambiarPosicion }: RobotProps) {
  const grupo = useRef<THREE.Group>(null);
  const indiceCama = useRef(0);
  const progreso = useRef(0);
  const SEGUNDOS_POR_CAMA = 3.5;

  useFrame((_estado, delta) => {
    if (camas.length === 0 || !grupo.current) return;
    progreso.current += delta / SEGUNDOS_POR_CAMA;
    if (progreso.current >= 1) {
      progreso.current = 0;
      indiceCama.current = (indiceCama.current + 1) % camas.length;
      const cama = camas[indiceCama.current];
      alCambiarPosicion(`Nave ${cama.nave} · Cama ${cama.numero}`);
    }
    const cama = camas[indiceCama.current];
    const x = progreso.current * anchoTotal() - anchoTotal() / 2;
    const z = (indiceCama.current - (camas.length - 1) / 2) * ESPACIO_CAMA;
    grupo.current.position.set(x, 0, z);

    // Balanceo simple al caminar.
    const t = _estado.clock.elapsedTime;
    grupo.current.children[2]?.rotation.set(Math.sin(t * 6) * 0.3, 0, 0); // pierna 1
    grupo.current.children[3]?.rotation.set(-Math.sin(t * 6) * 0.3, 0, 0); // pierna 2
  });

  return (
    <group ref={grupo}>
      {/* Torso */}
      <mesh position={[0, 0.95, 0]} castShadow>
        <boxGeometry args={[0.34, 0.5, 0.22]} />
        <meshStandardMaterial color="#1b7550" />
      </mesh>
      {/* Cabeza */}
      <mesh position={[0, 1.32, 0]} castShadow>
        <sphereGeometry args={[0.14, 12, 12]} />
        <meshStandardMaterial color="#17261e" />
      </mesh>
      {/* Piernas (children[2] y [3], referenciadas arriba por índice) */}
      <group position={[-0.1, 0.68, 0]}>
        <mesh castShadow>
          <boxGeometry args={[0.12, 0.55, 0.12]} />
          <meshStandardMaterial color="#0f4a33" />
        </mesh>
      </group>
      <group position={[0.1, 0.68, 0]}>
        <mesh castShadow>
          <boxGeometry args={[0.12, 0.55, 0.12]} />
          <meshStandardMaterial color="#0f4a33" />
        </mesh>
      </group>
      {/* Brazos */}
      <mesh position={[-0.26, 0.95, 0]} castShadow>
        <boxGeometry args={[0.08, 0.4, 0.08]} />
        <meshStandardMaterial color="#1b7550" />
      </mesh>
      <mesh position={[0.26, 0.95, 0]} castShadow>
        <boxGeometry args={[0.08, 0.4, 0.08]} />
        <meshStandardMaterial color="#1b7550" />
      </mesh>
      {/* Cámara/sensor frontal, el "ojo" del X2. */}
      <mesh position={[0, 1.32, 0.13]}>
        <sphereGeometry args={[0.035, 8, 8]} />
        <meshStandardMaterial color="#8fd3ab" emissive="#8fd3ab" emissiveIntensity={0.6} />
      </mesh>
    </group>
  );
}

function Escena({ mapa, alElegirPlanta, alCambiarPosicion }: { mapa: MapaRespuesta; alElegirPlanta: (id: string) => void; alCambiarPosicion: (t: string) => void }) {
  const profundidadTotal = (mapa.camas.length - 1) * ESPACIO_CAMA;

  return (
    <>
      <ambientLight intensity={0.65} />
      <directionalLight position={[8, 12, 6]} intensity={1.1} castShadow />
      <fog attach="fog" args={['#eff5eb', 20, 55]} />

      {/* Piso del bloque. */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.01, 0]} receiveShadow>
        <planeGeometry args={[anchoTotal() + 6, profundidadTotal + 6]} />
        <meshStandardMaterial color="#d8e6cf" />
      </mesh>

      {mapa.camas.map((cama, i) => (
        <FilaCama key={cama.numero} cama={cama} z={(i - (mapa.camas.length - 1) / 2) * ESPACIO_CAMA} alElegirPlanta={alElegirPlanta} />
      ))}

      <Robot camas={mapa.camas} alCambiarPosicion={alCambiarPosicion} />

      <OrbitControls
        enablePan
        minDistance={6}
        maxDistance={40}
        maxPolarAngle={Math.PI / 2.15}
        target={[0, 0.5, 0]}
      />
    </>
  );
}

interface Props {
  mapa: MapaRespuesta;
  alAbrirPlanta: (plantaId: string) => void;
}

export function Mapa3D({ mapa, alAbrirPlanta }: Props) {
  const [posicionRobot, setPosicionRobot] = useState('Nave 1 · Cama 1');

  return (
    <div className="mapa-3d">
      <div className="mapa-3d-hud">
        <span className="txt-etiqueta apagado">Robot X2 recorriendo</span>
        <span className="txt-pequeno-fuerte">{posicionRobot}</span>
      </div>
      <Canvas shadows camera={{ position: [10, 9, 16], fov: 45 }}>
        <Escena mapa={mapa} alElegirPlanta={alAbrirPlanta} alCambiarPosicion={setPosicionRobot} />
      </Canvas>
      <p className="apagado txt-etiqueta mapa-3d-nota">
        Representación 3D estilizada del bloque y del recorrido — no es un modelo CAD del AgiBot X2 Ultra.
        Arrastra para rotar, rueda para acercar. Toca un punto para abrir la planta.
      </p>
    </div>
  );
}
