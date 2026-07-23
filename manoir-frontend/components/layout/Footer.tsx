import { ArrowUpRight, Mail, MapPin, Phone } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import ManorMark from "@/components/visual/ManorMark";

export default function Footer() {
  const year = new Date().getFullYear();

  const nav = [
    { label: "Accueil", href: "/" },
    { label: "Nos appartements", href: "/rooms" },
    { label: "Comment réserver", href: "/comment-reserver" },
    { label: "Mon espace", href: "/espace-client" }
  ];

  const contacts = [
    { icon: Mail, label: "contact@lemanoir.com", href: "mailto:contact@lemanoir.com" },
    { icon: Phone, label: "+229 00 00 00 00", href: "tel:+22900000000" },
    { icon: MapPin, label: "Place de l'Étoile Rouge, Cotonou", href: "#" }
  ];

  return (
    <footer
      id="contact"
      className="on-dark relative overflow-hidden border-t border-gold/15 bg-night-800 text-cream"
    >
      {/* Filigrane du manoir */}
      <ManorMark className="pointer-events-none absolute -right-10 bottom-0 w-[420px] text-gold/[0.06] md:w-[560px]" />
      <div className="pointer-events-none absolute -left-16 top-0 h-[40vh] w-[40vh] rounded-full bg-olive/10 blur-[120px]" />

      <div className="relative mx-auto max-w-7xl px-6 py-20 md:px-10">
        <div className="grid gap-14 lg:grid-cols-[1.5fr_1fr_1fr]">
          {/* Marque */}
          <div className="space-y-6">
            <div className="flex items-center gap-4">
              <span className="grid size-14 place-items-center overflow-hidden rounded-full border border-gold/30 bg-cream">
                <Image
                  src="/assets/logo.jpg"
                  alt="Le Manoir"
                  width={56}
                  height={56}
                  className="size-full object-cover"
                />
              </span>
              <span className="font-display text-2xl font-semibold uppercase tracking-[0.3em]">
                Le Manoir
              </span>
            </div>
            <p className="max-w-sm font-display text-3xl leading-[1.15] tracking-tight text-cream md:text-4xl">
              Un séjour conçu comme un <span className="text-gradient-gold">souvenir</span>.
            </p>
            <p className="max-w-sm text-sm italic leading-relaxed text-cream/55">
              « Ce lieu a été façonné par des mains, porté par des cœurs… »
            </p>
            <Link
              href="/rooms"
              className="group inline-flex items-center gap-2.5 rounded-full bg-gradient-to-br from-gold-light to-gold px-6 py-3.5 text-[12px] font-bold uppercase tracking-[0.22em] text-night shadow-[0_10px_36px_-10px_rgba(201,164,92,0.7)] transition hover:brightness-105"
            >
              Réserver un séjour
              <ArrowUpRight
                size={16}
                className="transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5"
              />
            </Link>
          </div>

          {/* Navigation */}
          <div className="space-y-5">
            <p className="eyebrow">Explorer</p>
            <ul className="space-y-3">
              {nav.map((item) => (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    className="group inline-flex items-center gap-2 text-sm uppercase tracking-[0.18em] text-cream/70 transition hover:text-gold-light"
                  >
                    <span className="h-px w-4 bg-gold/40 transition-all duration-300 group-hover:w-7 group-hover:bg-gold" />
                    {item.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Contact */}
          <div className="space-y-5">
            <p className="eyebrow">Nous joindre</p>
            <ul className="space-y-4">
              {contacts.map((item) => (
                <li key={item.label}>
                  <a
                    href={item.href}
                    className="group flex items-start gap-3 text-sm text-cream/70 transition hover:text-cream"
                  >
                    <span className="mt-0.5 grid size-9 shrink-0 place-items-center rounded-full border border-gold/25 text-gold-light transition group-hover:border-gold/60 group-hover:bg-gold/10">
                      <item.icon size={15} />
                    </span>
                    <span className="leading-snug">{item.label}</span>
                  </a>
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div className="my-12 hairline" />

        <div className="flex flex-col gap-3 text-[11px] uppercase tracking-[0.28em] text-cream/45 md:flex-row md:items-center md:justify-between">
          <span>© {year} Le Manoir · Cotonou, Bénin</span>
          <span>Maison privée · Suites · Table · Une invitation à ralentir</span>
        </div>
      </div>
    </footer>
  );
}
