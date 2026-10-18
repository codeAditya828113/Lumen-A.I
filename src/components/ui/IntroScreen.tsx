import React, { useRef, useLayoutEffect, useState, useEffect } from 'react';
import { Canvas, useThree, useFrame } from '@react-three/fiber';
import { Stars, Float, Sphere, Box, Icosahedron, MeshDistortMaterial, Detailed, Preload } from '@react-three/drei';
import * as THREE from 'three';
import { Sparkles, Search, LinkIcon, ShieldAlert, ChevronDown, Rocket } from 'lucide-react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import Lenis from 'lenis';
import { cn } from '../../lib/utils';

gsap.registerPlugin(ScrollTrigger);

const MovingSpace = ({ isTransitioning, theme }: { isTransitioning: boolean; theme?: 'dark' | 'light' }) => {
  const group1Ref = useRef<THREE.Group>(null);
  const group2Ref = useRef<THREE.Group>(null);
  const prevScrollY = useRef(0);
  const starSpeedRef = useRef(2); // Base speed

  useFrame((state, delta) => {
    // Calculate scroll velocity
    const currentScrollY = typeof window !== 'undefined' ? window.scrollY : 0;
    const rawVelocity = delta > 0 ? Math.abs(currentScrollY - prevScrollY.current) / delta : 0;
    prevScrollY.current = currentScrollY;
    
    // Target speed increases dynamically with scroll velocity to simulate hyper-flight warp space travel
    const targetSpeed = isTransitioning ? 55 : (2 + Math.min(28, rawVelocity * 0.018));
    // Smoothly interpolate the speed for cinematic motion
    starSpeedRef.current += (targetSpeed - starSpeedRef.current) * 0.08;
    
    const speed = delta * starSpeedRef.current;
    
    if (group1Ref.current && group2Ref.current) {
      group1Ref.current.position.z += speed;
      group2Ref.current.position.z += speed;

      if (group1Ref.current.position.z > 25) {
        group1Ref.current.position.z = group2Ref.current.position.z - 50;
      }
      if (group2Ref.current.position.z > 25) {
        group2Ref.current.position.z = group1Ref.current.position.z - 50;
      }
    }
  });

  if (theme === 'light') return null;

  return (
    <>
      <group ref={group1Ref} position={[0, 0, -25]}>
        <Stars radius={30} depth={50} count={3000} factor={4} saturation={0} fade speed={1} />
      </group>
      <group ref={group2Ref} position={[0, 0, -75]}>
        <Stars radius={30} depth={50} count={3000} factor={4} saturation={0} fade speed={1} />
      </group>
    </>
  );
};

const SceneModels = ({ isTransitioning, theme }: { isTransitioning: boolean; theme?: 'dark' | 'light' }) => {
  const { camera } = useThree();
  const transitionSpeed = useRef(0);
  
  // Outer Wrappers for GSAP
  const coreWrapperRef = useRef<THREE.Group>(null);
  const networkWrapperRef = useRef<THREE.Group>(null);
  const synthesisWrapperRef = useRef<THREE.Group>(null);
  const gridWrapperRef = useRef<THREE.Group>(null);

  // Inner elements for continuous animation
  const coreRef = useRef<THREE.Group>(null);
  
  const networkPartsRef = useRef<THREE.Mesh[]>([]);
  const networkInnerRef = useRef<THREE.Group>(null);
  const networkRing1Ref = useRef<THREE.Mesh>(null);
  const networkRing2Ref = useRef<THREE.Mesh>(null);

  const synthesisInnerRef = useRef<THREE.Group>(null);
  const synthBarsRef = useRef<THREE.Mesh[]>([]);
  const synthRingRef = useRef<THREE.Mesh>(null);

  const gridInnerRef = useRef<THREE.Group>(null);
  const scanLineRef = useRef<THREE.Mesh>(null);
  const gridSecurityRef = useRef<THREE.Mesh>(null);

  const globalGroupRef = useRef<THREE.Group>(null);

  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    if (coreWrapperRef.current && networkWrapperRef.current && synthesisWrapperRef.current && gridWrapperRef.current) {
      setIsReady(true);
    }
  });

  // Initialize camera
  useLayoutEffect(() => {
    camera.position.set(0, 0, 8);
    camera.lookAt(0, 0, 0);
  }, [camera]);

  useLayoutEffect(() => {
    if (!isReady) return;
    if (!coreWrapperRef.current || !networkWrapperRef.current || !synthesisWrapperRef.current || !gridWrapperRef.current) return;

    const setGroupOpacity = (group: THREE.Group, opacity: number) => {
      group.traverse((child) => {
        const mesh = child as any;
        if (mesh.isMesh && mesh.material) {
          const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
          materials.forEach((mat: any) => {
            mat.transparent = true;
            let maxOpacity = 1.0;
            if (mat.wireframe) {
              if (mesh.geometry?.type === "SphereGeometry" && mesh.geometry?.parameters?.radius > 3) {
                maxOpacity = 0.05;
              } else {
                maxOpacity = 0.3;
              }
            }
            mat.opacity = opacity * maxOpacity;
          });
        }
      });
    };

    const ctx = gsap.context(() => {
      // Create master timeline tied to the whole scroll container
      const tl = gsap.timeline({
        scrollTrigger: {
          trigger: "#intro-scroll-container",
          start: "top top",
          end: "bottom bottom",
          scrub: 1,
        }
      });

      // Unified opacity tracking state for cross-fading
      const opacities = {
        core: 1,
        network: 0,
        synthesis: 0,
        grid: 0
      };

      // Set initial transparent states on 3D groups
      setGroupOpacity(coreWrapperRef.current, 1);
      coreWrapperRef.current.visible = true;

      setGroupOpacity(networkWrapperRef.current, 0);
      networkWrapperRef.current.visible = false;

      setGroupOpacity(synthesisWrapperRef.current, 0);
      synthesisWrapperRef.current.visible = false;

      setGroupOpacity(gridWrapperRef.current, 0);
      gridWrapperRef.current.visible = false;

      // 0% -> 25% (Hero to Feature 1: Push into core, core expands/explodes into network)
      tl.to(camera.position, { z: 5.5, ease: "power2.inOut" }, 0)
        // Core scales up dynamically to 4.5, creating a beautiful outward expansion/explosion effect
        .to(coreWrapperRef.current.scale, { x: 4.5, y: 4.5, z: 4.5, ease: "power2.in" }, 0)
        .to(coreWrapperRef.current.rotation, { y: Math.PI / 2, ease: "none" }, 0)
        // Smoothly fade out core wrapper
        .to(opacities, {
          core: 0,
          ease: "power2.out",
          onUpdate: () => {
            if (coreWrapperRef.current) {
              setGroupOpacity(coreWrapperRef.current, opacities.core);
              coreWrapperRef.current.visible = opacities.core > 0.01;
            }
          }
        }, 0.05) // Fades out completely by 0.25

        // Smoothly expand/burst the network elements outward from a tiny center point (explosion source)
        .add(() => {
          if (networkWrapperRef.current) networkWrapperRef.current.visible = true;
        }, 0.08)
        .fromTo(networkWrapperRef.current.scale, { x: 0.1, y: 0.1, z: 0.1 }, { x: 1.0, y: 1.0, z: 1.0, ease: "power2.out" }, 0.08)
        // Fade in the network nodes in perfect overlap sync with the core fading out
        .to(opacities, {
          network: 1,
          ease: "power2.out",
          onUpdate: () => {
            if (networkWrapperRef.current) {
              setGroupOpacity(networkWrapperRef.current, opacities.network);
              networkWrapperRef.current.visible = opacities.network > 0.01;
            }
          }
        }, 0.08) // Fades in completely by 0.25

      // 25% -> 50% (Feature 1 to Feature 2: network fades out, synthesis spectrogram fades in)
      tl.to(opacities, {
          network: 0,
          ease: "power2.inOut",
          onUpdate: () => {
            if (networkWrapperRef.current) {
              setGroupOpacity(networkWrapperRef.current, opacities.network);
              networkWrapperRef.current.visible = opacities.network > 0.01;
            }
          }
        }, 0.25)
        .add(() => {
          if (synthesisWrapperRef.current) synthesisWrapperRef.current.visible = true;
        }, 0.25)
        .fromTo(synthesisWrapperRef.current.rotation, { x: -Math.PI / 4, y: Math.PI / 4 }, { x: 0, y: 0, ease: "power2.out" }, 0.25)
        .fromTo(synthesisWrapperRef.current.scale, { x: 0.1, y: 0.1, z: 0.1 }, { x: 1.0, y: 1.0, z: 1.0, ease: "power2.out" }, 0.25)
        .to(opacities, {
          synthesis: 1,
          ease: "power2.inOut",
          onUpdate: () => {
            if (synthesisWrapperRef.current) {
              setGroupOpacity(synthesisWrapperRef.current, opacities.synthesis);
              synthesisWrapperRef.current.visible = opacities.synthesis > 0.01;
            }
          }
        }, 0.25)

      // 50% -> 75% (Feature 2 to Feature 3: synthesis shapes morph/dissolve into dashboard grid)
      tl.to(opacities, {
          synthesis: 0,
          ease: "power2.inOut",
          onUpdate: () => {
            if (synthesisWrapperRef.current) {
              setGroupOpacity(synthesisWrapperRef.current, opacities.synthesis);
              synthesisWrapperRef.current.visible = opacities.synthesis > 0.01;
            }
          }
        }, 0.5)

        // Bring in and fade in grid seamlessly
        .add(() => {
          if (gridWrapperRef.current) gridWrapperRef.current.visible = true;
        }, 0.5)
        .fromTo(gridWrapperRef.current.rotation, { x: Math.PI / 4, y: -Math.PI / 4 }, { x: 0, y: 0, ease: "power2.out" }, 0.5)
        .fromTo(gridWrapperRef.current.scale, { x: 0.1, y: 0.1, z: 0.1 }, { x: 1.0, y: 1.0, z: 1.0, ease: "power2.out" }, 0.5)
        .to(opacities, {
          grid: 1,
          ease: "power2.inOut",
          onUpdate: () => {
            if (gridWrapperRef.current) {
              setGroupOpacity(gridWrapperRef.current, opacities.grid);
              gridWrapperRef.current.visible = opacities.grid > 0.01;
            }
          }
        }, 0.5) // Fades in completely by 0.65

      // 75% -> 100% (Feature 3 to Footer: models fade into background)
      tl.to(camera.position, { z: 10, y: 0, ease: "power2.inOut" }, 0.75)
        .to(gridWrapperRef.current.rotation, { x: Math.PI / 8, y: Math.PI / 4, ease: "power1.inOut" }, 0.75)
        .to(opacities, {
          grid: 0,
          ease: "power2.inOut",
          onUpdate: () => {
            if (gridWrapperRef.current) {
              setGroupOpacity(gridWrapperRef.current, opacities.grid);
              gridWrapperRef.current.visible = opacities.grid > 0.01;
            }
          }
        }, 0.75);

      // Set initial state for the scrolling feature card contents
      gsap.set([".feature-1-content", ".feature-2-content", ".feature-3-content"], { 
        opacity: 0, 
        y: 40 
      });

      // Synchronized Feature 1 Text Fade In/Out
      tl.to(".feature-1-content", {
        opacity: 1,
        y: 0,
        ease: "power2.out",
        duration: 0.08
      }, 0.12)
      .to(".feature-1-content", {
        opacity: 0,
        y: -40,
        ease: "power2.in",
        duration: 0.08
      }, 0.34)

      // Synchronized Feature 2 Text Fade In/Out
      .to(".feature-2-content", {
        opacity: 1,
        y: 0,
        ease: "power2.out",
        duration: 0.08
      }, 0.38)
      .to(".feature-2-content", {
        opacity: 0,
        y: -40,
        ease: "power2.in",
        duration: 0.08
      }, 0.58)

      // Synchronized Feature 3 Text Fade In/Out
      .to(".feature-3-content", {
        opacity: 1,
        y: 0,
        ease: "power2.out",
        duration: 0.08
      }, 0.62)
      .to(".feature-3-content", {
        opacity: 0,
        y: -40,
        ease: "power2.in",
        duration: 0.08
      }, 0.82);

    });

    return () => ctx.revert();
  }, [camera, isReady]);

  useFrame((state, delta) => {
    if (coreRef.current && coreWrapperRef.current?.visible) {
      coreRef.current.rotation.x += delta * 0.1;
      coreRef.current.rotation.z += delta * 0.15;
    }
    if (networkInnerRef.current && networkWrapperRef.current?.visible) {
      networkInnerRef.current.rotation.y += delta * 0.05;
      networkPartsRef.current.forEach((part, i) => {
        if (part) {
          part.rotation.x += delta * (0.1 + i * 0.05);
          part.rotation.y += delta * (0.2 + i * 0.02);
        }
      });
      if (networkRing1Ref.current) {
        networkRing1Ref.current.rotation.z += delta * 0.12;
      }
      if (networkRing2Ref.current) {
        networkRing2Ref.current.rotation.z -= delta * 0.08;
      }
    }
    if (synthesisInnerRef.current && synthesisWrapperRef.current?.visible) {
      const t = state.clock.getElapsedTime();
      synthesisInnerRef.current.rotation.y += delta * 0.2;
      
      synthBarsRef.current.forEach((bar, i) => {
        if (bar) {
          const heightFactor = 0.3 + Math.sin(t * 4.5 + i * 0.8) * 0.6 + Math.cos(t * 2.2 - i * 0.5) * 0.2;
          bar.scale.y = Math.max(0.1, heightFactor);
          bar.position.y = (bar.scale.y * 1.2) / 2 - 0.6;
        }
      });

      if (synthRingRef.current) {
        synthRingRef.current.rotation.z -= delta * 0.4;
      }
    }
    if (gridInnerRef.current && gridWrapperRef.current?.visible) {
      gridInnerRef.current.rotation.z += delta * 0.02;
    }
    if (scanLineRef.current && gridWrapperRef.current?.visible) {
      const t = state.clock.getElapsedTime();
      scanLineRef.current.position.y = Math.sin(t * 2.5) * 1.6;
    }
    if (gridSecurityRef.current && gridWrapperRef.current?.visible) {
      gridSecurityRef.current.rotation.z -= delta * 0.5;
    }

    if (globalGroupRef.current && !isTransitioning) {
      // Slow drifting movement effect
      const t = state.clock.getElapsedTime();
      globalGroupRef.current.position.y = Math.sin(t * 0.5) * 0.2;
      globalGroupRef.current.rotation.x = Math.sin(t * 0.3) * 0.05;
      globalGroupRef.current.rotation.y = Math.cos(t * 0.2) * 0.05;
    }

    if (isTransitioning) {
      transitionSpeed.current += delta * 15;
      camera.position.z -= transitionSpeed.current * delta * 20;
      if (camera instanceof THREE.PerspectiveCamera) {
          camera.fov = Math.min(160, camera.fov + delta * 80);
          camera.updateProjectionMatrix();
      }
    }
  });

  return (
    <group ref={globalGroupRef}>
      {/* 0%: Glowing Core */}
      <group ref={coreWrapperRef}>
        <group ref={coreRef}>
          <Float speed={2} rotationIntensity={1} floatIntensity={1}>
            <Detailed distances={[0, 10, 20]}>
              <mesh>
                <sphereGeometry args={[1.5, 64, 64]} />
                <MeshDistortMaterial color={theme === 'light' ? "#0891b2" : "#06b6d4"} emissive={theme === 'light' ? "#22d3ee" : "#06b6d4"} emissiveIntensity={theme === 'light' ? 0.3 : 0.5} distort={0.4} speed={2} wireframe />
              </mesh>
              <mesh>
                <sphereGeometry args={[1.5, 32, 32]} />
                <MeshDistortMaterial color={theme === 'light' ? "#0891b2" : "#06b6d4"} emissive={theme === 'light' ? "#22d3ee" : "#06b6d4"} emissiveIntensity={theme === 'light' ? 0.3 : 0.5} distort={0.4} speed={2} wireframe />
              </mesh>
              <mesh>
                <sphereGeometry args={[1.5, 16, 16]} />
                <MeshDistortMaterial color={theme === 'light' ? "#0891b2" : "#06b6d4"} emissive={theme === 'light' ? "#22d3ee" : "#06b6d4"} emissiveIntensity={theme === 'light' ? 0.3 : 0.5} distort={0.4} speed={2} wireframe />
              </mesh>
            </Detailed>
            <Detailed distances={[0, 10, 20]}>
              <mesh>
                <sphereGeometry args={[1, 32, 32]} />
                <meshPhysicalMaterial color={theme === 'light' ? "#7e22ce" : "#a855f7"} emissive={theme === 'light' ? "#a855f7" : "#a855f7"} emissiveIntensity={theme === 'light' ? 0.4 : 0.8} transparent opacity={0.8} />
              </mesh>
              <mesh>
                <sphereGeometry args={[1, 16, 16]} />
                <meshPhysicalMaterial color={theme === 'light' ? "#7e22ce" : "#a855f7"} emissive={theme === 'light' ? "#a855f7" : "#a855f7"} emissiveIntensity={theme === 'light' ? 0.4 : 0.8} transparent opacity={0.8} />
              </mesh>
              <mesh>
                <sphereGeometry args={[1, 8, 8]} />
                <meshPhysicalMaterial color={theme === 'light' ? "#7e22ce" : "#a855f7"} emissive={theme === 'light' ? "#a855f7" : "#a855f7"} emissiveIntensity={theme === 'light' ? 0.4 : 0.8} transparent opacity={0.8} />
              </mesh>
            </Detailed>
          </Float>
        </group>
      </group>

      {/* 25%-50%: Network / Nodes (Deep Research Knowledge Graph - Positioned on Right to offset left card) */}
      <group ref={networkWrapperRef} position={[2.0, 0.2, 0]}>
        <group ref={networkInnerRef}>
          {[...Array(15)].map((_, i) => (
            <mesh 
              key={i} 
              position={[
                (Math.random() - 0.5) * 4,
                (Math.random() - 0.5) * 4,
                (Math.random() - 0.5) * 4
              ]}
              ref={(el) => { if (el) networkPartsRef.current[i] = el; }}
            >
              <Icosahedron args={[0.2 + Math.random() * 0.2, 0]}>
                <meshStandardMaterial color={theme === 'light' ? (i % 2 === 0 ? "#059669" : "#0891b2") : (i % 2 === 0 ? "#10b981" : "#06b6d4")} emissive={theme === 'light' ? (i % 2 === 0 ? "#059669" : "#0891b2") : (i % 2 === 0 ? "#10b981" : "#06b6d4")} emissiveIntensity={0.5} wireframe={i % 3 === 0} />
              </Icosahedron>
            </mesh>
          ))}
          {/* Orbiting ring 1 representing data paths */}
          <mesh rotation={[Math.PI / 3, Math.PI / 6, 0]} ref={networkRing1Ref}>
            <torusGeometry args={[2.5, 0.025, 8, 64]} />
            <meshStandardMaterial 
              color={theme === 'light' ? "#a855f7" : "#c084fc"} 
              emissive={theme === 'light' ? "#a855f7" : "#c084fc"} 
              emissiveIntensity={0.5} 
              transparent 
              opacity={0.4} 
            />
          </mesh>
          {/* Orbiting ring 2 tilted opposite */}
          <mesh rotation={[-Math.PI / 4, -Math.PI / 3, 0]} ref={networkRing2Ref}>
            <torusGeometry args={[2.0, 0.015, 8, 64]} />
            <meshStandardMaterial 
              color={theme === 'light' ? "#0891b2" : "#22d3ee"} 
              emissive={theme === 'light' ? "#0891b2" : "#22d3ee"} 
              emissiveIntensity={0.5} 
              transparent 
              opacity={0.4} 
            />
          </mesh>
          {/* Connecting lines via a large wireframe sphere */}
          <Detailed distances={[0, 10, 20]}>
            <mesh>
              <sphereGeometry args={[3.2, 16, 16]} />
              <meshBasicMaterial color={theme === 'light' ? "#64748b" : "#ffffff"} transparent opacity={theme === 'light' ? 0.15 : 0.05} wireframe />
            </mesh>
            <mesh>
              <sphereGeometry args={[3.2, 8, 8]} />
              <meshBasicMaterial color={theme === 'light' ? "#64748b" : "#ffffff"} transparent opacity={theme === 'light' ? 0.15 : 0.05} wireframe />
            </mesh>
            <mesh>
              <sphereGeometry args={[3.2, 4, 4]} />
              <meshBasicMaterial color={theme === 'light' ? "#64748b" : "#ffffff"} transparent opacity={theme === 'light' ? 0.15 : 0.05} wireframe />
            </mesh>
          </Detailed>
        </group>
      </group>

      {/* 25%-50%: Media Synthesis & API Spectrogram (Positioned on Left to offset right card) */}
      <group ref={synthesisWrapperRef} position={[-2.0, 0.2, 0]}>
        <group ref={synthesisInnerRef}>
          {/* Circular audio visualizer / vector spectrogram bars */}
          {[...Array(12)].map((_, i) => {
            const angle = (i / 12) * Math.PI * 2;
            const radius = 1.6;
            const x = Math.cos(angle) * radius;
            const z = Math.sin(angle) * radius;
            return (
              <mesh 
                key={i} 
                position={[x, 0, z]}
                ref={(el) => { if (el) synthBarsRef.current[i] = el; }}
              >
                <boxGeometry args={[0.15, 1.2, 0.15]} />
                <meshStandardMaterial 
                  color={theme === 'light' ? "#059669" : "#10b981"} 
                  emissive={theme === 'light' ? "#059669" : "#10b981"} 
                  emissiveIntensity={theme === 'light' ? 0.3 : 0.6} 
                  transparent 
                  opacity={0.8} 
                />
              </mesh>
            );
          })}
          {/* A glowing API center sphere that acts as the synthesis hub */}
          <mesh>
            <sphereGeometry args={[0.5, 32, 32]} />
            <meshPhysicalMaterial 
              color={theme === 'light' ? "#0d9488" : "#14b8a6"} 
              emissive={theme === 'light' ? "#0d9488" : "#14b8a6"} 
              emissiveIntensity={0.8}
              transparent 
              opacity={0.9} 
              roughness={0.1}
              metalness={0.9}
            />
          </mesh>
          {/* Outer rotating vector rings representing data streams */}
          <mesh rotation={[Math.PI / 2, 0, 0]} ref={synthRingRef}>
            <torusGeometry args={[2.0, 0.05, 8, 48]} />
            <meshStandardMaterial 
              color={theme === 'light' ? "#0891b2" : "#06b6d4"} 
              emissive={theme === 'light' ? "#0891b2" : "#06b6d4"} 
              emissiveIntensity={0.8} 
              transparent 
              opacity={0.7} 
            />
          </mesh>
        </group>
      </group>

      {/* 50%-100%: Dashboard Grid (Integrity Guard Dashboard with Laser Scan - Positioned on Right to offset left card) */}
      <group ref={gridWrapperRef} position={[2.0, 0.1, 0]}>
        <group ref={gridInnerRef}>
          {/* Holographic main panel with translucent cyber material */}
          <Box args={[4.5, 3.0, 0.05]} position={[0, 0, 0]}>
            <meshPhysicalMaterial 
              color={theme === 'light' ? "#f1f5f9" : "#09090b"} 
              transparent 
              opacity={0.8} 
              metalness={0.9} 
              roughness={0.15} 
              clearcoat={1.0}
              clearcoatRoughness={0.1}
            />
          </Box>
          {/* Security scanning glowing outer border frame */}
          <Box args={[4.6, 3.1, 0.06]} position={[0, 0, 0]}>
            <meshBasicMaterial 
              color={theme === 'light' ? "#ef4444" : "#f43f5e"} 
              wireframe 
              transparent 
              opacity={0.25} 
            />
          </Box>
          {/* Glowing laser scanning bar slicing up and down across the dashboard */}
          <Box args={[4.7, 0.04, 0.1]} position={[0, 0, 0.05]} ref={scanLineRef}>
            <meshBasicMaterial 
              color={theme === 'light' ? "#dc2626" : "#f43f5e"} 
              transparent 
              opacity={0.9} 
            />
          </Box>
          {/* Holographic scanning shield seal (lock representing Integrity) */}
          <mesh position={[0, 0, 0.12]} ref={gridSecurityRef}>
            <torusGeometry args={[0.5, 0.03, 8, 32]} />
            <meshStandardMaterial 
              color={theme === 'light' ? "#dc2626" : "#f43f5e"} 
              emissive={theme === 'light' ? "#dc2626" : "#f43f5e"} 
              emissiveIntensity={0.8} 
              transparent 
              opacity={0.7} 
            />
          </mesh>
          {/* Abstract UI Elements */}
          <Box args={[1.0, 2.0, 0.1]} position={[-1.4, 0, 0.04]}>
             <meshStandardMaterial color="#dc2626" emissive="#dc2626" emissiveIntensity={theme === 'light' ? 0.1 : 0.3} transparent opacity={0.65} />
          </Box>
          <Box args={[2.4, 0.9, 0.1]} position={[0.6, 0.5, 0.04]}>
             <meshStandardMaterial color="#2563eb" emissive="#2563eb" emissiveIntensity={theme === 'light' ? 0.1 : 0.3} transparent opacity={0.65} />
          </Box>
          <Box args={[2.4, 0.9, 0.1]} position={[0.6, -0.5, 0.04]}>
             <meshStandardMaterial color="#7c3aed" emissive="#7c3aed" emissiveIntensity={theme === 'light' ? 0.1 : 0.3} transparent opacity={0.65} />
          </Box>
        </group>
      </group>
    </group>
  );
};

export const IntroScreen = ({ onStart, theme = 'dark' }: { onStart: () => void; theme?: 'dark' | 'light' }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [isTransitioning, setIsTransitioning] = useState(false);
  
  const handleStart = () => {
    setIsTransitioning(true);
    setTimeout(() => {
      onStart();
    }, 1200); // Wait for the transition effect
  };

  useEffect(() => {
    const lenis = new Lenis({
      syncTouch: true,
      touchMultiplier: 2,
    });
    
    // Connect GSAP ScrollTrigger to lenis
    lenis.on('scroll', ScrollTrigger.update);
    const ticker = (time: number) => {
      lenis.raf(time * 1000);
    };
    gsap.ticker.add(ticker);
    gsap.ticker.lagSmoothing(0);
    
    return () => {
      gsap.ticker.remove(ticker);
      lenis.destroy();
    };
  }, []);
  


  return (
    <div ref={containerRef} id="intro-scroll-container" className={cn("relative w-full transition-colors duration-500 selection:bg-cyan-500/30 font-sans", 
      theme === 'light' ? "bg-slate-50 text-slate-900" : "bg-black text-white"
    )}>
      
      {/* Fixed 3D Background */}
      <div className="fixed inset-0 z-0 pointer-events-none">
        <div className={cn("absolute inset-0 pointer-events-none transition-all duration-500", 
          theme === 'light' 
            ? "bg-gradient-to-t from-cyan-100/30 via-transparent to-purple-100/30" 
            : "bg-gradient-to-t from-cyan-900/10 via-transparent to-purple-900/10"
        )} />
        <Canvas dpr={[1, 1.5]} performance={{ min: 0.5 }}>
          <color attach="background" args={[theme === 'light' ? '#f8fafc' : '#000000']} />
          <ambientLight intensity={theme === 'light' ? 0.8 : 0.5} />
          <pointLight position={[10, 10, 10]} intensity={1.5} color={theme === 'light' ? '#0891b2' : '#06b6d4'} />
          <pointLight position={[-10, -10, -10]} intensity={1} color={theme === 'light' ? '#7e22ce' : '#8b5cf6'} />
          <MovingSpace isTransitioning={isTransitioning} theme={theme} />
          <SceneModels isTransitioning={isTransitioning} theme={theme} />
          <Preload all />
        </Canvas>
      </div>

      {/* Scrollable HTML Content */}
      <div className="relative z-10 w-full">
        
        {/* Premium Minimal Navigation Header */}
        <header className="fixed top-0 left-0 right-0 z-50 px-6 py-4 flex items-center justify-between pointer-events-auto transition-all duration-300">
          <div className="flex items-center gap-2.5">
            <div className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse" />
            <span className={cn("font-mono text-[10px] tracking-[0.25em] uppercase font-semibold", 
              theme === 'light' ? "text-slate-800" : "text-slate-200"
            )}>
              Lumen // Research Engine
            </span>
          </div>
          <button 
            onClick={handleStart}
            className={cn("px-3.5 py-1.5 rounded-full text-[9px] font-mono tracking-wider uppercase transition-all duration-300 border cursor-pointer active:scale-95", 
              theme === 'light' 
                ? "bg-slate-950 text-white border-slate-950 hover:bg-slate-800" 
                : "bg-white/5 text-purple-300 border-white/10 hover:border-purple-500/40 hover:bg-purple-950/40 hover:text-white"
            )}
          >
            Skip Intro
          </button>
        </header>
        
        {/* Section 0: Hero */}
        <section id="hero" className="h-[120vh] flex flex-col items-center justify-center text-center px-4 relative">
          <h1 className={cn("text-6xl md:text-8xl font-display font-black tracking-[0.2em] uppercase mb-4", 
            theme === 'light' 
              ? "text-slate-950 drop-shadow-[0_0_35px_rgba(0,0,0,0.05)]" 
              : "text-white drop-shadow-[0_0_30px_rgba(255,255,255,0.3)]"
          )}>
            Lumen <span className="font-bold text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-purple-500 drop-shadow-[0_0_20px_rgba(168,85,247,0.5)]">AI</span>
          </h1>
          <p className={cn("font-mono tracking-widest text-sm md:text-base uppercase mb-16", 
            theme === 'light' ? "text-cyan-800/80" : "text-cyan-100/60"
          )}>
            Autonomous Research Intelligence
          </p>
          <div className={cn("absolute bottom-32 animate-bounce flex flex-col items-center gap-2 font-mono text-xs uppercase tracking-widest", 
            theme === 'light' ? "text-slate-400/80" : "text-white/30"
          )}>
            <p>Scroll to Explore</p>
            <ChevronDown className="w-4 h-4" />
          </div>
        </section>

        {/* Section 1: Autonomous Processing */}
        <section id="feature-1" className="h-[150vh] flex items-center px-8 md:px-24 pointer-events-none">
          <div className={cn("feature-1-content max-w-xl p-8 md:p-12 backdrop-blur-2xl border pointer-events-auto transition-all duration-500 rounded-[2rem]", 
            theme === 'light' 
              ? "bg-white/40 border-cyan-500/10 shadow-[0_24px_64px_rgba(6,182,212,0.04)] text-slate-800" 
              : "bg-gradient-to-br from-cyan-950/25 via-black/40 to-black/80 border-cyan-500/15 shadow-[0_0_60px_rgba(6,182,212,0.08)] text-white"
          )}>
            <div className={cn("p-4 rounded-2xl w-fit mb-8 shadow-sm", 
              theme === 'light' ? "bg-cyan-500/10 text-cyan-600" : "bg-cyan-500/20 text-cyan-400 ring-1 ring-cyan-500/30"
            )}>
              <Search className="w-8 h-8" />
            </div>
            <h2 className="text-3.5xl md:text-5xl font-display font-black uppercase tracking-wider mb-6 leading-tight">
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-teal-400 drop-shadow-[0_0_15px_rgba(34,211,238,0.2)]">
                Deep Research
              </span>
            </h2>
            <p className={cn("font-mono text-sm md:text-base leading-relaxed tracking-wide", 
              theme === 'light' ? "text-slate-600" : "text-slate-300/90"
            )}>
              Harness autonomous agents that traverse the web to gather, filter, and structure raw information. 
              Watch as Lumen isolates key insights and builds a multi-dimensional knowledge graph of your topic in real-time.
            </p>
          </div>
        </section>

        {/* Section 2: API Integration / Media Synthesis */}
        <section id="feature-2" className="h-[150vh] flex items-center justify-end px-8 md:px-24 pointer-events-none">
          <div className={cn("feature-2-content max-w-xl p-8 md:p-12 backdrop-blur-2xl border pointer-events-auto transition-all duration-500 rounded-[2rem]", 
            theme === 'light' 
              ? "bg-white/40 border-emerald-500/10 shadow-[0_24px_64px_rgba(16,185,129,0.04)] text-slate-800" 
              : "bg-gradient-to-br from-emerald-950/25 via-black/40 to-black/80 border-emerald-500/15 shadow-[0_0_60px_rgba(16,185,129,0.08)] text-white"
          )}>
            <div className={cn("p-4 rounded-2xl w-fit mb-8 shadow-sm", 
              theme === 'light' ? "bg-emerald-500/10 text-emerald-600" : "bg-emerald-500/20 text-emerald-400 ring-1 ring-emerald-500/30"
            )}>
              <LinkIcon className="w-8 h-8" />
            </div>
            <h2 className="text-3.5xl md:text-5xl font-display font-black uppercase tracking-wider mb-6 leading-tight">
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 to-cyan-400 drop-shadow-[0_0_15px_rgba(52,211,153,0.2)]">
                Media Synthesis & API
              </span>
            </h2>
            <p className={cn("font-mono text-sm md:text-base leading-relaxed tracking-wide", 
              theme === 'light' ? "text-slate-600" : "text-slate-300/90"
            )}>
              Process dense media vectors effortlessly. Embed and interconnect with external APIs to decode, transcribe, 
              and synthesize hours of content into concise, actionable intelligence.
            </p>
          </div>
        </section>

        {/* Section 3: Dashboard Output */}
        <section id="feature-3" className="h-[150vh] flex items-center px-8 md:px-24 pointer-events-none">
          <div className={cn("feature-3-content max-w-xl p-8 md:p-12 backdrop-blur-2xl border pointer-events-auto transition-all duration-500 rounded-[2rem]", 
            theme === 'light' 
              ? "bg-white/40 border-rose-500/10 shadow-[0_24px_64px_rgba(244,63,94,0.04)] text-slate-800" 
              : "bg-gradient-to-br from-rose-950/25 via-black/40 to-black/80 border-rose-500/15 shadow-[0_0_60px_rgba(244,63,94,0.08)] text-white"
          )}>
            <div className={cn("p-4 rounded-2xl w-fit mb-8 shadow-sm", 
              theme === 'light' ? "bg-rose-500/10 text-rose-600" : "bg-rose-500/20 text-rose-400 ring-1 ring-rose-500/30"
            )}>
              <ShieldAlert className="w-8 h-8" />
            </div>
            <h2 className="text-3.5xl md:text-5xl font-display font-black uppercase tracking-wider mb-6 leading-tight">
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-rose-400 to-purple-400 drop-shadow-[0_0_15px_rgba(244,63,94,0.2)]">
                Integrity Guard UI
              </span>
            </h2>
            <p className={cn("font-mono text-sm md:text-base leading-relaxed tracking-wide", 
              theme === 'light' ? "text-slate-600" : "text-slate-300/90"
            )}>
              Everything flows into a centralized, persistent dashboard. Ensure absolute authenticity with advanced semantic scanners 
              that validate content originality and detect neural-generated patterns directly in your UI.
            </p>
          </div>
        </section>

        {/* Section 4: Footer CTA */}
        <section id="footer" className="min-h-screen flex items-center justify-center text-center px-4">
          <div className={cn("max-w-md backdrop-blur-3xl border rounded-[2.5rem] p-8 md:p-10 flex flex-col items-center transition-all duration-500", 
            theme === 'light' 
              ? "bg-white/40 border-slate-200/20 shadow-[0_12px_40px_rgba(139,92,246,0.03)]" 
              : "bg-black/10 border-white/5 shadow-[0_0_50px_rgba(139,92,246,0.04)]"
          )}>
            <div className="p-3.5 bg-purple-500/10 text-purple-400 rounded-2xl w-fit mb-6 ring-1 ring-purple-500/20">
              <Rocket className="w-6 h-6 animate-pulse" />
            </div>
            <h2 className={cn("text-2xl md:text-3xl font-display font-black uppercase tracking-[0.15em] mb-3", 
              theme === 'light' ? "text-slate-900" : "text-white"
            )}>Ready to Initialize?</h2>
            <p className={cn("font-mono text-xs md:text-sm leading-relaxed mb-8 max-w-xs", 
              theme === 'light' ? "text-slate-600" : "text-white/50"
            )}>
              The research node is active. Proceed to the main dashboard to begin your first autonomous synthesis sequence.
            </p>
            
            <button
              onClick={handleStart}
              className={cn("group relative px-8 py-3.5 border rounded-full transition-all duration-500 overflow-hidden flex items-center justify-center gap-3 backdrop-blur-md w-full sm:w-auto shadow-md", 
                theme === 'light' 
                  ? "bg-slate-950 hover:bg-slate-900 border-slate-950 text-white cursor-pointer active:scale-95" 
                  : "bg-white/5 hover:bg-white/10 border-white/10 hover:border-cyan-500/40 text-white cursor-pointer active:scale-95"
              )}
            >
              <div className="absolute inset-0 bg-gradient-to-r from-cyan-500/10 to-purple-500/10 opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
              <Sparkles className="w-4 h-4 text-cyan-400 group-hover:animate-pulse relative z-10" />
              <span className="font-display font-bold uppercase tracking-[0.15em] text-xs relative z-10">Launch Lumen AI</span>
            </button>

            <div className="mt-8 text-center">
              <a
                href="https://github.com/codeAditya828113/Lumen-A.I"
                target="_blank"
                rel="noopener noreferrer"
                className="text-[11px] font-mono text-slate-500 hover:text-cyan-400 transition-colors inline-flex items-center gap-1.5 cursor-pointer"
              >
                Built by <span className="font-semibold text-slate-400 hover:text-cyan-300">Aditya Kumar</span>
              </a>
            </div>
          </div>
        </section>
        
        {isTransitioning && (
          <div 
            className={cn("fixed inset-0 z-50 pointer-events-none transition-opacity duration-300 ease-in-out", 
              theme === 'light' ? "bg-white" : "bg-black"
            )} 
            style={{ 
              opacity: 0,
              animation: theme === 'light' ? 'fadeInWhite 0.3s forwards' : 'fadeInBlack 0.3s forwards',
              animationDelay: '0.9s'
            }} 
          />
        )}
        <style>{`
          @keyframes fadeInWhite {
            from { opacity: 0; }
            to { opacity: 1; }
          }
          @keyframes fadeInBlack {
            from { opacity: 0; }
            to { opacity: 1; }
          }
        `}</style>
      </div>
    </div>
  );
};


