"use client";

import { motion } from "framer-motion";
import { ArrowLeft, CreditCard, FileText, KeyRound } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { forwardRef, type InputHTMLAttributes, type ReactNode } from "react";
import ThemeToggle from "@/components/ui/ThemeToggle";
import { cn } from "@/lib/utils";
import { contactMailto } from "@/lib/site";

const perks = [
  { icon: KeyRound, text: "Des appartements tout équipés, prêts à vous accueillir" },
  { icon: CreditCard, text: "Réservez en quelques clics, payez par Mobile Money ou carte" },
  { icon: FileText, text: "Vos bons de séjour et factures toujours à portée de main" }
];

/**
 * Gabarit des pages Connexion / Inscription : écran scindé.
 * Photo d'ambiance + promesse du Manoir à gauche (desktop), formulaire à droite.
 */
export default function AuthShell({
  title,
  subtitle,
  children,
  footer,
  image = "/assets/hero_detail.jpg",
  headline = "Votre séjour commence ici."
}: {
  title: string;
  subtitle: string;
  children: ReactNode;
  footer?: ReactNode;
  image?: string;
  /** Grande accroche posée sur la photo. */
  headline?: string;
}) {
  const year = new Date().getFullYear();

  return (
    <main className="relative grid min-h-[100svh] text-cream lg:grid-cols-[minmax(0,1.05fr)_minmax(0,1fr)]">
      {/* Panneau visuel (desktop), à gauche. Bord à bord : ni marge ni arrondi,
          toute la hauteur de l'écran. Pas d'overflow-hidden ici : il casserait
          le « sticky » et l'image remonterait au défilement. */}
      <aside className="on-dark relative hidden min-h-[100svh] lg:block">
        <div className="sticky top-0 h-[100svh]">
          <div className="relative h-full w-full overflow-hidden">
            <Image src={image} alt="Intérieur d'un appartement du Manoir" fill priority sizes="50vw" className="object-cover" />
            <div className="absolute inset-0 bg-gradient-to-t from-night via-night/45 to-night/20" />

            {/* Pastille d'accueil, comme sur la page d'accueil (sans étoile). */}
            <div className="absolute left-10 top-10 xl:left-14 xl:top-12">
              <span className="inline-flex items-center rounded-full border border-gold/30 bg-white/10 px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.26em] text-cream/90 backdrop-blur-md">
                Une parenthèse enchantée au cœur de Cotonou
              </span>
            </div>

            <div className="absolute inset-x-0 bottom-0 p-10 xl:p-14">
              <p className="max-w-lg font-display text-[clamp(2rem,3vw,3rem)] font-semibold leading-[1.05] tracking-[-0.02em] text-cream">
                {headline}
              </p>
              <p className="mt-3 max-w-md text-[15px] leading-6 text-cream/75">
                Que le temps vous y soit doux. Un lieu calme et chaleureux, pensé pour bien vous recevoir.
              </p>

              <ul className="mt-8 space-y-4">
                {perks.map((perk) => (
                  <li key={perk.text} className="flex items-center gap-4 text-[15px] text-cream/85">
                    <span className="grid size-10 shrink-0 place-items-center rounded-full border border-gold/30 bg-white/10 text-gold-light backdrop-blur-md">
                      <perk.icon size={17} />
                    </span>
                    {perk.text}
                  </li>
                ))}
              </ul>

              <div className="mt-10 flex items-center gap-4 border-t border-gold/20 pt-6">
                <span className="grid size-11 place-items-center overflow-hidden rounded-full border border-gold/30 bg-cream">
                  <Image src="/assets/logo.jpg" alt="" width={44} height={44} className="size-full object-cover" />
                </span>
                <div>
                  <p className="text-sm italic text-cream/80">
                    « Ce lieu a été façonné par des mains, porté par des cœurs… »
                  </p>
                  <p className="mt-0.5 text-[11px] uppercase tracking-[0.22em] text-gold-light/80">
                    Maison d'hôtes · Cotonou
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </aside>

      {/* Colonne formulaire, à droite */}
      <section className="relative flex min-h-[100svh] flex-col px-5 py-6 sm:px-10 lg:px-14 xl:px-20">
        <header className="flex items-center justify-between gap-4">
          <Link href="/" className="flex items-center gap-3" aria-label="Retour à l'accueil">
            <span className="grid size-10 place-items-center overflow-hidden rounded-full border border-gold/30 bg-cream">
              <Image src="/assets/logo.jpg" alt="" width={40} height={40} className="size-full object-cover" />
            </span>
            <span className="font-display text-sm font-semibold uppercase tracking-[0.3em]">
              Le Manoir
            </span>
          </Link>
          <div className="flex items-center gap-2">
            <Link
              href="/"
              className="hidden items-center gap-1.5 rounded-full px-3 py-2 text-xs font-semibold text-cream/60 transition hover:text-gold-light sm:inline-flex"
            >
              <ArrowLeft size={14} /> Retour au site
            </Link>
            <ThemeToggle />
          </div>
        </header>

        <motion.div
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
          className="mx-auto flex w-full max-w-[440px] flex-1 flex-col justify-center py-10"
        >
          {/* Sur mobile (sans photo), la pastille d'accueil reste visible. */}
          <span className="mb-5 inline-flex w-fit items-center rounded-full border border-gold/25 bg-white/5 px-3.5 py-1.5 text-[10px] font-semibold uppercase tracking-[0.22em] text-cream/75 lg:hidden">
            Une parenthèse enchantée au cœur de Cotonou
          </span>
          <h1 className="font-display text-[clamp(2rem,5vw,2.75rem)] font-semibold leading-[1.05] tracking-[-0.03em]">
            {title}
          </h1>
          <p className="mt-3 text-[15px] leading-6 text-cream/60">{subtitle}</p>

          <div className="mt-8">{children}</div>

          {footer && <div className="mt-8 text-center text-sm text-cream/60">{footer}</div>}
        </motion.div>

        <footer className="flex flex-wrap items-center justify-between gap-2 text-xs text-cream/45">
          <span>© {year} Le Manoir · Cotonou</span>
          <a href={contactMailto("Aide connexion, Le Manoir")} className="hover:text-gold-light">
            Besoin d'aide ?
          </a>
        </footer>
      </section>
    </main>
  );
}

/** Séparateur « ou » entre Google et le formulaire classique. */
export function AuthDivider({ label = "ou avec votre email" }: { label?: string }) {
  return (
    <div className="my-6 flex items-center gap-4 text-[11px] font-semibold uppercase tracking-[0.18em] text-cream/40">
      <span className="h-px flex-1 bg-gold/15" />
      {label}
      <span className="h-px flex-1 bg-gold/15" />
    </div>
  );
}

type AuthFieldProps = InputHTMLAttributes<HTMLInputElement> & {
  label: string;
  hint?: ReactNode;
  trailing?: ReactNode;
  labelAside?: ReactNode;
};

/** Champ étiqueté, plus lisible que les anciens libellés en capitales minuscules. */
export const AuthField = forwardRef<HTMLInputElement, AuthFieldProps>(function AuthField(
  { label, hint, trailing, labelAside, id, className, required, ...props },
  ref
) {
  const inputId = id || props.name;
  return (
    <div className="space-y-1.5">
      <div className="flex items-baseline justify-between gap-3">
        <label htmlFor={inputId} className="text-sm font-medium text-cream/85">
          {label}
          {required && <span className="ml-0.5 text-gold">*</span>}
        </label>
        {labelAside}
      </div>
      <div className="relative">
        <input
          ref={ref}
          id={inputId}
          required={required}
          className={cn(
            "glass-input h-12 w-full rounded-xl px-4 text-[15px] outline-none",
            trailing ? "pr-12" : "",
            className
          )}
          {...props}
        />
        {trailing && <div className="absolute inset-y-0 right-0 flex items-center pr-3">{trailing}</div>}
      </div>
      {hint && <p className="text-xs leading-5 text-cream/50">{hint}</p>}
    </div>
  );
});

/** Bouton principal des formulaires d'authentification. */
export function AuthSubmit({ loading, children }: { loading: boolean; children: ReactNode }) {
  return (
    <button
      type="submit"
      disabled={loading}
      className="flex h-12 w-full items-center justify-center gap-2 rounded-full bg-gradient-to-br from-gold-light to-gold text-sm font-bold tracking-wide text-night shadow-[0_10px_30px_-12px_rgba(201,164,92,0.8)] transition hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-60"
    >
      {loading ? (
        <span className="inline-block size-4 animate-spin rounded-full border-2 border-night border-t-transparent" />
      ) : (
        children
      )}
    </button>
  );
}
