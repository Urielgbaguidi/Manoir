"use client";

import { AnimatePresence, motion } from "framer-motion";
import { X } from "lucide-react";
import { useEffect, type ButtonHTMLAttributes, type ComponentType, type ReactNode } from "react";
import { cn } from "@/lib/utils";

/*
 * Fenêtre modale unique du site : fond blanc légèrement roux (couleurs du
 * Manoir), icône dans une pastille, titre, texte, puis un bouton « Annuler »
 * blanc et un bouton d'action coloré. Toujours claire, quel que soit le
 * thème : la classe `modal-light` repeint en encre les textes « crème » du
 * contenu.
 */

export type ModalTone = "default" | "danger" | "success";

const iconTones: Record<ModalTone, string> = {
  default: "bg-[#F7E9DC] text-[#8B5A2B] ring-[#FBF3EC]",
  danger: "bg-[#FBE3DC] text-[#B5432A] ring-[#FDF1EC]",
  success: "bg-[#EEF1DF] text-[#566523] ring-[#F6F8EE]"
};

export default function Modal({
  open,
  onClose,
  title,
  description,
  icon: Icon,
  tone = "default",
  busy = false,
  maxWidth = "max-w-lg",
  zIndex = "z-[110]",
  children
}: {
  open: boolean;
  onClose: () => void;
  title?: ReactNode;
  description?: ReactNode;
  icon?: ComponentType<{ size?: number; className?: string }>;
  tone?: ModalTone;
  /** Action en cours : la fenêtre ne se ferme pas. */
  busy?: boolean;
  maxWidth?: string;
  zIndex?: string;
  children?: ReactNode;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !busy) onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, busy, onClose]);

  const close = () => {
    if (!busy) onClose();
  };

  return (
    <AnimatePresence>
      {open && (
        <div className={cn("fixed inset-0 flex items-center justify-center p-4", zIndex)}>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={close}
            className="absolute inset-0 bg-[#2B1D12]/45 backdrop-blur-[3px]"
          />
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-label={typeof title === "string" ? title : undefined}
            initial={{ opacity: 0, scale: 0.96, y: 12 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 12 }}
            transition={{ duration: 0.18, ease: "easeOut" }}
            className={cn(
              "modal-light modal-surface relative max-h-[90vh] w-full overflow-y-auto rounded-2xl border border-[#EADBCD] p-6 text-[#2C2416] shadow-[0_24px_60px_-12px_rgba(61,40,23,0.35)] sm:p-7",
              maxWidth
            )}
          >
            <button
              type="button"
              onClick={close}
              disabled={busy}
              aria-label="Fermer"
              className="absolute right-4 top-4 inline-flex size-9 items-center justify-center rounded-full text-[#9A8B7E] outline-none transition hover:bg-[#F6EDE4] hover:text-[#3D2817] focus-visible:ring-4 focus-visible:ring-[#8B5A2B]/20 disabled:opacity-40"
            >
              <X size={20} />
            </button>

            {(title || description || Icon) && (
              <div className="mb-6 flex items-start gap-4 pr-8">
                {Icon && (
                  <span
                    className={cn(
                      "flex size-12 shrink-0 items-center justify-center rounded-full ring-8",
                      iconTones[tone]
                    )}
                  >
                    <Icon size={22} />
                  </span>
                )}
                <div className="min-w-0 pt-0.5">
                  {title && (
                    <h3 className="text-lg font-semibold leading-snug text-[#2C2416]">{title}</h3>
                  )}
                  {description && (
                    <div className="mt-1.5 text-sm leading-6 text-[#6B5A4E]">{description}</div>
                  )}
                </div>
              </div>
            )}

            {children}
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}

const buttonVariants = {
  secondary:
    "border border-[#E3D3C4] bg-white text-[#3D2817] shadow-sm hover:bg-[#FBF5EF] focus-visible:ring-[#E3D3C4]",
  primary:
    "bg-[#8B5A2B] text-white shadow-[0_6px_14px_-6px_rgba(139,90,43,0.7)] hover:bg-[#7A4E24] focus-visible:ring-[#8B5A2B]/40",
  danger:
    "bg-[#C2412D] text-white shadow-[0_6px_14px_-6px_rgba(194,65,45,0.7)] hover:bg-[#A93725] focus-visible:ring-[#C2412D]/40",
  success:
    "bg-[#566523] text-white shadow-[0_6px_14px_-6px_rgba(86,101,35,0.7)] hover:bg-[#4A571E] focus-visible:ring-[#566523]/40"
} as const;

/** Bouton de fenêtre : Annuler (blanc) ou action (roux, rouge, vert). */
export function ModalButton({
  variant = "primary",
  className,
  type = "button",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: keyof typeof buttonVariants }) {
  return (
    <button
      type={type}
      className={cn(
        "inline-flex h-11 items-center justify-center gap-2 rounded-xl px-5 text-sm font-semibold outline-none transition focus-visible:ring-4 disabled:cursor-not-allowed disabled:opacity-50",
        buttonVariants[variant],
        className
      )}
      {...props}
    />
  );
}

/** Rangée de boutons en bas de fenêtre, alignée à droite. */
export function ModalActions({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div
      className={cn(
        "mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-end",
        className
      )}
    >
      {children}
    </div>
  );
}
