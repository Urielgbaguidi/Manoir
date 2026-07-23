"use client";

import { AnimatePresence, motion } from "framer-motion";
import { X, ZoomIn } from "lucide-react";
import Image from "next/image";
import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

type LogoSealProps = {
  /** Taille du sceau (classes tailwind, ex: "size-20 md:size-28"). */
  sizeClassName?: string;
  className?: string;
};

/**
 * Sceau circulaire "liquid glass" du Manoir. Au clic, ouvre le logo en grand
 * dans une lightbox — en conservant les bords glassmorphisme circulaires.
 */
export default function LogoSeal({
  sizeClassName = "size-20 md:size-28",
  className
}: LogoSealProps) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : "";
    document.body.classList.toggle("overlay-open", open);
    return () => {
      document.body.style.overflow = "";
      document.body.classList.remove("overlay-open");
    };
  }, [open]);

  return (
    <>
      <motion.button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Agrandir le logo Le Manoir"
        whileHover={{ scale: 1.04 }}
        whileTap={{ scale: 0.96 }}
        className={cn(
          "glass-warm glass-edge animate-float group relative cursor-zoom-in rounded-full p-1.5 shadow-glass",
          className
        )}
      >
        <span
          className={cn(
            "grid place-items-center overflow-hidden rounded-full border border-gold/30 bg-cream",
            sizeClassName
          )}
        >
          <Image
            src="/assets/logo.jpg"
            alt="Le Manoir"
            width={160}
            height={160}
            className="size-full object-cover"
          />
        </span>
        <span className="pointer-events-none absolute inset-0 grid place-items-center rounded-full bg-night/40 opacity-0 backdrop-blur-[1px] transition-opacity duration-300 group-hover:opacity-100">
          <ZoomIn size={22} className="text-cream" />
        </span>
      </motion.button>

      <AnimatePresence>
        {open && (
          <motion.div
            key="logo-lightbox"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
            onClick={() => setOpen(false)}
            className="on-dark fixed inset-0 z-[130] grid cursor-zoom-out place-items-center bg-night/95 p-6 backdrop-blur-2xl"
          >
            <motion.div
              initial={{ scale: 0.6, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.7, opacity: 0 }}
              transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
              onClick={(event) => event.stopPropagation()}
              className="glass-warm glass-edge relative grid aspect-square w-[min(84vw,84vh,540px)] cursor-default place-items-center rounded-full p-3 shadow-glass-lg"
            >
              <span className="grid size-full place-items-center overflow-hidden rounded-full border border-gold/40 bg-cream">
                <Image
                  src="/assets/logo.jpg"
                  alt="Le Manoir"
                  width={900}
                  height={900}
                  className="size-full object-cover"
                  priority
                />
              </span>
              <span className="sheen" />
            </motion.div>

            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label="Fermer"
              className="fixed right-5 top-5 grid size-11 place-items-center rounded-full border border-gold/40 text-cream transition hover:border-gold hover:bg-gold/10"
            >
              <X size={20} />
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
