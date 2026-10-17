import React, { useRef } from 'react';
import { motion, useScroll, useTransform } from 'motion/react';
import { cn } from '../../lib/utils';

interface Scroll3DButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  children: React.ReactNode;
  glowColor?: string;
  scrollContainerRef?: React.RefObject<HTMLElement>;
  containerClassName?: string;
}

export const Scroll3DButton = ({ 
  children, 
  className, 
  glowColor = 'rgba(34,211,238,0.5)',
  scrollContainerRef,
  containerClassName,
  ...props 
}: Scroll3DButtonProps) => {
  const ref = useRef<HTMLButtonElement>(null);

  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ["start end", "end start"]
  });

  const rotateX = useTransform(scrollYProgress, [0, 1], [25, -25]);
  const scale = useTransform(scrollYProgress, [0.3, 0.5, 0.7], [0.95, 1.05, 0.95]);
  
  const blur = useTransform(scrollYProgress, [0.3, 0.5, 0.7], [5, 25, 5]);
  const opacity = useTransform(scrollYProgress, [0.3, 0.5, 0.7], [0, 0.8, 0]);

  return (
    <div className={cn("relative shrink-0 flex items-stretch", containerClassName)} style={{ perspective: 1000 }}>
      {/* Dynamic Glow Layer */}
      <motion.div
        className="absolute inset-0 rounded-2xl pointer-events-none"
        style={{
          background: glowColor,
          filter: useTransform(blur, b => `blur(${b}px)`),
          opacity: opacity,
        }}
      />
      
      {/* 3D Button */}
      <motion.button
        ref={ref}
        type="button"
        style={{
          rotateX,
          scale,
          transformStyle: "preserve-3d"
        }}
        className={cn("relative z-10 w-full flex-1 cursor-pointer select-none", className)}
        {...(props as any)}
      >
        <span 
          className="pointer-events-none"
          style={{ transform: "translateZ(30px)", display: "flex", alignItems: "center", justifyContent: "center", gap: "0.75rem", width: "100%" }}
        >
          {children}
        </span>
      </motion.button>
    </div>
  );
};
