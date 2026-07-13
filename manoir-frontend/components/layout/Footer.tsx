import { ArrowUpRight } from "lucide-react";
import Image from "next/image";
import Link from "next/link";

export default function Footer() {
  return (
    <footer id="contact" className="relative overflow-hidden bg-cream-dark px-6 py-16 text-charcoal md:px-10">
      <div className="mx-auto grid max-w-7xl gap-10 md:grid-cols-[1.4fr_0.8fr_0.8fr]">
        <div className="space-y-6">
          <p className="text-xs font-semibold uppercase tracking-[0.42em] text-bark/50">
            Le Manoir
          </p>
          <Image
            src="/assets/logo.jpg"
            alt="Le Manoir Logo"
            width={192}
            height={192}
            className="h-auto w-48 border border-bark/10"
          />
          <h2 className="font-display text-3xl uppercase leading-[1.1] tracking-[-0.03em] max-w-sm text-bark">
            Un séjour conçu comme un souvenir.
          </h2>
        </div>

        <div className="space-y-4 text-sm uppercase tracking-[0.22em]">
          <a href="mailto:contact@lemanoir.com" className="flex items-center gap-2 hover:opacity-55 text-bark">
            Email <ArrowUpRight size={16} />
          </a>
          <a href="tel:+22900000000" className="flex items-center gap-2 hover:opacity-55 text-bark">
            Telephone <ArrowUpRight size={16} />
          </a>
          <Link href="/rooms" className="flex items-center gap-2 hover:opacity-55 text-bark">
            Reservation <ArrowUpRight size={16} />
          </Link>
        </div>

        <div className="text-sm leading-7 text-bark/85">
          <p className="font-bold text-bark">Cotonou, Benin</p>
          <p className="text-xs uppercase tracking-wider text-bark/70 mb-3">Place de l'Étoile Rouge</p>
          <p className="text-charcoal">Bien plus qu'une maison d'hôtes, Le Manoir est une invitation à ralentir. Un refuge privé au cœur de la ville.</p>
          <p className="mt-8 text-xs uppercase tracking-[0.26em] text-charcoal">
            © {new Date().getFullYear()} Le Manoir
          </p>
        </div>
      </div>
    </footer>
  );
}
