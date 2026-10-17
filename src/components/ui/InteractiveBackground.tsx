import React, { useRef, useEffect, useMemo } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { cn } from '../../lib/utils';

gsap.registerPlugin(ScrollTrigger);

type ColorPalette = 'default' | 'monochrome' | 'neon';

const SceneSetup = ({ intensity = 1, colorPalette = 'default', theme = 'dark' }: { intensity: number, colorPalette: ColorPalette, theme?: 'dark' | 'light' }) => {
  const { camera, size } = useThree();
  const wrapperGroupRef = useRef<THREE.Group>(null);
  const innerGroupRef = useRef<THREE.Group>(null);
  const coreRef = useRef<THREE.Mesh>(null);
  const particlesRef = useRef<THREE.Points>(null);
  
  const ring1Ref = useRef<THREE.Mesh>(null);
  const ring2Ref = useRef<THREE.Mesh>(null);
  const ring3Ref = useRef<THREE.Mesh>(null);
  const floatGroupRef = useRef<THREE.Group>(null);

  const colors = useMemo(() => {
    if (theme === 'light') {
      switch(colorPalette) {
        case 'monochrome': return ['#475569', '#64748b', '#94a3b8'];
        case 'neon': return ['#65a30d', '#0891b2', '#c084fc'];
        case 'default':
        default: return ['#0891b2', '#db2777', '#7c3aed'];
      }
    }
    switch(colorPalette) {
      case 'monochrome': return ['#ffffff', '#aaaaaa', '#555555'];
      case 'neon': return ['#84cc16', '#06b6d4', '#e81cff'];
      case 'default':
      default: return ['#06b6d4', '#ec4899', '#a855f7'];
    }
  }, [colorPalette, theme]);

  // Fallback Network/Wireframe Geometry
  const particlesCount = 1200;
  const [positions, initialPositions, floatingGeoData] = useMemo(() => {
    const positions = new Float32Array(particlesCount * 3);
    const initialPositions = new Float32Array(particlesCount * 3);
    for(let i=0; i<particlesCount; i++) {
      const radius = 10 + Math.random() * 25;
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos((Math.random() * 2) - 1);
      
      const x = radius * Math.sin(phi) * Math.cos(theta);
      const y = radius * Math.sin(phi) * Math.sin(theta);
      const z = radius * Math.cos(phi);
      
      positions[i*3] = x;
      positions[i*3+1] = y;
      positions[i*3+2] = z;
      
      initialPositions[i*3] = x;
      initialPositions[i*3+1] = y;
      initialPositions[i*3+2] = z;
    }

    const floatingData = [];
    for (let i = 0; i < 60; i++) {
        floatingData.push({
            position: [
                (Math.random() - 0.5) * 80,
                (Math.random() - 0.5) * 80,
                (Math.random() - 0.5) * 40 - 15,
            ],
            rotation: [Math.random() * Math.PI, Math.random() * Math.PI, Math.random() * Math.PI],
            scale: Math.random() * 0.8 + 0.3,
            speed: Math.random() * 0.02 + 0.005,
        });
    }

    return [positions, initialPositions, floatingData];
  }, []);

  useEffect(() => {
    if (!wrapperGroupRef.current || !coreRef.current || !particlesRef.current) return;
    
    // Set initial camera
    camera.position.set(0, 0, 40);
    
    // Cleanup any exact overlapping scroll triggers during hot-reloads
    ScrollTrigger.getAll().forEach(t => t.kill());

    const tl = gsap.timeline({
      scrollTrigger: {
        trigger: "body",
        start: "top top",
        end: "bottom bottom",
        scrub: 1, // Smooth scrub
      }
    });

    /** 
     * SECTION 1 to 2 (Hero -> Features/Research)
     * The camera flies smoothly deep inside the 3D structure.
     */
    tl.to(camera.position, {
      z: 5,
      y: 2,
      ease: "power2.inOut",
    }, 0);
    
    tl.to(wrapperGroupRef.current.rotation, {
      x: Math.PI / 4,
      y: Math.PI / 2,
      ease: "power1.inOut"
    }, 0);

    if (ring1Ref.current && ring2Ref.current && ring3Ref.current) {
       tl.to([ring1Ref.current.scale, ring2Ref.current.scale, ring3Ref.current.scale], {
          x: 0.5, y: 0.5, z: 0.5,
          ease: "power2.inOut"
       }, 0);
    }

    /**
     * SECTION 2 to 3 (Features -> Data/Graphs)
     * 3D object rotates 180 degrees dynamically, changing scale and color.
     */
    tl.to(wrapperGroupRef.current.rotation, {
      y: Math.PI * 1.5,
      ease: "none"
    }, 1);
    
    tl.to(wrapperGroupRef.current.scale, {
      x: 1.8, y: 1.8, z: 1.8,
    }, 1);
    
    if (floatGroupRef.current) {
       tl.to(floatGroupRef.current.rotation, {
          y: Math.PI,
          z: Math.PI / 2,
          ease: "none"
       }, 1);
    }

    // Animate color towards Emerald/Cyan
    if (coreRef.current.material instanceof THREE.MeshStandardMaterial) {
       tl.to(coreRef.current.material.color, {
        r: colorPalette === 'monochrome' ? 0.8 : 0.06, 
        g: colorPalette === 'monochrome' ? 0.8 : 0.72, 
        b: colorPalette === 'monochrome' ? 0.8 : 0.5,
      }, 1);
       tl.to(coreRef.current.material.emissive, {
        r: colorPalette === 'monochrome' ? 0.8 : 0.06, 
        g: colorPalette === 'monochrome' ? 0.8 : 0.72, 
        b: colorPalette === 'monochrome' ? 0.8 : 0.5,
      }, 1);
    }
    
    /**
     * SECTION 3 to END (Data -> Export/LaTeX)
     * Camera pulls back to a sleek dramatic angle as elements symmetrically cluster.
     */
    tl.to(camera.position, {
      x: -15,
      y: -10,
      z: 25,
      ease: "power3.inOut"
    }, 2);
    
    tl.to(wrapperGroupRef.current.scale, {
      x: 0.7, y: 0.7, z: 0.7,
    }, 2);

    if (ring1Ref.current && ring2Ref.current && ring3Ref.current) {
       tl.to(ring1Ref.current.rotation, { x: Math.PI * 2, y: Math.PI }, 2);
       tl.to(ring2Ref.current.rotation, { x: -Math.PI, z: Math.PI * 2 }, 2);
       tl.to(ring3Ref.current.rotation, { y: Math.PI * 2, z: -Math.PI }, 2);
       tl.to([ring1Ref.current.scale, ring2Ref.current.scale, ring3Ref.current.scale], {
          x: 2.5, y: 2.5, z: 2.5,
          ease: "power2.inOut"
       }, 2);
    }
    
    // Symmetrical cluster effect mapped to a dynamic proxy object
    const clusterProxy = { value: 0 };
    tl.to(clusterProxy, {
      value: 1,
      ease: "power2.inOut",
      onUpdate: () => {
        if (!particlesRef.current) return;
        const positionsAttr = particlesRef.current.geometry.attributes.position;
        for(let i=0; i<particlesCount; i++) {
          const ix = initialPositions[i*3];
          const iy = initialPositions[i*3+1];
          const iz = initialPositions[i*3+2];
          
          // Clustered target shape: A tight inner ring or band
          const distance = Math.sqrt(ix*ix + iz*iz);
          const cx = (ix / distance) * 8;
          const cy = iy * 0.1; // flatten
          const cz = (iz / distance) * 8;
          
          positionsAttr.setXYZ(
            i, 
            THREE.MathUtils.lerp(ix, cx, clusterProxy.value),
            THREE.MathUtils.lerp(iy, cy, clusterProxy.value),
            THREE.MathUtils.lerp(iz, cz, clusterProxy.value)
          );
        }
        positionsAttr.needsUpdate = true;
      }
    }, 2);

    return () => {
      ScrollTrigger.getAll().forEach(t => t.kill());
    };
  }, [camera, initialPositions, colorPalette]); // Added colorPalette to dependencies to re-trigger GSAP on change

  // Handle Resize updates for the camera
  useEffect(() => {
    const handleResize = () => {
      if (camera instanceof THREE.PerspectiveCamera) {
         camera.aspect = window.innerWidth / window.innerHeight;
         camera.updateProjectionMatrix();
      }
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [camera]);

  // Uncoupled continuous gentle animation loop for ambient movement
  useFrame((state, delta) => {
    if (innerGroupRef.current) {
      innerGroupRef.current.rotation.x += delta * 0.05 * intensity;
      innerGroupRef.current.rotation.y += delta * 0.03 * intensity;
    }
    if (coreRef.current) {
      coreRef.current.rotation.y += delta * 0.2 * intensity;
      coreRef.current.rotation.z += delta * 0.1 * intensity;
    }
    
    if (ring1Ref.current) {
      ring1Ref.current.rotation.x += delta * 0.1 * intensity;
      ring1Ref.current.rotation.y += delta * 0.2 * intensity;
    }
    if (ring2Ref.current) {
      ring2Ref.current.rotation.x -= delta * 0.15 * intensity;
      ring2Ref.current.rotation.z += delta * 0.1 * intensity;
    }
    if (ring3Ref.current) {
      ring3Ref.current.rotation.y -= delta * 0.05 * intensity;
      ring3Ref.current.rotation.z -= delta * 0.08 * intensity;
    }

    if (floatGroupRef.current) {
      floatGroupRef.current.children.forEach(child => {
        child.rotation.x += child.userData.speed * intensity;
        child.rotation.y += child.userData.speed * intensity;
        child.position.y += Math.sin(state.clock.elapsedTime * 2 + child.position.x) * 0.005 * intensity;
      });
    }
  });

  return (
    <group ref={wrapperGroupRef}>
      <group ref={innerGroupRef}>
        {/* Central Core: High-tech geometric wireframe */}
        <mesh ref={coreRef}>
          <icosahedronGeometry args={[5, 1]} />
          <meshStandardMaterial 
            color={colors[0]} 
            emissive={colors[0]}
            emissiveIntensity={0.8 * intensity}
            wireframe={true} 
            transparent 
            opacity={0.3 * intensity} 
          />
        </mesh>
        
        {/* Outer Shell Structure */}
        <mesh>
          <sphereGeometry args={[18, 32, 32]} />
          <meshBasicMaterial 
            color="#1e1b4b" 
            wireframe={true} 
            transparent 
            opacity={0.05 * intensity} 
          />
        </mesh>

        {/* Floating Rings */}
        <mesh ref={ring1Ref}>
          <torusGeometry args={[8, 0.05, 16, 100]} />
          <meshStandardMaterial color={colors[1]} emissive={colors[1]} emissiveIntensity={1 * intensity} transparent opacity={0.6 * intensity} />
        </mesh>
        <mesh ref={ring2Ref}>
          <torusGeometry args={[12, 0.08, 16, 100]} />
          <meshStandardMaterial color={colors[0]} emissive={colors[0]} emissiveIntensity={1 * intensity} transparent opacity={0.4 * intensity} />
        </mesh>
        <mesh ref={ring3Ref}>
          <torusGeometry args={[16, 0.03, 16, 100]} />
          <meshStandardMaterial color={colors[2]} emissive={colors[2]} emissiveIntensity={1 * intensity} transparent opacity={0.5 * intensity} />
        </mesh>

        {/* Floating Geometric Elements */}
        {intensity > 0.1 && (
        <group ref={floatGroupRef}>
          {floatingGeoData.map((data, i) => (
            <mesh 
              key={i} 
              position={new THREE.Vector3(...data.position)} 
              rotation={new THREE.Euler(...data.rotation)}
              scale={data.scale}
              userData={{ speed: data.speed }}
            >
              {i % 3 === 0 ? <boxGeometry args={[1, 1, 1]} /> : i % 3 === 1 ? <octahedronGeometry args={[1, 0]} /> : <tetrahedronGeometry args={[1, 0]} />}
              <meshStandardMaterial 
                color={colors[i % 3]} 
                emissive={colors[i % 3]}
                emissiveIntensity={0.5 * intensity}
                wireframe={true}
                transparent
                opacity={0.4 * intensity}
              />
            </mesh>
          ))}
        </group>
        )}

        {/* Surrounding Network Data Points */}
        <points ref={particlesRef}>
          <bufferGeometry>
            <bufferAttribute 
              attach="attributes-position"
              count={particlesCount}
              array={positions}
              itemSize={3}
            />
          </bufferGeometry>
          <pointsMaterial 
            color={colors[2]}
            size={0.12 * Math.max(0.5, intensity)}
            transparent
            opacity={0.8 * Math.min(1, intensity * 1.5)}
            blending={THREE.AdditiveBlending}
          />
        </points>
      </group>
    </group>
  );
};

export const InteractiveBackground = ({ 
  activeSection, 
  intensity = 1,
  colorPalette = 'default',
  theme = 'dark'
}: { 
  activeSection: string,
  intensity?: number,
  colorPalette?: ColorPalette,
  theme?: 'dark' | 'light'
}) => {
  const isLight = theme === 'light';
  return (
    <div className="fixed inset-0 -z-10 w-full h-full pointer-events-none transition-opacity duration-1000" style={{ opacity: intensity > 0.1 ? 1 : 0.2 }}>
       {/* High-contrast ambient gradient overlay fitting a glassmorphism theme */}
       <div className={cn(
         "absolute inset-0 opacity-90 pointer-events-none transition-all duration-500",
         isLight 
           ? "bg-gradient-to-t from-slate-100 via-slate-50/60 to-slate-100" 
           : "bg-gradient-to-t from-slate-950 via-slate-900/60 to-slate-950"
       )} />
       
      <Canvas dpr={[1, 2]} performance={{ min: 0.5 }} camera={{ position: [0, 0, 40], fov: 60 }}>
        <color attach="background" args={[isLight ? '#f8fafc' : '#020617']} />
        <ambientLight intensity={isLight ? 0.8 * intensity : 0.5 * intensity} />
        <directionalLight position={[10, 10, 5]} intensity={2.5 * intensity} color={colorPalette === 'monochrome' ? (isLight ? "#475569" : "#aaaaaa") : (isLight ? "#0891b2" : "#06b6d4")} />
        <directionalLight position={[-10, -10, -5]} intensity={2.5 * intensity} color={colorPalette === 'monochrome' ? (isLight ? "#64748b" : "#ffffff") : (isLight ? "#7c3aed" : "#a855f7")} />
        <pointLight position={[0, 0, 0]} intensity={isLight ? 1 * intensity : 2 * intensity} color={isLight ? "#0ea5e9" : "#ffffff"} distance={20} />
        <SceneSetup intensity={intensity} colorPalette={colorPalette} theme={theme} />
      </Canvas>
    </div>
  );
};

