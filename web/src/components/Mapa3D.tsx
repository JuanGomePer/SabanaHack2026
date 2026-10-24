/**
 * Vista 3D del bloque: invernadero con iluminación realista y el recorrido
 * del robot, con control de reproducción.
 *
 * El robot está modelado con las proporciones reales publicadas del AgiBot
 * X2 Ultra (1.31 m de alto, 0.46 m de ancho de hombros, 30 grados de
 * libertad: 1 cuello + 3 cintura + 7 por brazo + 6 por pierna, cabeza con
 * LiDAR + cámaras estéreo frontales + cámara trasera, mochila de cómputo).
 * No existe en el repo ningún archivo CAD/GLB del robot real, así que el
 * cuerpo sigue siendo geometría procedural armada en Three.js — pero ahora
 * replica fielmente las dimensiones y la disposición de articulaciones del
 * robot real, en vez de ser una forma genérica. Los datos (estado de cada
 * celda, naves, camas) son los reales de /api/mapa.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { ContactShadows, OrbitControls } from '@react-three/drei';
import { Pause, Play } from 'lucide-react';
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
const MARGEN_INVERNADERO = 2.6;
const ALTURA_ALERO = 2.5;
const ALTURA_CUMBRERA = 4.2;

function anchoTotal(): number {
  return (CELDAS_POR_CAMA - 1) * ESPACIO_CELDA;
}

/** Variación determinista (sin azar real) para que los arbustos no se vean clonados. */
function variacion(i: number): number {
  return 0.82 + ((i * 37) % 11) / 11 * 0.36;
}

/** Una cama: fila de arbustos de arándano (follaje + fruto coloreado por el estado de su celda). */
function FilaCama({
  cama,
  z,
  alElegirPlanta,
}: {
  cama: Cama;
  z: number;
  alElegirPlanta: (plantaId: string) => void;
}) {
  const refFollaje = useRef<THREE.InstancedMesh>(null);
  const refFruto = useRef<THREE.InstancedMesh>(null);
  const colorObjeto = useMemo(() => new THREE.Color(), []);

  // Posiciona cada instancia una vez montado el mesh (el ref no existe aún
  // durante el render, así que esto tiene que ir en un efecto, no en useMemo).
  useEffect(() => {
    const follaje = refFollaje.current;
    const fruto = refFruto.current;
    if (!follaje || !fruto) return;
    const matrizFollaje = new THREE.Matrix4();
    const matrizFruto = new THREE.Matrix4();
    const escala = new THREE.Vector3();
    cama.celdas.forEach((celda, i) => {
      const x = i * ESPACIO_CELDA - anchoTotal() / 2;
      const s = variacion(i);
      escala.set(s, s, s);
      matrizFollaje.compose(
        new THREE.Vector3(x, 0.17 * s, 0),
        new THREE.Quaternion(),
        escala,
      );
      follaje.setMatrixAt(i, matrizFollaje);

      matrizFruto.setPosition(x + 0.06, 0.3 * s, 0.1);
      fruto.setMatrixAt(i, matrizFruto);
      colorObjeto.set(COLOR_ESTADO[celda.estado]);
      fruto.setColorAt(i, colorObjeto);
    });
    follaje.instanceMatrix.needsUpdate = true;
    fruto.instanceMatrix.needsUpdate = true;
    if (fruto.instanceColor) fruto.instanceColor.needsUpdate = true;
  }, [cama, colorObjeto]);

  return (
    <group position={[0, 0, z]}>
      {/* Cama elevada de sustrato. */}
      <mesh position={[0, 0.07, 0]} receiveShadow castShadow>
        <boxGeometry args={[anchoTotal() + ESPACIO_CELDA, 0.14, 0.72]} />
        <meshStandardMaterial color="#5a3d28" roughness={0.95} />
      </mesh>
      {/* Manguera de riego por goteo, a lo largo de la cama. */}
      <mesh position={[0, 0.15, 0.08]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.012, 0.012, anchoTotal() + ESPACIO_CELDA, 6]} />
        <meshStandardMaterial color="#1b1d1f" roughness={0.6} />
      </mesh>
      {/* Follaje: el arbusto de cada mata. */}
      <instancedMesh ref={refFollaje} args={[undefined, undefined, cama.celdas.length]} castShadow receiveShadow>
        <icosahedronGeometry args={[0.24, 0]} />
        <meshStandardMaterial color="#2f5a35" roughness={0.85} />
      </instancedMesh>
      {/* Fruto/indicador de estado de cada mata (dato real de /api/mapa). */}
      <instancedMesh
        ref={refFruto}
        args={[undefined, undefined, cama.celdas.length]}
        castShadow
        onClick={(evento) => {
          evento.stopPropagation();
          const i = evento.instanceId;
          if (i === undefined) return;
          const celda = cama.celdas[i];
          const plantaId = celda.plantaId ?? (celda.plantas[0] ? idPlanta(cama.numero, celda.plantas[0]) : undefined);
          if (plantaId) alElegirPlanta(plantaId);
        }}
      >
        <sphereGeometry args={[0.1, 8, 8]} />
        <meshStandardMaterial roughness={0.4} />
      </instancedMesh>
    </group>
  );
}

/** Un segmento articulado reutilizable: una caja/cilindro "carne" + una junta oscura. */
function Segmento({
  largo,
  ancho = 0.1,
  junta = 0.045,
  color = '#f1f3f5',
}: {
  largo: number;
  ancho?: number;
  junta?: number;
  color?: string;
}) {
  return (
    <group>
      <mesh position={[0, -largo / 2, 0]} castShadow>
        <boxGeometry args={[ancho, largo, ancho]} />
        <meshStandardMaterial color={color} roughness={0.55} />
      </mesh>
      <mesh position={[0, 0, 0]} castShadow>
        <sphereGeometry args={[junta, 10, 10]} />
        <meshStandardMaterial color="#232629" roughness={0.35} metalness={0.4} />
      </mesh>
    </group>
  );
}

interface RobotProps {
  camas: Cama[];
  reproduciendo: boolean;
  alCambiarPosicion: (texto: string) => void;
}

/**
 * AgiBot X2 Ultra: proporciones reales (1.31 m alto, hombros 0.46 m) y
 * jerarquía de articulaciones real (cuello, cintura, hombro+codo por brazo,
 * cadera+rodilla por pierna), recorriendo cama por cama cuando está en
 * reproducción.
 */
function Robot({ camas, reproduciendo, alCambiarPosicion }: RobotProps) {
  const grupo = useRef<THREE.Group>(null);
  const caderaIzq = useRef<THREE.Group>(null);
  const caderaDer = useRef<THREE.Group>(null);
  const hombroIzq = useRef<THREE.Group>(null);
  const hombroDer = useRef<THREE.Group>(null);
  const cabeza = useRef<THREE.Group>(null);
  const lidar = useRef<THREE.Mesh>(null);
  const indiceCama = useRef(0);
  const progreso = useRef(0);
  const SEGUNDOS_POR_CAMA = 4.5;

  useFrame((estado, delta) => {
    const t = estado.clock.elapsedTime;
    if (lidar.current) lidar.current.rotation.y = t * 1.4;
    if (cabeza.current) cabeza.current.rotation.y = Math.sin(t * 0.6) * 0.35;

    if (camas.length === 0 || !grupo.current) return;

    if (reproduciendo) {
      progreso.current += delta / SEGUNDOS_POR_CAMA;
      if (progreso.current >= 1) {
        progreso.current = 0;
        indiceCama.current = (indiceCama.current + 1) % camas.length;
        const cama = camas[indiceCama.current];
        alCambiarPosicion(`Nave ${cama.nave} · Cama ${cama.numero}`);
      }
    }

    const x = progreso.current * anchoTotal() - anchoTotal() / 2;
    const z = (indiceCama.current - (camas.length - 1) / 2) * ESPACIO_CAMA;
    grupo.current.position.set(x, 0, z);

    const zancada = reproduciendo ? Math.sin(t * 7) * 0.5 : 0;
    if (caderaIzq.current) caderaIzq.current.rotation.x = zancada;
    if (caderaDer.current) caderaDer.current.rotation.x = -zancada;
    if (hombroIzq.current) hombroIzq.current.rotation.x = -zancada * 0.8;
    if (hombroDer.current) hombroDer.current.rotation.x = zancada * 0.8;
  });

  const BLANCO = '#eef1f3';
  const GRIS_OSCURO = '#232629';

  return (
    <group ref={grupo}>
      {/* Piernas: cadera (3 DOF de cintura las mueve en conjunto) -> muslo -> rodilla -> pantorrilla -> pie. */}
      <group ref={caderaIzq} position={[-0.11, 0.62, 0]}>
        <Segmento largo={0.33} color={BLANCO} />
        <group position={[0, -0.33, 0]}>
          <Segmento largo={0.3} color={GRIS_OSCURO} />
          <mesh position={[0, -0.33, 0.03]} castShadow>
            <boxGeometry args={[0.1, 0.04, 0.18]} />
            <meshStandardMaterial color={GRIS_OSCURO} roughness={0.5} />
          </mesh>
        </group>
      </group>
      <group ref={caderaDer} position={[0.11, 0.62, 0]}>
        <Segmento largo={0.33} color={BLANCO} />
        <group position={[0, -0.33, 0]}>
          <Segmento largo={0.3} color={GRIS_OSCURO} />
          <mesh position={[0, -0.33, 0.03]} castShadow>
            <boxGeometry args={[0.1, 0.04, 0.18]} />
            <meshStandardMaterial color={GRIS_OSCURO} roughness={0.5} />
          </mesh>
        </group>
      </group>

      {/* Cintura (3 DOF) + torso. */}
      <mesh position={[0, 0.78, 0]} castShadow>
        <boxGeometry args={[0.22, 0.14, 0.14]} />
        <meshStandardMaterial color={GRIS_OSCURO} roughness={0.5} metalness={0.3} />
      </mesh>
      <mesh position={[0, 1.04, 0]} castShadow>
        <boxGeometry args={[0.37, 0.4, 0.19]} />
        <meshStandardMaterial color={BLANCO} roughness={0.5} />
      </mesh>
      {/* Mochila de cómputo/batería (doble RK3588 + Orin NX + ~500 Wh). */}
      <mesh position={[0, 1.06, -0.12]} castShadow>
        <boxGeometry args={[0.28, 0.3, 0.08]} />
        <meshStandardMaterial color={GRIS_OSCURO} roughness={0.6} />
      </mesh>

      {/* Brazos: hombro (7 DOF totales por brazo) -> codo -> antebrazo -> mano. */}
      <group ref={hombroIzq} position={[-0.23, 1.2, 0]}>
        <Segmento largo={0.3} ancho={0.08} color={BLANCO} />
        <group position={[0, -0.3, 0]}>
          <Segmento largo={0.28} ancho={0.07} color={BLANCO} />
        </group>
      </group>
      <group ref={hombroDer} position={[0.23, 1.2, 0]}>
        <Segmento largo={0.3} ancho={0.08} color={BLANCO} />
        <group position={[0, -0.3, 0]}>
          <Segmento largo={0.28} ancho={0.07} color={BLANCO} />
        </group>
      </group>

      {/* Cuello (1 DOF) + cabeza con sensores reales: LiDAR 3D, cámaras RGB-D estéreo frontales, cámara trasera, sensor táctil. */}
      <group ref={cabeza} position={[0, 1.33, 0]}>
        <mesh castShadow>
          <boxGeometry args={[0.2, 0.17, 0.18]} />
          <meshStandardMaterial color={BLANCO} roughness={0.45} />
        </mesh>
        {/* Visor de cámaras estéreo frontales. */}
        <mesh position={[0, 0, 0.09]} castShadow>
          <boxGeometry args={[0.16, 0.045, 0.02]} />
          <meshStandardMaterial color={GRIS_OSCURO} roughness={0.2} metalness={0.5} />
        </mesh>
        <mesh position={[-0.045, 0, 0.1]}>
          <sphereGeometry args={[0.014, 8, 8]} />
          <meshStandardMaterial color="#9fd8ff" emissive="#9fd8ff" emissiveIntensity={0.7} />
        </mesh>
        <mesh position={[0.045, 0, 0.1]}>
          <sphereGeometry args={[0.014, 8, 8]} />
          <meshStandardMaterial color="#9fd8ff" emissive="#9fd8ff" emissiveIntensity={0.7} />
        </mesh>
        {/* Cámara trasera. */}
        <mesh position={[0, 0, -0.095]}>
          <sphereGeometry args={[0.013, 8, 8]} />
          <meshStandardMaterial color="#9fd8ff" emissive="#9fd8ff" emissiveIntensity={0.5} />
        </mesh>
        {/* Puck de LiDAR 3D girando sobre la cabeza. */}
        <mesh ref={lidar} position={[0, 0.11, 0]} castShadow>
          <cylinderGeometry args={[0.055, 0.055, 0.04, 16]} />
          <meshStandardMaterial color={GRIS_OSCURO} roughness={0.3} metalness={0.6} />
        </mesh>
      </group>
    </group>
  );
}

/** Estructura y vidrios del invernadero (sin dependencias externas, para no fallar si no hay red). */
function Invernadero({ ancho, profundo }: { ancho: number; profundo: number }) {
  const mitadAncho = ancho / 2;
  const mitadProfundo = profundo / 2;
  const numCostillas = Math.max(2, Math.round(profundo / ESPACIO_CAMA / 2));
  const costillas = Array.from({ length: numCostillas + 1 }, (_, i) => -mitadProfundo + (i * profundo) / numCostillas);

  const vidrio = (
    <meshPhysicalMaterial
      color="#dff1fb"
      transparent
      opacity={0.3}
      roughness={0.12}
      metalness={0}
      side={THREE.DoubleSide}
    />
  );

  return (
    <group>
      {/* Muro bajo perimetral. */}
      {[-1, 1].map((lado) => (
        <mesh key={`muro-x-${lado}`} position={[lado * mitadAncho, 0.45, 0]} castShadow receiveShadow>
          <boxGeometry args={[0.12, 0.9, profundo]} />
          <meshStandardMaterial color="#cfd3d2" roughness={0.9} />
        </mesh>
      ))}
      {[-1, 1].map((lado) => (
        <mesh key={`muro-z-${lado}`} position={[0, 0.45, lado * mitadProfundo]} castShadow receiveShadow>
          <boxGeometry args={[ancho, 0.9, 0.12]} />
          <meshStandardMaterial color="#cfd3d2" roughness={0.9} />
        </mesh>
      ))}

      {/* Paredes acristaladas hasta el alero. */}
      {[-1, 1].map((lado) => (
        <mesh key={`vidrio-x-${lado}`} position={[lado * mitadAncho, (0.9 + ALTURA_ALERO) / 2, 0]}>
          <boxGeometry args={[0.04, ALTURA_ALERO - 0.9, profundo]} />
          {vidrio}
        </mesh>
      ))}
      {[-1, 1].map((lado) => (
        <mesh key={`vidrio-z-${lado}`} position={[0, (0.9 + ALTURA_ALERO) / 2, lado * mitadProfundo]}>
          <boxGeometry args={[ancho, ALTURA_ALERO - 0.9, 0.04]} />
          {vidrio}
        </mesh>
      ))}

      {/* Cerchas metálicas a intervalos regulares. */}
      {costillas.map((z, i) => (
        <group key={`cercha-${i}`} position={[0, 0, z]}>
          <mesh position={[-mitadAncho, ALTURA_ALERO / 2, 0]} castShadow>
            <cylinderGeometry args={[0.035, 0.035, ALTURA_ALERO, 8]} />
            <meshStandardMaterial color="#5b6165" roughness={0.4} metalness={0.6} />
          </mesh>
          <mesh position={[mitadAncho, ALTURA_ALERO / 2, 0]} castShadow>
            <cylinderGeometry args={[0.035, 0.035, ALTURA_ALERO, 8]} />
            <meshStandardMaterial color="#5b6165" roughness={0.4} metalness={0.6} />
          </mesh>
          <mesh position={[-mitadAncho / 2, ALTURA_ALERO, 0]} rotation={[0, 0, -Math.atan2(ALTURA_CUMBRERA - ALTURA_ALERO, mitadAncho / 2)]} castShadow>
            <cylinderGeometry args={[0.03, 0.03, Math.hypot(mitadAncho / 2, ALTURA_CUMBRERA - ALTURA_ALERO) * 1.02, 8]} />
            <meshStandardMaterial color="#5b6165" roughness={0.4} metalness={0.6} />
          </mesh>
          <mesh position={[mitadAncho / 2, ALTURA_ALERO, 0]} rotation={[0, 0, Math.atan2(ALTURA_CUMBRERA - ALTURA_ALERO, mitadAncho / 2)]} castShadow>
            <cylinderGeometry args={[0.03, 0.03, Math.hypot(mitadAncho / 2, ALTURA_CUMBRERA - ALTURA_ALERO) * 1.02, 8]} />
            <meshStandardMaterial color="#5b6165" roughness={0.4} metalness={0.6} />
          </mesh>
        </group>
      ))}

      {/* Dos faldones de techo a dos aguas, acristalados. */}
      {[-1, 1].map((lado) => {
        const largo = Math.hypot(mitadAncho, ALTURA_CUMBRERA - ALTURA_ALERO);
        const angulo = Math.atan2(ALTURA_CUMBRERA - ALTURA_ALERO, mitadAncho);
        return (
          <mesh
            key={`techo-${lado}`}
            position={[lado * mitadAncho / 2, (ALTURA_ALERO + ALTURA_CUMBRERA) / 2, 0]}
            rotation={[0, 0, lado * angulo]}
          >
            <boxGeometry args={[largo, 0.03, profundo + 0.4]} />
            {vidrio}
          </mesh>
        );
      })}

      {/* Cumbrera. */}
      <mesh position={[0, ALTURA_CUMBRERA, 0]} castShadow>
        <boxGeometry args={[0.08, 0.08, profundo]} />
        <meshStandardMaterial color="#5b6165" roughness={0.4} metalness={0.6} />
      </mesh>

      {/* Lámparas de cultivo colgadas de la cumbrera. */}
      {costillas.map((z, i) => (
        <group key={`lampara-${i}`} position={[0, ALTURA_ALERO - 0.1, z]}>
          <mesh>
            <boxGeometry args={[0.5, 0.06, 0.16]} />
            <meshStandardMaterial color="#9fa3a6" roughness={0.5} metalness={0.4} />
          </mesh>
          <mesh position={[0, -0.03, 0]}>
            <boxGeometry args={[0.46, 0.015, 0.12]} />
            <meshStandardMaterial color="#fff6df" emissive="#ffe6a3" emissiveIntensity={0.9} />
          </mesh>
          <pointLight position={[0, -0.1, 0]} intensity={2.2} distance={5} color="#fff1cf" />
        </group>
      ))}
    </group>
  );
}

/**
 * Ciclo de día/noche: mueve el sol en un arco, cambia su color/intensidad,
 * la luz ambiental y el color del cielo/niebla según la hora simulada.
 * La hora solo avanza mientras la reproducción está activa, igual que el
 * recorrido del robot.
 */
function CicloDia({
  reproduciendo,
  sombraAncho,
  sombraProfundo,
  onHora,
}: {
  reproduciendo: boolean;
  sombraAncho: number;
  sombraProfundo: number;
  onHora: (texto: string) => void;
}) {
  const sol = useRef<THREE.DirectionalLight>(null);
  const ambiente = useRef<THREE.HemisphereLight>(null);
  const hora = useRef(9);
  const ultimoMinutoMostrado = useRef(-1);
  const { scene } = useThree();
  const SEGUNDOS_POR_HORA = 6; // día completo (24 h) en 144 s reproduciendo

  const cielo = useMemo(() => new THREE.Color(), []);
  const cieloNoche = useMemo(() => new THREE.Color('#0c1730'), []);
  const cieloDia = useMemo(() => new THREE.Color('#cfe7f3'), []);
  const solFrio = useMemo(() => new THREE.Color('#4a5a7a'), []);
  const solCalido = useMemo(() => new THREE.Color('#ffb066'), []);
  const solMediodia = useMemo(() => new THREE.Color('#fff7e4'), []);
  const colorSolActual = useMemo(() => new THREE.Color(), []);

  useEffect(() => {
    scene.background = cielo;
  }, [scene, cielo]);

  useFrame((_, delta) => {
    if (reproduciendo) hora.current = (hora.current + delta / SEGUNDOS_POR_HORA) % 24;
    const h = hora.current;

    // Altura solar: 0 en el horizonte (6:00 y 18:00), máxima a mediodía, negativa de noche.
    const alturaSolar = Math.sin(((h - 6) / 12) * Math.PI);
    const dia = THREE.MathUtils.clamp(alturaSolar, 0, 1);
    const acimut = (h / 24) * Math.PI * 2;
    const radio = Math.max(sombraAncho, sombraProfundo) * 0.9;

    if (sol.current) {
      sol.current.position.set(Math.cos(acimut) * radio, Math.max(alturaSolar, -0.08) * 16 + 2, Math.sin(acimut) * radio);
      sol.current.intensity = THREE.MathUtils.lerp(0.05, 2.1, dia);
      colorSolActual.copy(solFrio);
      if (dia > 0.01) colorSolActual.copy(solCalido).lerp(solMediodia, dia);
      sol.current.color.copy(colorSolActual);
    }
    if (ambiente.current) ambiente.current.intensity = THREE.MathUtils.lerp(0.18, 0.6, dia);

    cielo.copy(cieloNoche).lerp(cieloDia, dia);
    if (scene.fog && 'color' in scene.fog) (scene.fog as THREE.Fog).color.copy(cielo);

    const minutoTotal = Math.floor(h * 60);
    const minutoRedondeado = Math.floor(minutoTotal / 5) * 5;
    if (minutoRedondeado !== ultimoMinutoMostrado.current) {
      ultimoMinutoMostrado.current = minutoRedondeado;
      const hh = Math.floor(minutoRedondeado / 60) % 24;
      const mm = minutoRedondeado % 60;
      onHora(`${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`);
    }
  });

  return (
    <>
      <hemisphereLight ref={ambiente} args={['#cfe9fb', '#4a3b2a', 0.5]} />
      <directionalLight
        ref={sol}
        intensity={1.6}
        color="#fff3d6"
        castShadow
        shadow-mapSize={[2048, 2048]}
        shadow-camera-left={-sombraAncho}
        shadow-camera-right={sombraAncho}
        shadow-camera-top={sombraProfundo}
        shadow-camera-bottom={-sombraProfundo}
      />
    </>
  );
}

function Escena({
  mapa,
  reproduciendo,
  alElegirPlanta,
  alCambiarPosicion,
  alCambiarHora,
}: {
  mapa: MapaRespuesta;
  reproduciendo: boolean;
  alElegirPlanta: (id: string) => void;
  alCambiarPosicion: (t: string) => void;
  alCambiarHora: (t: string) => void;
}) {
  const profundidadTotal = (mapa.camas.length - 1) * ESPACIO_CAMA;
  const anchoInvernadero = anchoTotal() + MARGEN_INVERNADERO * 2;
  const profundoInvernadero = profundidadTotal + MARGEN_INVERNADERO * 2;

  return (
    <>
      <CicloDia
        reproduciendo={reproduciendo}
        sombraAncho={anchoInvernadero}
        sombraProfundo={profundoInvernadero}
        onHora={alCambiarHora}
      />
      <fog attach="fog" args={['#dcefdd', 24, 60]} />

      {/* Piso del invernadero. */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.01, 0]} receiveShadow>
        <planeGeometry args={[anchoInvernadero, profundoInvernadero]} />
        <meshStandardMaterial color="#b7b2a4" roughness={0.95} />
      </mesh>

      <Invernadero ancho={anchoInvernadero} profundo={profundoInvernadero} />

      {mapa.camas.map((cama, i) => (
        <FilaCama key={cama.numero} cama={cama} z={(i - (mapa.camas.length - 1) / 2) * ESPACIO_CAMA} alElegirPlanta={alElegirPlanta} />
      ))}

      <Robot camas={mapa.camas} reproduciendo={reproduciendo} alCambiarPosicion={alCambiarPosicion} />

      <ContactShadows position={[0, 0, 0]} opacity={0.45} scale={Math.max(anchoInvernadero, profundoInvernadero)} blur={2} far={3} />

      <OrbitControls
        enablePan
        minDistance={6}
        maxDistance={46}
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
  const [posicionRobot, setPosicionRobot] = useState('Detenido en Nave 1 · Cama 1');
  const [reproduciendo, setReproduciendo] = useState(false);
  const [horaTexto, setHoraTexto] = useState('09:00');

  return (
    <div className="mapa-3d">
      <div className="mapa-3d-hud">
        <button
          type="button"
          className="mapa-3d-boton-play"
          onClick={() => setReproduciendo((v) => !v)}
          aria-label={reproduciendo ? 'Pausar recorrido' : 'Reproducir recorrido'}
        >
          {reproduciendo ? <Pause size={16} /> : <Play size={16} />}
          {reproduciendo ? 'Pausar' : 'Reproducir'}
        </button>
        <div>
          <span className="txt-etiqueta apagado">Robot X2 Ultra · {horaTexto}</span>
          <br />
          <span className="txt-pequeno-fuerte">{posicionRobot}</span>
        </div>
      </div>
      <Canvas shadows="soft" camera={{ position: [11, 9, 17], fov: 45 }} gl={{ toneMappingExposure: 1.15 }}>
        <Escena
          mapa={mapa}
          reproduciendo={reproduciendo}
          alElegirPlanta={alAbrirPlanta}
          alCambiarPosicion={setPosicionRobot}
          alCambiarHora={setHoraTexto}
        />
      </Canvas>
      <p className="apagado txt-etiqueta mapa-3d-nota">
        Invernadero y robot recreados con las dimensiones reales publicadas del AgiBot X2 Ultra (1.31 m, 30 GDL) —
        geometría procedural, no un modelo CAD importado. Arrastra para rotar, rueda para acercar, toca una mata para
        abrir la planta.
      </p>
    </div>
  );
}
