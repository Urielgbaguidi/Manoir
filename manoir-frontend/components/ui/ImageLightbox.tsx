"use client";

import { AnimatePresence, motion } from "framer-motion";
import { ChevronLeft, ChevronRight, X } from "lucide-react";
import Image from "next/image";
import { useEffect } from "react";

type ImageLightboxProps = {
  images: string[];
  index: number | null;
  onClose: () => void;
  onIndexChange: (index: number) => void;
  alt?: string;
};

/**
 * Lightbox plein écran pour galeries photo (verre, navigation clavier + boutons).
 */
export default function ImageLightbox({
  images,
  index,
  onClose,
  onIndexChange,
  alt = "Photo"
}: ImageLightboxProps) {
  const open = index !== null;

  useEffect(() => {
    if (!open || index === null) return;

    document.body.style.overflow = "hidden";
    document.body.classList.add("overlay-open");
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
      if (event.key === "ArrowRight") onIndexChange((index + 1) % images.length);
      if (event.key === "ArrowLeft") onIndexChange((index - 1 + images.length) % images.length);
    };
    window.addEventListener("keydown", onKey);

    return () => {
      document.body.style.overflow = "";
      document.body.classList.remove("overlay-open");
      window.removeEventListener("keydown", onKey);
    };
  }, [open, index, images.length, onClose, onIndexChange]);

  return (
    <AnimatePresence>
      {open && index !== null && (
        <motion.div
          key="lightbox"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.25 }}
          onClick={onClose}
          className="on-dark fixed inset-0 z-[130] grid place-items-center bg-night/90 p-4 backdrop-blur-2xl sm:p-8"
        >
          <motion.div
            initial={{ scale: 0.85, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.9, opacity: 0 }}
            transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
            onClick={(event) => event.stopPropagation()}
            className="glass-warm glass-edge relative w-full max-w-4xl rounded-[1.6rem] p-2 shadow-glass-lg"
          >
            <div className="relative aspect-[4/3] w-full overflow-hidden rounded-[1.2rem] bg-night">
              <Image
                src={images[index]}
                alt={`${alt} ${index + 1}`}
                fill
                sizes="90vw"
                className="object-contain"
                priority
              />
            </div>

            {images.length > 1 && (
              <span className="absolute bottom-5 left-1/2 -translate-x-1/2 rounded-full border border-gold/30 bg-night/60 px-3 py-1 text-[11px] font-semibold tracking-wider text-cream backdrop-blur-md">
                {index + 1} / {images.length}
              </span>
            )}
          </motion.div>

          {images.length > 1 && (
            <>
              <button
                type="button"
                aria-label="Photo précédente"
                onClick={(event) => {
                  event.stopPropagation();
                  onIndexChange((index - 1 + images.length) % images.length);
                }}
                className="absolute left-3 top-1/2 grid size-12 -translate-y-1/2 place-items-center rounded-full border border-gold/40 bg-night/50 text-cream backdrop-blur-md transition hover:bg-gold hover:text-night sm:left-6"
              >
                <ChevronLeft size={22} />
              </button>
              <button
                type="button"
                aria-label="Photo suivante"
                onClick={(event) => {
                  event.stopPropagation();
                  onIndexChange((index + 1) % images.length);
                }}
                className="absolute right-3 top-1/2 grid size-12 -translate-y-1/2 place-items-center rounded-full border border-gold/40 bg-night/50 text-cream backdrop-blur-md transition hover:bg-gold hover:text-night sm:right-6"
              >
                <ChevronRight size={22} />
              </button>
            </>
          )}

          <button
            type="button"
            aria-label="Fermer"
            onClick={onClose}
            className="absolute right-4 top-4 grid size-11 place-items-center rounded-full border border-gold/40 text-cream transition hover:border-gold hover:bg-gold/10"
          >
            <X size={20} />
          </button>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
