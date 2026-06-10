"use client";

import { LazyMotion, domAnimation, m } from "framer-motion";
import { cn } from "@/lib/utils";

interface RevealProps {
  children: React.ReactNode;
  delay?: number;
  className?: string;
}

export function Reveal({ children, delay = 0, className }: RevealProps) {
  return (
    <LazyMotion features={domAnimation} strict>
      <m.div
        initial={{ opacity: 0, y: 28 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: "-60px" }}
        transition={{ duration: 0.6, delay, ease: [0.22, 1, 0.36, 1] }}
        className={cn(className)}
      >
        {children}
      </m.div>
    </LazyMotion>
  );
}
