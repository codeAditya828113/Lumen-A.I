import React, { useRef } from 'react';
import { motion, useScroll, useTransform } from 'motion/react';
import { cn } from '../../lib/utils';

interface Scroll3DSectionProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
}

export const Scroll3DSection = ({ children, className, id }: Scroll3DSectionProps) => {
  return (
    <section id={id} className={cn("min-h-[80vh] py-16 md:py-24 relative flex flex-col justify-center", className)}>
      <motion.div className="w-full">
        {children}
      </motion.div>
    </section>
  );
};
