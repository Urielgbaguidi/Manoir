"use client";

import { motion, useMotionValue, useSpring, useTransform } from "framer-motion";
import Link from "next/link";
import type { MouseEvent, ReactNode } from "react";
import { cn } from "@/lib/utils";

type MagneticButtonProps = {
  children: ReactNode;
  href?: string;
  onClick?: () => void;
  variant?: "gold" | "glass" | "outline";
  className?: string;
  type?: "button" | "submit";
  ariaLabel?: string;
};

const variantClass: Record<NonNullable<MagneticButtonProps["variant"]>, string> = {
  gold: "bg-gradient-to-br from-gold-light to-gold text-night shadow-[0_10px_40px_-10px_rgba(201,164,92,0.7)] hover:shadow-[0_16px_50px_-8px_rgba(201,164,92,0.85)]",
  glass: "glass-warm glass-edge text-cream hover:border-gold/50",
  outline: "border border-gold/40 text-cream hover:border-gold hover:bg-gold/10"
};

/**
 * Bouton magnétique : suit légèrement le curseur, avec balayage lumineux.
 */
export default function MagneticButton({
  children,
  href,
  onClick,
  variant = "gold",
  className,
  type = "button",
  ariaLabel
}: MagneticButtonProps) {
  // Intensité de l'attraction magnétique (0 = aucune, 1 = colle au curseur).
  // Volontairement discret pour un effet de "nudge" élégant, pas collant.
  const STRENGTH = 0.16;
  const x = useMotionValue(0);
  const y = useMotionValue(0);
  const sx = useSpring(x, { stiffness: 300, damping: 28, mass: 0.25 });
  const sy = useSpring(y, { stiffness: 300, damping: 28, mass: 0.25 });
  const innerX = useTransform(sx, (v) => v * 0.4);
  const innerY = useTransform(sy, (v) => v * 0.4);

  const handleMove = (event: MouseEvent<HTMLElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    x.set((event.clientX - rect.left - rect.width / 2) * STRENGTH);
    y.set((event.clientY - rect.top - rect.height / 2) * STRENGTH);
  };

  const reset = () => {
    x.set(0);
    y.set(0);
  };

  const content = (
    <motion.span
      style={{ x: innerX, y: innerY }}
      className="relative z-[1] inline-flex items-center gap-2.5"
    >
      {children}
    </motion.span>
  );

  const shared = cn(
    "group relative inline-flex items-center justify-center overflow-hidden rounded-full px-8 py-4",
    "text-[13px] font-bold uppercase tracking-[0.24em] transition-shadow duration-500",
    variantClass[variant],
    className
  );

  const sheen = <span className="sheen" />;

  if (href) {
    return (
      <motion.div
        style={{ x: sx, y: sy }}
        onMouseMove={handleMove}
        onMouseLeave={reset}
        className="inline-block"
      >
        <Link href={href} aria-label={ariaLabel} className={shared}>
          {sheen}
          {content}
        </Link>
      </motion.div>
    );
  }

  return (
    <motion.button
      type={type}
      onClick={onClick}
      aria-label={ariaLabel}
      style={{ x: sx, y: sy }}
      onMouseMove={handleMove}
      onMouseLeave={reset}
      className={shared}
    >
      {sheen}
      {content}
    </motion.button>
  );
}
