"use client";

import { motion, useMotionValue, useScroll, useSpring, useTransform } from "framer-motion";
import {
  ArrowDown,
  ArrowUpRight,
  BookOpenCheck,
  Building2,
  KeyRound,
  LogIn,
  ShieldCheck,
  Sparkles,
  UserRound
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import type { ComponentType, MouseEvent } from "react";
import { useRef } from "react";
import { useAuth } from "@/context/AuthContext";
import LogoSeal from "@/components/ui/LogoSeal";
import MagneticButton from "@/components/ui/MagneticButton";
import Reveal from "@/components/ui/Reveal";
import BotanicalLeaf from "@/components/visual/BotanicalLeaf";
import ManorMark from "@/components/visual/ManorMark";
import KineticText from "./KineticText";
import SuiteRevealCard, { type Suite } from "./SuiteRevealCard";
import Testimonials from "./Testimonials";

const suites: Suite[] = [
  {
    image: "/assets/rooms/room1.jpg",
    alt: "Suite de prestige au salon minimaliste",
    label: "Appartement VIP"
  },
  { image: "/assets/rooms/room2.jpg", alt: "Chambre lumineuse haut de gamme", label: "2 Chambres" },
  { image: "/assets/rooms/room4.jpg", alt: "Suite élégante avec lit king size", label: "1 Chambre" }
];

const stats = [
  { value: "3", label: "Catégories d'appartements" },
  { value: "24/7", label: "Cadre sécurisé" },
  { value: "100%", label: "Kitchenettes privées" },
  { value: "★", label: "Cœur de Cotonou" }
];

type ActionCard = {
  label: string;
  href: string;
  description: string;
  icon: ComponentType<{ size?: number; className?: string }>;
  index: string;
};

export default function LeManoirHome() {
  const { user, isAdmin } = useAuth();
  const heroRef = useRef<HTMLElement>(null);
  const mouseX = useMotionValue(0);
  const mouseY = useMotionValue(0);
  const smoothX = useSpring(mouseX, { stiffness: 70, damping: 22, mass: 0.45 });
  const smoothY = useSpring(mouseY, { stiffness: 70, damping: 22, mass: 0.45 });
  const titleX = useTransform(smoothX, [-0.5, 0.5], [-30, 30]);
  const titleY = useTransform(smoothY, [-0.5, 0.5], [-18, 18]);
  const markX = useTransform(smoothX, [-0.5, 0.5], [24, -24]);
  const markY = useTransform(smoothY, [-0.5, 0.5], [16, -16]);

  const { scrollYProgress } = useScroll({
    target: heroRef,
    offset: ["start start", "end start"]
  });
  // Lissage du scroll : absorbe les à-coups (barre d'adresse mobile) qui faisaient
  // « pulser » le hero. Toutes les transformations dérivent de la valeur amortie.
  const smoothProgress = useSpring(scrollYProgress, { stiffness: 90, damping: 30, mass: 0.4 });
  const imageScale = useTransform(smoothProgress, [0, 1], [1.08, 1.18]);
  const imageY = useTransform(smoothProgress, [0, 1], ["0%", "10%"]);
  const heroContentY = useTransform(smoothProgress, [0, 1], ["0%", "30%"]);
  const heroOpacity = useTransform(smoothProgress, [0, 0.9], [1, 0]);

  const onHeroMove = (event: MouseEvent<HTMLElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    mouseX.set((event.clientX - rect.left) / rect.width - 0.5);
    mouseY.set((event.clientY - rect.top) / rect.height - 0.5);
  };

  const accountCards: ActionCard[] = user
    ? [
        ...(isAdmin
          ? [
              {
                label: "Back-office",
                href: "/admin",
                description: "Accéder au portail administrateur du Manoir.",
                icon: ShieldCheck,
                index: "04"
              }
            ]
          : []),
        {
          label: "Mon Espace",
          href: "/espace-client",
          description: "Suivre vos demandes, paiements et documents.",
          icon: UserRound,
          index: "03"
        }
      ]
    : [
        {
          label: "Connexion",
          href: "/auth/login",
          description: "Accéder à votre compte client et vos réservations.",
          icon: LogIn,
          index: "03"
        }
      ];

  return (
    <main className="relative overflow-hidden text-cream">
      {/* ================= HERO ================= */}
      <section
        id="home"
        ref={heroRef}
        onMouseMove={onHeroMove}
        className="on-dark relative min-h-[100svh] overflow-hidden px-6 pb-16 pt-32 md:px-10"
      >
        <motion.div style={{ scale: imageScale, y: imageY }} className="absolute inset-0">
          <Image
            src="/assets/hero-accueil.png"
            alt="Suite Le Manoir"
            fill
            priority
            sizes="100vw"
            className="object-cover"
          />
          {/* Fusion avec le thème nuit chaude */}
          <div className="absolute inset-0 bg-gradient-to-b from-night/70 via-night/40 to-night" />
          <div className="absolute inset-0 bg-[radial-gradient(120%_90%_at_50%_20%,transparent_40%,rgba(18,13,7,0.7)_100%)]" />
        </motion.div>

        {/* Filigrane du manoir derrière le titre */}
        <motion.div
          style={{ x: markX, y: markY }}
          className="pointer-events-none absolute inset-0 z-[1] grid place-items-center"
        >
          <ManorMark className="w-[85vw] max-w-4xl text-gold/[0.07]" />
        </motion.div>

        {/* Sceau logo flottant */}
        <motion.div
          initial={{ opacity: 0, y: -12, scale: 0.9 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: 1, delay: 0.2, ease: [0.22, 1, 0.36, 1] }}
          className="absolute right-6 top-28 z-20 md:right-12 md:top-32"
        >
          <LogoSeal sizeClassName="size-20 md:size-28" />
        </motion.div>

        <motion.div
          style={{ y: heroContentY, opacity: heroOpacity }}
          className="relative z-10 mx-auto flex min-h-[calc(100svh-9rem)] max-w-7xl flex-col justify-end"
        >
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.35 }}
            className="mb-7 inline-flex w-fit items-center gap-2.5 rounded-full border border-gold/25 bg-white/5 px-4 py-2 backdrop-blur-md"
          >
            <Sparkles size={14} className="text-gold-light" />
            <span className="text-[11px] font-semibold uppercase tracking-[0.28em] text-cream/90">
              Une parenthèse enchantée au cœur de Cotonou
            </span>
          </motion.div>

          <motion.div
            style={{ x: titleX, y: titleY }}
            className="pointer-events-none select-none overflow-hidden"
          >
            <h1 className="font-display text-[clamp(3.3rem,14vw,15rem)] font-semibold uppercase leading-[0.82] tracking-[-0.05em] sm:leading-[0.78]">
              <KineticText text="Le Manoir" delay={0.2} className="text-gradient-cream" />
            </h1>
          </motion.div>

          <div className="mt-8 grid gap-8 md:grid-cols-[1fr_auto] md:items-end">
            <p className="max-w-md text-[15px] leading-7 text-cream/80">
              Que le temps vous y soit doux. Bien plus qu'une maison d'hôtes, Le Manoir est une
              invitation à ralentir — bois, pierre, lin et lumière chaude.
            </p>

            <div className="flex flex-wrap items-center gap-3">
              <MagneticButton href="/rooms" variant="gold">
                Réserver un séjour <ArrowUpRight size={16} />
              </MagneticButton>
              <MagneticButton href="/comment-reserver" variant="glass">
                Comment réserver ?
              </MagneticButton>
            </div>
          </div>

          <div className="mt-10 flex items-center gap-4">
            <a
              href="#decouvrir"
              aria-label="Découvrir"
              className="group grid size-14 place-items-center rounded-full border border-gold/30 text-cream transition hover:bg-gold hover:text-night"
            >
              <ArrowDown size={20} className="transition-transform group-hover:translate-y-0.5" />
            </a>
            <span className="text-[11px] uppercase tracking-[0.3em] text-cream/50">Défiler</span>
          </div>
        </motion.div>
      </section>

      {/* ================= BANDE STATS ================= */}
      <section className="relative z-10 px-6 md:px-10">
        <div className="mx-auto -mt-10 max-w-7xl">
          <div className="glass-dark glass-edge grid grid-cols-2 gap-px overflow-hidden rounded-3xl md:grid-cols-4">
            {stats.map((stat) => (
              <div
                key={stat.label}
                className="flex flex-col items-center gap-1 px-4 py-7 text-center"
              >
                <span className="font-display text-4xl font-semibold text-gradient-gold md:text-5xl">
                  {stat.value}
                </span>
                <span className="text-[10px] uppercase tracking-[0.24em] text-cream/55">
                  {stat.label}
                </span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ================= ACTIONS (BENTO VERRE) ================= */}
      <section id="decouvrir" className="relative px-6 py-20 md:px-10 md:py-28">
        <div className="mx-auto max-w-7xl">
          <Reveal className="mb-12 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
            <div>
              <p className="eyebrow">Le Manoir vous accueille</p>
              <h2 className="mt-4 max-w-2xl font-display text-[clamp(2.4rem,6vw,4.6rem)] font-semibold uppercase leading-[0.9] tracking-[-0.04em]">
                Votre séjour <span className="text-gradient-gold">commence ici</span>
              </h2>
            </div>
            <p className="max-w-sm text-sm leading-7 text-cream/60">
              Choisissez votre porte d'entrée : découvrir les appartements, comprendre la
              réservation, ou retrouver votre espace personnel.
            </p>
          </Reveal>

          <div className="grid gap-5 md:grid-cols-3 md:auto-rows-[minmax(0,1fr)]">
            {/* Carte vedette : appartements */}
            <Reveal className="md:col-span-2 md:row-span-2" delay={0.05}>
              <Link
                href="/rooms"
                className="on-dark group relative block h-full min-h-[22rem] overflow-hidden rounded-3xl"
              >
                <Image
                  src="/assets/rooms/room1.jpg"
                  alt="Appartements Le Manoir"
                  fill
                  sizes="(max-width: 768px) 100vw, 66vw"
                  className="object-cover transition-transform duration-[1200ms] ease-out group-hover:scale-105"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-night via-night/50 to-night/10" />
                <span className="sheen" />
                <div className="relative flex h-full flex-col justify-between p-7 md:p-9">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-bold uppercase tracking-[0.3em] text-gold-light">
                      02 · Séjour
                    </span>
                    <span className="grid size-12 place-items-center rounded-full border border-gold/40 bg-white/10 text-cream backdrop-blur-md transition group-hover:bg-gold group-hover:text-night">
                      <Building2 size={20} />
                    </span>
                  </div>
                  <div>
                    <h3 className="font-display text-[clamp(2.4rem,5vw,4rem)] font-semibold uppercase leading-[0.9] tracking-[-0.03em]">
                      Nos appartements
                    </h3>
                    <p className="mt-3 max-w-md text-sm leading-6 text-cream/75">
                      Découvrir les catégories VIP, 2 chambres et 1 chambre — et choisir votre
                      séjour.
                    </p>
                    <span className="mt-5 inline-flex items-center gap-2 text-[12px] font-bold uppercase tracking-[0.22em] text-gold-light">
                      Explorer les suites{" "}
                      <ArrowUpRight
                        size={16}
                        className="transition-transform group-hover:translate-x-1 group-hover:-translate-y-1"
                      />
                    </span>
                  </div>
                </div>
              </Link>
            </Reveal>

            {/* Comment réserver */}
            <Reveal delay={0.12}>
              <ActionGlassCard
                card={{
                  label: "Comment réserver ?",
                  href: "/comment-reserver",
                  description:
                    "Comprendre chaque étape, de la demande jusqu'au paiement et au suivi.",
                  icon: BookOpenCheck,
                  index: "01"
                }}
              />
            </Reveal>

            {/* Compte / espace */}
            {accountCards.map((card, i) => (
              <Reveal key={card.href} delay={0.18 + i * 0.06}>
                <ActionGlassCard card={card} />
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ================= SANCTUAIRE ================= */}
      <section className="relative px-6 py-20 md:px-10 md:py-28">
        <BotanicalLeaf
          variant="olive"
          className="pointer-events-none absolute left-[3%] top-16 w-24 rotate-12 text-olive/10 md:w-40"
        />
        <div className="mx-auto grid max-w-7xl gap-12 md:grid-cols-[1.05fr_0.95fr] md:items-center">
          <Reveal className="space-y-6">
            <p className="eyebrow">Votre refuge privé</p>
            <h2 className="font-display text-[clamp(2.2rem,6vw,4.4rem)] font-semibold uppercase leading-[0.95] tracking-[-0.04em]">
              Un sanctuaire <br />
              <span className="text-gradient-gold">de calme.</span>
            </h2>
            <p className="max-w-xl text-base leading-8 text-cream/70">
              Chaque appartement a été imaginé comme un havre de paix. Bois, pierre, lin et coton
              s'y mêlent pour créer un univers harmonieux, complété par une bibliothèque botanique
              et une sélection musicale soignée. Voyage d'affaires ou escapade romantique, vous y
              trouverez le confort absolu et l'intimité dont vous avez besoin.
            </p>
            <div className="flex flex-wrap gap-3 pt-2">
              {[
                "Bois & pierre",
                "Kitchenette privée",
                "Bibliothèque botanique",
                "Cadre sécurisé"
              ].map((tag) => (
                <span
                  key={tag}
                  className="rounded-full border border-gold/20 bg-white/5 px-4 py-2 text-[11px] uppercase tracking-[0.16em] text-cream/70 backdrop-blur-md"
                >
                  {tag}
                </span>
              ))}
            </div>
          </Reveal>

          <Reveal delay={0.1} className="relative">
            <div className="glass-warm glass-edge relative aspect-[4/5] overflow-hidden rounded-[2rem] p-2 shadow-glass-lg">
              <div className="relative size-full overflow-hidden rounded-[1.6rem]">
                <Image
                  src="/assets/hero_detail.jpg"
                  alt="Détail d'un appartement du Manoir"
                  fill
                  sizes="(max-width: 768px) 100vw, 45vw"
                  className="object-cover transition-transform duration-700 hover:scale-105"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-night/40 to-transparent" />
              </div>
            </div>
            <div className="glass-dark glass-edge !absolute -bottom-5 -left-5 hidden items-center gap-3 rounded-2xl px-5 py-4 shadow-glass sm:flex">
              <span className="grid size-10 place-items-center rounded-full bg-gold/20 text-gold-light">
                <KeyRound size={18} />
              </span>
              <div>
                <p className="font-display text-lg font-semibold leading-none">Clés en main</p>
                <p className="text-[10px] uppercase tracking-[0.2em] text-cream/55">
                  Autonomie totale
                </p>
              </div>
            </div>
          </Reveal>
        </div>
      </section>

      {/* ================= SUITES ================= */}
      <section id="suites" className="relative px-6 pb-24 md:px-10 md:pb-32">
        <div className="border-y border-gold/15 py-6">
          <div className="w-full overflow-hidden">
            <span className="single-marquee-text whitespace-nowrap font-display text-[clamp(3rem,9vw,7.5rem)] font-semibold uppercase leading-none tracking-[-0.05em] text-gold/25">
              LE MANOIR · L'ART DE RECEVOIR · LE MANOIR · UNE INVITATION À RALENTIR ·
            </span>
          </div>
        </div>

        <Reveal className="mx-auto mt-14 flex max-w-7xl flex-col gap-3 md:flex-row md:items-end md:justify-between">
          <h2 className="font-display text-[clamp(2rem,5vw,3.6rem)] font-semibold uppercase leading-[0.9] tracking-[-0.03em]">
            Un aperçu <span className="text-gradient-gold">des suites</span>
          </h2>
          <Link
            href="/rooms"
            className="group inline-flex items-center gap-2 text-[12px] font-bold uppercase tracking-[0.22em] text-cream/70 transition hover:text-gold-light"
          >
            Voir tous les appartements
            <ArrowUpRight
              size={16}
              className="transition-transform group-hover:translate-x-1 group-hover:-translate-y-1"
            />
          </Link>
        </Reveal>

        <div className="mx-auto mt-10 grid max-w-7xl gap-6 md:grid-cols-3">
          {suites.map((suite, index) => (
            <SuiteRevealCard key={suite.image} suite={suite} index={index} />
          ))}
        </div>
      </section>

      {/* ================= AVIS CLIENTS ================= */}
      <Testimonials />

      {/* ================= L'ART DE RECEVOIR ================= */}
      <section className="relative overflow-hidden px-6 py-24 md:px-10 md:py-32">
        <div className="absolute inset-0 -z-[1] bg-gradient-to-br from-olive/25 via-transparent to-terracotta/15" />
        <ManorMark className="pointer-events-none absolute -left-16 bottom-0 w-[380px] text-cream/[0.05] md:w-[520px]" />
        <div className="mx-auto grid max-w-7xl gap-12 md:grid-cols-[1.15fr_0.85fr] md:items-center">
          <Reveal className="overflow-hidden">
            <p className="eyebrow">Recevoir</p>
            <h2 className="mt-6 font-display text-[clamp(2.2rem,7vw,5.2rem)] font-semibold uppercase leading-[0.85] tracking-[-0.05em]">
              <KineticText text="L'Art de Recevoir" className="text-gradient-gold" />
            </h2>
          </Reveal>

          <Reveal delay={0.1} className="space-y-8">
            <p className="text-lg leading-8 text-cream/80">
              Au Manoir, l'hospitalité est une manière d'être. Nous cultivons le luxe de l'espace,
              du silence et du détail. Profitez d'appartements entièrement équipés avec kitchenettes
              privées pour un séjour en toute autonomie, dans un cadre sécurisé et central, idéal
              pour découvrir les trésors de Cotonou.
            </p>
            <MagneticButton href="/rooms" variant="outline">
              Demander une suite <ArrowUpRight size={18} />
            </MagneticButton>
          </Reveal>
        </div>
      </section>
    </main>
  );
}

function ActionGlassCard({ card }: { card: ActionCard }) {
  return (
    <Link href={card.href} className="block h-full">
      <div className="glass-warm glass-edge glass-hover group relative flex h-full min-h-[10.5rem] flex-col justify-between overflow-hidden rounded-3xl p-6">
        <span className="sheen" />
        <div className="relative flex items-center justify-between">
          <span className="text-[11px] font-bold uppercase tracking-[0.3em] text-gold-light">
            {card.index}
          </span>
          <span className="grid size-11 place-items-center rounded-full border border-gold/30 bg-white/5 text-cream transition group-hover:bg-gold group-hover:text-night">
            <card.icon size={18} />
          </span>
        </div>
        <div className="relative">
          <h3 className="font-display text-2xl font-semibold uppercase leading-none tracking-[-0.02em]">
            {card.label}
          </h3>
          <p className="mt-3 text-sm leading-6 text-cream/65">{card.description}</p>
        </div>
      </div>
    </Link>
  );
}
