import { Canvas, useFrame } from "@react-three/fiber";
import { Environment, Instance, Instances, Lightformer, OrbitControls, Html } from "@react-three/drei";
import { useMemo, useRef } from "react";
import * as THREE from "three";
import type { AgentState, WorldState } from "@/lib/genesis/world";
import { isNight } from "@/lib/genesis/world";

const TERRAIN: Record<string, { color: string; h: number }> = {
  water: { color: "#2b5a8a", h: 0.15 },
  sand: { color: "#b39a56", h: 0.35 },
  grass: { color: "#4f7f3f", h: 0.45 },
  forest: { color: "#35603a", h: 0.5 },
  rock: { color: "#6a665c", h: 1.1 },
};

interface Props {
  state: WorldState;
  selectedAgent: string | null;
  onSelectAgent: (id: string | null) => void;
  onSelectTile: (x: number, y: number) => void;
}

export function World3D(props: Props) {
  const night = isNight(props.state);
  const { width, height } = props.state.config;
  const bg = night ? "#0d0f1c" : "#1c1915";
  return (
    <Canvas shadows dpr={[1, 2]} camera={{ position: [0, 18, 20], fov: 45 }}>
      <color attach="background" args={[bg]} />
      <fog attach="fog" args={[bg, 30, 70]} />
      <ambientLight intensity={night ? 0.25 : 0.55} color={night ? "#7f8cff" : "#fff2dc"} />
      <directionalLight
        position={night ? [-10, 14, -6] : [12, 20, 8]}
        intensity={night ? 0.6 : 1.8}
        color={night ? "#9fb0ff" : "#ffe1b8"}
        castShadow
        shadow-mapSize-width={2048}
        shadow-mapSize-height={2048}
        shadow-camera-left={-20} shadow-camera-right={20}
        shadow-camera-top={20} shadow-camera-bottom={-20}
      />
      <Environment resolution={64}>
        <Lightformer intensity={night ? 0.4 : 1.5} position={[0, 5, 0]} scale={[10, 10, 1]} />
        <Lightformer intensity={0.6} color="#d4653a" position={[-5, 1, -1]} rotation-y={Math.PI / 2} scale={[20, 1, 1]} />
      </Environment>
      <group position={[-width / 2 + 0.5, 0, -height / 2 + 0.5]}>
        <Terrain {...props} />
        {props.state.agents.map((a) => (
          <Agent key={a.id} a={a} selected={a.id === props.selectedAgent}
            onClick={() => props.onSelectAgent(a.id === props.selectedAgent ? null : a.id)} />
        ))}
      </group>
      <OrbitControls makeDefault maxPolarAngle={Math.PI / 2.3} minDistance={8} maxDistance={45} />
    </Canvas>
  );
}

function Terrain({ state, onSelectAgent, onSelectTile }: Props) {
  const tiles = useMemo(() => {
    const out: { x: number; y: number; terrain: string; obj: string | null; charges: number }[] = [];
    state.tiles.forEach((row, y) => row.forEach((t, x) => out.push({ x, y, terrain: t.terrain, obj: t.obj, charges: t.charges })));
    return out;
  }, [state.tiles, state.clock]);

  return (
    <>
      {Object.entries(TERRAIN).map(([k, { color, h }]) => (
        <Instances key={k} limit={600} castShadow receiveShadow>
          <boxGeometry args={[0.98, 1, 0.98]} />
          <meshStandardMaterial color={color} roughness={k === "water" ? 0.2 : 0.9} metalness={k === "water" ? 0.3 : 0} />
          {tiles.filter((t) => t.terrain === k).map((t) => (
            <Instance key={`${t.x},${t.y}`} position={[t.x, h / 2, t.y]} scale={[1, h, 1]}
              onClick={(e) => { e.stopPropagation(); onSelectAgent(null); onSelectTile(t.x, t.y); }} />
          ))}
        </Instances>
      ))}
      {/* Trees */}
      <Instances limit={600} castShadow>
        <coneGeometry args={[0.35, 0.9, 6]} />
        <meshStandardMaterial color="#5fae6e" flatShading />
        {tiles.filter((t) => t.obj === "tree").map((t) => (
          <Instance key={`t${t.x},${t.y}`} position={[t.x, TERRAIN[t.terrain]!.h + 0.55, t.y]} />
        ))}
      </Instances>
      <Instances limit={600} castShadow>
        <cylinderGeometry args={[0.07, 0.09, 0.25, 5]} />
        <meshStandardMaterial color="#6b4a2f" />
        {tiles.filter((t) => t.obj === "tree").map((t) => (
          <Instance key={`k${t.x},${t.y}`} position={[t.x, TERRAIN[t.terrain]!.h + 0.12, t.y]} />
        ))}
      </Instances>
      {/* Stones */}
      <Instances limit={600} castShadow>
        <dodecahedronGeometry args={[0.22, 0]} />
        <meshStandardMaterial color="#a9a497" flatShading />
        {tiles.filter((t) => t.obj === "stone").map((t) => (
          <Instance key={`s${t.x},${t.y}`} position={[t.x, TERRAIN[t.terrain]!.h + 0.15, t.y]} rotation={[t.x, t.y, 0]} />
        ))}
      </Instances>
      {/* Berry bushes */}
      {tiles.filter((t) => t.obj === "berry").map((t) => (
        <group key={`b${t.x},${t.y}`} position={[t.x, TERRAIN[t.terrain]!.h, t.y]}>
          <mesh castShadow position={[0, 0.18, 0]}>
            <sphereGeometry args={[0.24, 8, 6]} />
            <meshStandardMaterial color="#3f6b35" flatShading />
          </mesh>
          {t.charges > 0 && [0, 1, 2].map((i) => (
            <mesh key={i} position={[Math.cos(i * 2.1) * 0.2, 0.28, Math.sin(i * 2.1) * 0.2]}>
              <sphereGeometry args={[0.06, 6, 4]} />
              <meshStandardMaterial color="#d4653a" emissive="#5a1a08" />
            </mesh>
          ))}
        </group>
      ))}
    </>
  );
}

function Agent({ a, selected, onClick }: { a: AgentState; selected: boolean; onClick: () => void }) {
  const ref = useRef<THREE.Group>(null);
  const target = useRef(new THREE.Vector3(a.x, 0, a.y));
  target.current.set(a.x, 0, a.y);
  useFrame((st, raw) => {
    const g = ref.current;
    if (!g) return;
    const dt = Math.min(raw, 0.05);
    g.position.lerp(target.current, 1 - Math.exp(-10 * dt));
    g.position.y = 0.5 + Math.abs(Math.sin(st.clock.elapsedTime * 4 + a.x)) * 0.08;
  });
  return (
    <group ref={ref} position={[a.x, 0.5, a.y]} onClick={(e) => { e.stopPropagation(); onClick(); }}>
      <mesh castShadow position={[0, 0.3, 0]}>
        <capsuleGeometry args={[0.18, 0.3, 4, 10]} />
        <meshStandardMaterial color={a.color} roughness={0.5} />
      </mesh>
      <mesh castShadow position={[0, 0.72, 0]}>
        <sphereGeometry args={[0.15, 12, 10]} />
        <meshStandardMaterial color={a.color} roughness={0.4} />
      </mesh>
      {(a.inventory["tool"] ?? 0) > 0 && (
        <mesh position={[0.22, 0.35, 0]} rotation={[0, 0, -0.6]}>
          <boxGeometry args={[0.05, 0.35, 0.05]} />
          <meshStandardMaterial color="#c9a227" metalness={0.6} roughness={0.3} />
        </mesh>
      )}
      {selected && (
        <mesh rotation-x={-Math.PI / 2} position={[0, 0.02, 0]}>
          <ringGeometry args={[0.32, 0.4, 24]} />
          <meshBasicMaterial color="#f7f4ec" />
        </mesh>
      )}
      <Html position={[0, 1.1, 0]} center distanceFactor={14} style={{ pointerEvents: "none" }}>
        <span style={{ font: "600 11px 'IBM Plex Mono', monospace", color: "#f7f4ec", textShadow: "0 1px 2px #000", whiteSpace: "nowrap" }}>
          {a.name}
        </span>
      </Html>
    </group>
  );
}
