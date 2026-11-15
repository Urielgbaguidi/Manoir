import { ArrowLeft } from "lucide-react";
import Link from "next/link";

/**
 * Page introuvable (404). Aussi affichée à la place d'une zone réservée
 * (administration) : rien n'indique au visiteur qu'elle existe.
 */
export default function NotFoundView({ fullScreen = false }: { fullScreen?: boolean }) {
  return (
    <main
      className={
        fullScreen
          ? "grid min-h-screen place-items-center px-6 py-16 text-cream"
          : "grid min-h-[70vh] place-items-center px-6 py-32 text-cream"
      }
    >
      <div className="max-w-md text-center">
        <p className="font-display text-[clamp(4.5rem,14vw,7rem)] font-semibold leading-none text-gradient-gold">
          404
        </p>
        <h1 className="mt-4 font-display text-2xl font-semibold">Page introuvable</h1>
        <p className="mt-3 text-[15px] leading-6 text-cream/60">
          La page que vous cherchez n&apos;existe pas ou a été déplacée.
        </p>
        <Link
          href="/"
          className="mt-8 inline-flex h-12 items-center justify-center gap-2 rounded-full bg-gradient-to-br from-gold-light to-gold px-7 text-sm font-bold tracking-wide text-night transition hover:brightness-105"
        >
          <ArrowLeft size={16} />
          Retour à l&apos;accueil
        </Link>
      </div>
    </main>
  );
}
