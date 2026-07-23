"use client";

import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

type KineticTextProps = {
  text: string;
  className?: string;
  delay?: number;
  once?: boolean;
};

const NBSP = " ";

export default function KineticText({ text, className, delay = 0, once = true }: KineticTextProps) {
  const letters = Array.from(text);

  return (
    <motion.span
      aria-label={text}
      initial="hidden"
      whileInView="visible"
      viewport={{ once, margin: "-10%" }}
      variants={{
        hidden: {},
        visible: {
          transition: {
            delay,
            staggerChildren: 0.035
          }
        }
      }}
      className="inline"
    >
      {letters.map((letter, index) => (
        <motion.span
          key={`${letter}-${index}`}
          aria-hidden="true"
          variants={{
            hidden: { y: "112%", rotate: 4, opacity: 0 },
            visible: {
              y: "0%",
              rotate: 0,
              opacity: 1,
              transition: { duration: 0.72, ease: [0.22, 1, 0.36, 1] }
            }
          }}
          className={cn("inline-block", className)}
        >
          {letter === " " ? NBSP : letter}
        </motion.span>
      ))}
    </motion.span>
  );
}
