import React, { useRef, useState, useEffect } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls, Sphere, Box, Torus, Line, Icosahedron, MeshDistortMaterial } from '@react-three/drei';
import * as THREE from 'three';
import { ConceptModel } from '../../types';

export const PREDEFINED_MODELS = [
  { type: 'atom', title: 'Atomic Structure' },
  { type: 'molecule', title: 'Molecular Bond' },
  { type: 'network', title: 'Neural Graph' },
  { type: 'chip', title: 'Silicon Processor' },
  { type: 'quantum', title: 'Quantum State' },
  { type: 'galaxy', title: 'Spiral Galaxy' },
  { type: 'brain', title: 'Cognitive Core' },
  { type: 'dna', title: 'Double Helix' }
];

export function AtomModel({ hovered }: { hovered: boolean }) {
  const groupRef = useRef<THREE.Group>(null);
  useFrame((state, delta) => {
    if (groupRef.current) {
      groupRef.current.rotation.y += delta * (hovered ? 1.5 : 0.5);
      groupRef.current.rotation.x += delta * (hovered ? 0.6 : 0.2);
      const targetScale = hovered ? 1.2 : 1;
      groupRef.current.scale.lerp(new THREE.Vector3(targetScale, targetScale, targetScale), delta * 5);
    }
  });

  return (
    <group>
      <group ref={groupRef}>
        <Sphere args={[0.5, 32, 32]}>
          <meshStandardMaterial color="#8b5cf6" />
        </Sphere>
        {[0, 1, 2].map((i) => (
          <Torus key={i} args={[1.5, 0.05, 16, 100]} rotation={[i * 1.5, i * 1, 0]}>
            <meshStandardMaterial color="#3b82f6" />
          </Torus>
        ))}
        {[0, 1, 2].map((i) => (
          <Sphere key={`e_${i}`} args={[0.1]} position={[1.5 * Math.cos(i * 2), 1.5 * Math.sin(i * 2), 0]}>
            <meshStandardMaterial color="#ef4444" />
          </Sphere>
        ))}
      </group>
    </group>
  );
}

export function MoleculeModel({ hovered }: { hovered: boolean }) {
  const groupRef = useRef<THREE.Group>(null);
  useFrame((state, delta) => {
    if (groupRef.current) {
      groupRef.current.rotation.y += delta * (hovered ? 1.2 : 0.4);
      groupRef.current.rotation.x -= delta * (hovered ? 0.9 : 0.3);
      const targetScale = hovered ? 1.2 : 1;
      groupRef.current.scale.lerp(new THREE.Vector3(targetScale, targetScale, targetScale), delta * 5);
    }
  });

  return (
    <group>
      <group ref={groupRef}>
        <Sphere args={[0.6]} position={[0, 0, 0]}>
          <meshStandardMaterial color="#10b981" />
        </Sphere>
        <Sphere args={[0.4]} position={[1, 1, 0]}>
          <meshStandardMaterial color="#f59e0b" />
        </Sphere>
        <Sphere args={[0.4]} position={[-1, -1, 1]}>
          <meshStandardMaterial color="#ef4444" />
        </Sphere>
        
        {/* Simple connections could use thin cylinders, but let's fake it with thin boxes for now */}
        <Box args={[1.4, 0.1, 0.1]} position={[0.5, 0.5, 0]} rotation={[0, 0, Math.PI / 4]}>
          <meshStandardMaterial color="#ffffff" opacity={0.5} transparent />
        </Box>
        <Box args={[1.4, 0.1, 0.1]} position={[-0.5, -0.5, 0.5]} rotation={[0, Math.PI/4, Math.PI/4]}>
          <meshStandardMaterial color="#ffffff" opacity={0.5} transparent />
        </Box>
      </group>
    </group>
  );
}

export function GlobeModel({ hovered }: { hovered: boolean }) {
  const globeRef = useRef<THREE.Mesh>(null);
  useFrame((state, delta) => {
    if (globeRef.current) {
      globeRef.current.rotation.y += delta * (hovered ? 0.8 : 0.2);
      const targetScale = hovered ? 1.2 : 1;
      globeRef.current.scale.lerp(new THREE.Vector3(targetScale, targetScale, targetScale), delta * 5);
    }
  });

  return (
    <group>
      <Sphere ref={globeRef} args={[1.5, 32, 32]}>
        <MeshDistortMaterial color="#3b82f6" distort={0.2} speed={2} roughness={0.5} opacity={0.8} transparent />
        <Sphere args={[1.45, 16, 16]}>
          <meshStandardMaterial color="#000" />
        </Sphere>
      </Sphere>
    </group>
  );
}

export function NetworkModel({ hovered }: { hovered: boolean }) {
  const groupRef = useRef<THREE.Group>(null);
  useFrame((state, delta) => {
    if (groupRef.current) {
      groupRef.current.rotation.y += delta * (hovered ? 1.0 : 0.3);
      const targetScale = hovered ? 1.2 : 1;
      groupRef.current.scale.lerp(new THREE.Vector3(targetScale, targetScale, targetScale), delta * 5);
    }
  });

  const p0 = new THREE.Vector3(0, 1, 0);
  const p1 = new THREE.Vector3(1, -0.5, 0.8);
  const p2 = new THREE.Vector3(-1, -0.5, 0.8);
  const p3 = new THREE.Vector3(0, -0.5, -1);
  const positions = [p0, p1, p2, p3];

  return (
    <group>
      <group ref={groupRef}>
        {positions.map((p, i) => (
          <Sphere key={i} args={[0.2, 16, 16]} position={p}>
            <meshStandardMaterial color="#8b5cf6" />
          </Sphere>
        ))}
        <Line points={[p0, p1]} color="white" lineWidth={1} />
        <Line points={[p0, p2]} color="white" lineWidth={1} />
        <Line points={[p0, p3]} color="white" lineWidth={1} />
        <Line points={[p1, p2]} color="white" lineWidth={1} />
        <Line points={[p2, p3]} color="white" lineWidth={1} />
        <Line points={[p3, p1]} color="white" lineWidth={1} />
      </group>
    </group>
  );
}

export function GeometryModel({ hovered }: { hovered: boolean }) {
  const groupRef = useRef<THREE.Mesh>(null);
  useFrame((state, delta) => {
    if (groupRef.current) {
      groupRef.current.rotation.x += delta * (hovered ? 1.5 : 0.5);
      groupRef.current.rotation.y += delta * (hovered ? 1.5 : 0.5);
      const targetScale = hovered ? 1.2 : 1;
      groupRef.current.scale.lerp(new THREE.Vector3(targetScale, targetScale, targetScale), delta * 5);
    }
  });

  return (
    <group>
      <Icosahedron ref={groupRef} args={[1.2, 0]}>
        <meshStandardMaterial color="#ef4444" wireframe />
      </Icosahedron>
    </group>
  );
}

export function DnaModel({ hovered }: { hovered: boolean }) {
  const groupRef = useRef<THREE.Group>(null);
  useFrame((state, delta) => {
    if (groupRef.current) {
      groupRef.current.rotation.y += delta * (hovered ? 2.0 : 0.5);
      const targetScale = hovered ? 1.2 : 1;
      groupRef.current.scale.lerp(new THREE.Vector3(targetScale, targetScale, targetScale), delta * 5);
    }
  });

  const nodes = [];
  for (let i = -5; i <= 5; i++) {
    const y = i * 0.25;
    const a = i * 0.5;
    const x1 = Math.cos(a) * 0.8;
    const z1 = Math.sin(a) * 0.8;
    const x2 = Math.cos(a + Math.PI) * 0.8;
    const z2 = Math.sin(a + Math.PI) * 0.8;
    nodes.push(
      <group key={i}>
        <Sphere args={[0.1]} position={[x1, y, z1]}>
          <meshStandardMaterial color="#ec4899" />
        </Sphere>
        <Sphere args={[0.1]} position={[x2, y, z2]}>
          <meshStandardMaterial color="#06b6d4" />
        </Sphere>
        <Box args={[1.6, 0.05, 0.05]} position={[0, y, 0]} rotation={[0, -a, 0]}>
          <meshStandardMaterial color="#ffffff" opacity={0.3} transparent />
        </Box>
      </group>
    );
  }

  return (
    <group ref={groupRef}>
      {nodes}
    </group>
  );
}

export function ChipModel({ hovered }: { hovered: boolean }) {
  const groupRef = useRef<THREE.Group>(null);
  useFrame((state, delta) => {
    if (groupRef.current) {
      groupRef.current.rotation.y += delta * (hovered ? 1.0 : 0.2);
      groupRef.current.rotation.x = Math.sin(state.clock.elapsedTime) * 0.2;
      const targetScale = hovered ? 1.2 : 1;
      groupRef.current.scale.lerp(new THREE.Vector3(targetScale, targetScale, targetScale), delta * 5);
    }
  });

  return (
    <group ref={groupRef}>
      <Box args={[1.5, 0.1, 1.5]}>
        <meshStandardMaterial color="#1f2937" />
      </Box>
      <Box args={[1.0, 0.12, 1.0]}>
        <meshStandardMaterial color="#111827" />
      </Box>
      {[...Array(6)].map((_, i) => (
        <group key={`pin1_${i}`}>
          <Box args={[0.05, 0.05, 0.2]} position={[-0.8, 0, -0.625 + i * 0.25]}>
            <meshStandardMaterial color="#fcd34d" />
          </Box>
          <Box args={[0.05, 0.05, 0.2]} position={[0.8, 0, -0.625 + i * 0.25]}>
            <meshStandardMaterial color="#fcd34d" />
          </Box>
          <Box args={[0.2, 0.05, 0.05]} position={[-0.625 + i * 0.25, 0, -0.8]}>
            <meshStandardMaterial color="#fcd34d" />
          </Box>
          <Box args={[0.2, 0.05, 0.05]} position={[-0.625 + i * 0.25, 0, 0.8]}>
            <meshStandardMaterial color="#fcd34d" />
          </Box>
        </group>
      ))}
      <Torus args={[0.3, 0.02, 16, 32]} rotation={[Math.PI/2, 0, 0]} position={[0, 0.06, 0]}>
        <meshStandardMaterial color="#0ea5e9" />
      </Torus>
    </group>
  );
}

export function QuantumModel({ hovered }: { hovered: boolean }) {
  const groupRef = useRef<THREE.Group>(null);
  useFrame((state, delta) => {
    if (groupRef.current) {
      groupRef.current.children.forEach((child, i) => {
        child.rotation.x += delta * (i + 1) * (hovered ? 2 : 0.5);
        child.rotation.y += delta * (i + 1) * (hovered ? 2 : 0.5);
      });
      const targetScale = hovered ? 1.2 : 1;
      groupRef.current.scale.lerp(new THREE.Vector3(targetScale, targetScale, targetScale), delta * 5);
    }
  });

  return (
    <group ref={groupRef}>
      <Sphere args={[0.2, 16, 16]}>
        <meshStandardMaterial color="#a855f7" />
      </Sphere>
      <Torus args={[1, 0.05, 16, 64]} rotation={[Math.PI/4, 0, 0]}>
        <meshStandardMaterial color="#ec4899" opacity={0.8} transparent />
      </Torus>
      <Torus args={[1, 0.05, 16, 64]} rotation={[0, Math.PI/4, 0]}>
        <meshStandardMaterial color="#06b6d4" opacity={0.8} transparent />
      </Torus>
      <Torus args={[1, 0.05, 16, 64]} rotation={[0, 0, Math.PI/4]}>
        <meshStandardMaterial color="#eab308" opacity={0.8} transparent />
      </Torus>
    </group>
  );
}

export function GalaxyModel({ hovered }: { hovered: boolean }) {
  const groupRef = useRef<THREE.Group>(null);
  useFrame((state, delta) => {
    if (groupRef.current) {
      groupRef.current.rotation.y += delta * (hovered ? 1.5 : 0.2);
      const targetScale = hovered ? 1.2 : 1;
      groupRef.current.scale.lerp(new THREE.Vector3(targetScale, targetScale, targetScale), delta * 5);
    }
  });

  const particles = [];
  for (let i = 0; i < 150; i++) {
    const angle = i * 0.15;
    const radius = 0.1 + i * 0.015;
    const x = Math.cos(angle) * radius + (Math.random() - 0.5) * 0.2;
    const y = (Math.random() - 0.5) * 0.2;
    const z = Math.sin(angle) * radius + (Math.random() - 0.5) * 0.2;

    const x2 = Math.cos(angle + Math.PI) * radius + (Math.random() - 0.5) * 0.2;
    const z2 = Math.sin(angle + Math.PI) * radius + (Math.random() - 0.5) * 0.2;

    particles.push(
      <group key={`gp_${i}`}>
        <Sphere args={[0.03]} position={[x, y, z]}>
           <meshStandardMaterial color="#8b5cf6" emissive="#8b5cf6" emissiveIntensity={0.5} />
        </Sphere>
        <Sphere args={[0.03]} position={[x2, y, z2]}>
           <meshStandardMaterial color="#0ea5e9" emissive="#0ea5e9" emissiveIntensity={0.5} />
        </Sphere>
      </group>
    );
  }

  return (
    <group ref={groupRef}>
      {particles}
    </group>
  );
}

export function CrystalModel({ hovered }: { hovered: boolean }) {
  const groupRef = useRef<THREE.Group>(null);
  useFrame((state, delta) => {
    if (groupRef.current) {
      groupRef.current.rotation.y += delta * (hovered ? 1.0 : 0.2);
      groupRef.current.position.y = Math.sin(state.clock.elapsedTime * 2) * 0.1;
      const targetScale = hovered ? 1.2 : 1;
      groupRef.current.scale.lerp(new THREE.Vector3(targetScale, targetScale, targetScale), delta * 5);
    }
  });

  return (
    <group ref={groupRef}>
      {/* Fallback to simple geometry since Octahedron might not be imported or exist directly without tricky imports */}
      <mesh rotation={[Math.PI/4, 0, Math.PI/4]}>
        <octahedronGeometry args={[1, 0]} />
        <meshPhysicalMaterial color="#38bdf8" roughness={0.1} transmission={0.9} thickness={0.5} opacity={0.8} transparent />
      </mesh>
      <mesh rotation={[0, Math.PI/4, 0]}>
        <octahedronGeometry args={[0.5, 0]} />
        <meshPhysicalMaterial color="#818cf8" roughness={0.1} transmission={0.9} thickness={0.2} opacity={0.8} transparent />
      </mesh>
    </group>
  );
}

export function BrainModel({ hovered }: { hovered: boolean }) {
  const groupRef = useRef<THREE.Group>(null);
  
  useFrame((state, delta) => {
    if (groupRef.current) {
      groupRef.current.rotation.y += delta * (hovered ? 1.0 : 0.2);
      const targetScale = hovered ? 1.2 : 1;
      groupRef.current.scale.lerp(new THREE.Vector3(targetScale, targetScale, targetScale), delta * 5);
    }
  });

  return (
    <group ref={groupRef}>
       <Sphere args={[0.8, 32, 32]} position={[-0.4, 0, 0]}>
          <MeshDistortMaterial color="#ec4899" distort={0.4} speed={2} roughness={0.2} />
       </Sphere>
       <Sphere args={[0.8, 32, 32]} position={[0.4, 0, 0]}>
          <MeshDistortMaterial color="#a855f7" distort={0.4} speed={2.2} roughness={0.2} />
       </Sphere>
    </group>
  );
}

export function WaveModel({ hovered }: { hovered: boolean }) {
  const groupRef = useRef<THREE.Group>(null);
  const timeRef = useRef(0);
  
  useFrame((state, delta) => {
    timeRef.current += delta * (hovered ? 3 : 1);
    if (groupRef.current) {
       groupRef.current.rotation.y += delta * 0.2;
       const targetScale = hovered ? 1.2 : 1;
       groupRef.current.scale.lerp(new THREE.Vector3(targetScale, targetScale, targetScale), delta * 5);
       
       groupRef.current.children.forEach((child) => {
         if (child instanceof THREE.Mesh) {
            child.position.y = Math.sin(timeRef.current + child.position.x * 2 + child.position.z * 2) * 0.3;
         }
       });
    }
  });

  const drops = [];
  for(let x=-1.5; x<=1.5; x+=0.4) {
    for(let z=-1.5; z<=1.5; z+=0.4) {
      drops.push(
        <mesh key={`${x}_${z}`} position={[x, 0, z]}>
          <sphereGeometry args={[0.08]} />
          <meshStandardMaterial color="#0ea5e9" />
        </mesh>
      );
    }
  }

  return (
    <group ref={groupRef}>
      {drops}
    </group>
  );
}

export function GearModel({ hovered }: { hovered: boolean }) {
  const groupRef = useRef<THREE.Group>(null);
  useFrame((state, delta) => {
    if (groupRef.current) {
      groupRef.current.rotation.z -= delta * (hovered ? 2.0 : 0.5);
      const targetScale = hovered ? 1.2 : 1;
      groupRef.current.scale.lerp(new THREE.Vector3(targetScale, targetScale, targetScale), delta * 5);
    }
  });

  const teeth = [];
  for (let i = 0; i < 12; i++) {
    const angle = (i / 12) * Math.PI * 2;
    teeth.push(
      <mesh key={i} position={[Math.cos(angle) * 1.1, Math.sin(angle) * 1.1, 0]} rotation={[0, 0, angle]}>
        <boxGeometry args={[0.3, 0.4, 0.2]} />
        <meshStandardMaterial color="#94a3b8" />
      </mesh>
    );
  }

  return (
    <group ref={groupRef}>
      <mesh rotation={[Math.PI/2, 0, 0]}>
        <cylinderGeometry args={[1, 1, 0.2, 32]} />
        <meshStandardMaterial color="#64748b" />
      </mesh>
      <mesh rotation={[Math.PI/2, 0, 0]}>
        <cylinderGeometry args={[0.4, 0.4, 0.25, 32]} />
        <meshStandardMaterial color="#1e293b" />
      </mesh>
      {teeth}
    </group>
  );
}

export function SatelliteModel({ hovered }: { hovered: boolean }) {
  const groupRef = useRef<THREE.Group>(null);
  useFrame((state, delta) => {
    if (groupRef.current) {
      groupRef.current.rotation.y += delta * (hovered ? 1.0 : 0.2);
      groupRef.current.position.y = Math.sin(state.clock.elapsedTime) * 0.2;
      const targetScale = hovered ? 1.2 : 1;
      groupRef.current.scale.lerp(new THREE.Vector3(targetScale, targetScale, targetScale), delta * 5);
    }
  });

  return (
    <group ref={groupRef} rotation={[0.2, 0, 0.3]}>
      <mesh>
        <boxGeometry args={[0.6, 0.6, 0.8]} />
        <meshStandardMaterial color="#cbd5e1" />
      </mesh>
      <mesh position={[1.2, 0, 0]}>
        <boxGeometry args={[1.5, 0.05, 0.6]} />
        <meshStandardMaterial color="#1d4ed8" />
      </mesh>
      <mesh position={[0.4, 0, 0]}>
        <boxGeometry args={[0.2, 0.02, 0.1]} />
        <meshStandardMaterial color="#94a3b8" />
      </mesh>
      <mesh position={[-1.2, 0, 0]}>
        <boxGeometry args={[1.5, 0.05, 0.6]} />
        <meshStandardMaterial color="#1d4ed8" />
      </mesh>
      <mesh position={[-0.4, 0, 0]}>
        <boxGeometry args={[0.2, 0.02, 0.1]} />
        <meshStandardMaterial color="#94a3b8" />
      </mesh>
      <mesh position={[0, -0.3, 0.4]} rotation={[-Math.PI/2, 0, 0]}>
        <sphereGeometry args={[0.4, 16, 16, 0, Math.PI * 2, 0, Math.PI / 2]} />
        <meshStandardMaterial color="#ffffff" side={THREE.DoubleSide} />
      </mesh>
      <mesh position={[0, -0.3, 0.6]} rotation={[Math.PI/2, 0, 0]}>
        <cylinderGeometry args={[0.02, 0.02, 0.4]} />
        <meshStandardMaterial color="#ef4444" />
      </mesh>
    </group>
  );
}

export function ConceptModelRenderer({ type, hovered }: { type: string, hovered: boolean }) {
  switch (type) {
    case 'atom': return <AtomModel hovered={hovered} />;
    case 'molecule': return <MoleculeModel hovered={hovered} />;
    case 'globe': return <GlobeModel hovered={hovered} />;
    case 'network': return <NetworkModel hovered={hovered} />;
    case 'dna': return <DnaModel hovered={hovered} />;
    case 'chip': return <ChipModel hovered={hovered} />;
    case 'quantum': return <QuantumModel hovered={hovered} />;
    case 'galaxy': return <GalaxyModel hovered={hovered} />;
    case 'crystal': return <CrystalModel hovered={hovered} />;
    case 'wave': return <WaveModel hovered={hovered} />;
    case 'gear': return <GearModel hovered={hovered} />;
    case 'satellite': return <SatelliteModel hovered={hovered} />;
    case 'brain': return <BrainModel hovered={hovered} />;
    case 'geometry':
    default:
      return <GeometryModel hovered={hovered} />;
  }
}

interface ConceptModelViewerProps {
  model: ConceptModel;
  keepMounted?: boolean;
}

export function ConceptModelViewer({ model, keepMounted = false }: ConceptModelViewerProps) {
  const [hovered, setHovered] = useState(false);
  const [isToggled, setIsToggled] = useState(false);
  const [inView, setInView] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (keepMounted) {
      setInView(true);
      return;
    }
    const observer = new IntersectionObserver(
      ([entry]) => {
        setInView(entry.isIntersecting);
      },
      { rootMargin: '200px' }
    );
    if (containerRef.current) observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, [keepMounted]);

  const active = hovered || isToggled;

  return (
    <div 
      ref={containerRef}
      className="w-full h-48 bg-black/20 rounded-xl relative overflow-hidden group cursor-pointer select-none"
      onPointerEnter={() => setHovered(true)}
      onPointerLeave={() => {
        setHovered(false);
        setIsToggled(false);
      }}
      onClick={() => setIsToggled(!isToggled)}
    >
      {inView && (
        <Canvas id={`model-canvas-${model.term.replace(/[^a-zA-Z0-9]/g, '')}`} dpr={1} frameloop={active ? "always" : "demand"} gl={{ preserveDrawingBuffer: true, antialias: false, powerPreference: "low-power" }} camera={{ position: [0, 0, 4], fov: 50 }}>
          <ambientLight intensity={0.5} />
          <pointLight position={[10, 10, 10]} intensity={1} />
          <pointLight position={[-10, -10, -10]} intensity={0.5} />
          
          <ConceptModelRenderer type={model.type} hovered={active} />
          
          <OrbitControls enableZoom={false} autoRotate={false} />
        </Canvas>
      )}
      <div className="absolute inset-0 pointer-events-none p-4 flex flex-col justify-end">
        <div className={`flex justify-between items-end opacity-0 transition-opacity duration-300 ${active ? "opacity-100" : "group-hover:opacity-100"}`}>
          <div className="text-xs font-bold bg-black/50 px-2 py-1 rounded backdrop-blur border border-white/10 uppercase tracking-wider self-end mb-2">{model.type}</div>
        </div>
        <div 
          className={`bg-black/80 p-3 rounded-lg backdrop-blur-md border border-cyan-500/30 text-xs text-white/90 shadow-lg transition-all duration-300 pointer-events-auto max-h-full overflow-y-auto ${active ? "translate-y-0 opacity-100" : "translate-y-4 opacity-0 group-hover:translate-y-0 group-hover:opacity-100"}`}
        >
          <div className="font-bold text-cyan-400 mb-1">{model.term}</div>
          <div className="leading-relaxed">{model.description}</div>
        </div>
      </div>
    </div>
  );
}
