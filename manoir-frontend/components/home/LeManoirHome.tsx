"use client";

import { motion, useMotionValue, useScroll, useSpring, useTransform } from "framer-motion";
import { ArrowDown, ArrowUpRight, BookOpenCheck, Building2, LogIn, Shield, UserRound } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import type { MouseEvent } from "react";
import { useRef } from "react";
import { useAuth } from "@/context/AuthContext";
import KineticText from "./KineticText";
import SuiteRevealCard, { type Suite } from "./SuiteRevealCard";

const suites: Suite[] = [
  {
    image: "/assets/rooms/room1.jpg",
    alt: "Suite de luxe avec salon minimaliste"
  },
  {
    image: "/assets/rooms/room2.jpg",
    alt: "Chambre d'hotel haut de gamme lumineuse"
  },
  {
    image: "/assets/rooms/room4.jpg",
    alt: "Suite elegante avec lit king size"
  }
];

export default function LeManoirHome() {
  const { user, isAdmin } = useAuth();
  const heroRef = useRef<HTMLElement>(null);
  const mouseX = useMotionValue(0);
  const mouseY = useMotionValue(0);
  const smoothX = useSpring(mouseX, { stiffness: 70, damping: 22, mass: 0.45 });
  const smoothY = useSpring(mouseY, { stiffness: 70, damping: 22, mass: 0.45 });
  const titleX = useTransform(smoothX, [-0.5, 0.5], [-34, 34]);
  const titleY = useTransform(smoothY, [-0.5, 0.5], [-22, 22]);

  const { scrollYProgress } = useScroll({
    target: heroRef,
    offset: ["start start", "end start"]
  });
  const imageScale = useTransform(scrollYProgress, [0, 1], [1.08, 1.22]);
  const heroOpacity = useTransform(scrollYProgress, [0, 0.82], [1, 0.18]);

  const onHeroMove = (event: MouseEvent<HTMLElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    mouseX.set((event.clientX - rect.left) / rect.width - 0.5);
    mouseY.set((event.clientY - rect.top) / rect.height - 0.5);
  };

  const reservationGuide = {
    label: "Comment reserver ?",
    href: "/comment-reserver",
    description: "Comprendre chaque etape, de la demande jusqu'au paiement et au suivi client.",
    icon: BookOpenCheck,
  };

  const apartmentLink = {
    label: "Nos appartements",
    href: "/rooms",
    description: "Decouvrir les categories et choisir votre sejour.",
    icon: Building2,
  };

  const accountLinks = [
    ...(user
      ? [
          ...(isAdmin
            ? [
                {
                  label: "Back-office",
                  href: "/admin",
                  description: "Acceder au portail administrateur du Manoir.",
                  icon: Shield,
                },
              ]
            : []),
          {
            label: "Mon Espace",
            href: "/espace-client",
            description: "Suivre vos demandes, paiements et documents.",
            icon: UserRound,
          },
        ]
      : [
          {
            label: "Connexion",
            href: "/auth/login",
            description: "Acceder a votre compte client et vos reservations.",
            icon: LogIn,
          },
        ]),
  ];

  return (
    <main className="grain-layer overflow-hidden bg-cream text-charcoal">
        <section
          id="home"
          ref={heroRef}
          onMouseMove={onHeroMove}
          className="relative min-h-screen overflow-hidden px-6 pb-20 pt-28 md:px-10"
        >
          <motion.div style={{ scale: imageScale, opacity: heroOpacity }} className="absolute inset-0">
            <Image
              src="/assets/hero-accueil.png"
              alt="Suite Le Manoir"
              fill
              priority
              sizes="100vw"
              className="object-cover contrast-110"
            />
            <div className="absolute inset-0 bg-bark/45" />
            <div className="absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-bark to-transparent" />
          </motion.div>

          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 1, delay: 0.1 }}
            className="absolute top-28 right-6 md:right-12 w-32 md:w-48 z-20"
          >
            <Image
              src="/assets/logo.jpg"
              alt="Le Manoir Logo"
              width={192}
              height={192}
              className="w-full h-auto border border-white/10"
              priority
            />
          </motion.div>
 
          <div className="relative z-10 mx-auto flex min-h-[calc(100vh-7rem)] max-w-7xl w-full flex-col justify-end">
            <motion.p
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, delay: 0.35 }}
              className="mb-8 max-w-xl text-xs font-semibold uppercase tracking-[0.32em] text-white/90"
            >
              Le Manoir : Une Parenthèse Enchantée au Cœur de Cotonou
            </motion.p>

            <motion.div
              style={{ x: titleX, y: titleY }}
              className="pointer-events-none select-none overflow-hidden"
            >
              <h1 className="font-display text-[clamp(5rem,17vw,17rem)] uppercase leading-[0.72] tracking-[-0.06em] text-white">
                <KineticText text="Le Manoir" delay={0.2} />
              </h1>
            </motion.div>

          <div className="mt-8 grid gap-8 md:grid-cols-[1fr_0.5fr] md:items-end">
            <p className="max-w-xs text-[13px] uppercase leading-6 tracking-[0.18em] text-white/95">
              Que le temps vous y soit doux. Bien plus qu'une maison d'hôtes, Le Manoir est une invitation à ralentir.
            </p>

            <a
              href="#suites"
              className="inline-flex size-20 items-center justify-center border border-cream/40 transition hover:bg-cream hover:text-bark"
              aria-label="Aller aux suites"
            >
              <ArrowDown size={24} />
            </a>
          </div>
        </div>
      </section>

      <section className="relative z-10 bg-cream px-6 pb-4 pt-14 text-charcoal md:px-10 md:pb-6 md:pt-16">
        <div className="mx-auto max-w-7xl">
          <div className="mb-8 flex flex-col gap-6 border-b border-bark/10 pb-5 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.42em] text-bark/80">
                Le Manoir vous accueille
              </p>
              <h2 className="mt-4 font-display text-[clamp(2.5rem,6vw,5rem)] uppercase leading-[0.9] tracking-[-0.04em] text-bark">
                Votre sejour commence ici
              </h2>
            </div>
            <motion.div
              initial={{ opacity: 0, y: 18 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, amount: 0.35 }}
              transition={{ duration: 0.55 }}
              className="w-full lg:max-w-md"
            >
              <Link
                href={reservationGuide.href}
                className="group flex min-h-40 flex-col justify-between rounded-2xl border border-bark bg-bark p-6 text-cream shadow-2xl shadow-bark/15 transition duration-300 hover:bg-bark-light"
              >
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-black uppercase tracking-[0.3em] text-current/75">
                    01
                  </span>
                  <span className="grid size-11 place-items-center rounded-full border border-current/20 transition group-hover:bg-cream group-hover:text-bark">
                    <reservationGuide.icon size={18} />
                  </span>
                </div>
                <div>
                  <h3 className="font-display text-3xl uppercase leading-none tracking-[-0.03em]">
                    {reservationGuide.label}
                  </h3>
                  <p className="mt-4 text-sm leading-6 text-current/80">
                    {reservationGuide.description}
                  </p>
                </div>
              </Link>
            </motion.div>
          </div>

          <motion.div
            initial={{ opacity: 0, y: 18 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.35 }}
            transition={{ duration: 0.55 }}
          >
            <Link
              href={apartmentLink.href}
              className="group flex min-h-44 flex-col justify-between rounded-2xl border border-bark bg-bark p-6 text-cream shadow-2xl shadow-bark/15 transition duration-300 hover:bg-bark-light md:min-h-48 md:p-8"
            >
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-black uppercase tracking-[0.3em] text-current/75">
                  02
                </span>
                <span className="grid size-12 place-items-center rounded-full border border-current/20 transition group-hover:bg-cream group-hover:text-bark">
                  <apartmentLink.icon size={19} />
                </span>
              </div>
              <div className="max-w-3xl">
                <h3 className="font-display text-[clamp(2.6rem,5vw,4.6rem)] uppercase leading-none tracking-[-0.04em]">
                  {apartmentLink.label}
                </h3>
                <p className="mt-4 text-base leading-7 text-current/85">
                  {apartmentLink.description}
                </p>
              </div>
            </Link>
          </motion.div>

          <div className="mt-6 grid max-w-md gap-4 md:grid-cols-1">
            {accountLinks.map((link, index) => (
              <motion.div
                key={link.href}
                initial={{ opacity: 0, y: 18 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, amount: 0.35 }}
                transition={{ delay: index * 0.08, duration: 0.55 }}
              >
                <Link
                  href={link.href}
                  className="group flex min-h-36 flex-col justify-between rounded-2xl border border-bark bg-bark p-5 text-cream shadow-2xl shadow-bark/15 transition duration-300 hover:bg-bark-light md:min-h-40 md:p-6"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-black uppercase tracking-[0.3em] text-current/75">
                      0{index + 3}
                    </span>
                    <span className="grid size-11 place-items-center rounded-full border border-current/20 transition group-hover:bg-cream group-hover:text-bark">
                      <link.icon size={18} />
                    </span>
                  </div>
                  <div>
                    <h3 className="font-display text-3xl uppercase leading-none tracking-[-0.03em]">
                      {link.label}
                    </h3>
                    <p className="mt-4 text-sm leading-6 text-current/80">
                      {link.description}
                    </p>
                  </div>
                </Link>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      <section className="relative bg-bark px-6 py-14 text-cream md:px-10 md:py-16">
        <div className="mx-auto grid max-w-7xl gap-8 md:grid-cols-[1.1fr_0.9fr] md:items-center">
          <div className="space-y-5">
            <p className="text-xs font-bold uppercase tracking-[0.42em] text-cream/45">
              Votre Refuge Privé
            </p>
            <h2 className="font-display text-[clamp(2.4rem,7vw,4.9rem)] uppercase leading-[1.0] tracking-[-0.05em]">
              Un sanctuaire de calme.
            </h2>
            <p className="max-w-2xl text-base leading-7 text-cream/90 md:text-lg">
              Chaque appartement a été imaginé comme un havre de paix. Bois, pierre, lin et coton s’y mêlent pour créer un univers harmonieux, complété par une bibliothèque botanique et une sélection musicale soignée. Que vous soyez en voyage d’affaires ou en escapade romantique, vous y trouverez le confort absolu et l’intimité dont vous avez besoin.
            </p>
          </div>
          <div className="relative aspect-square w-full max-w-xs mx-auto overflow-hidden border border-cream/10 md:max-w-sm">
            <Image
              src="/assets/logo.jpg"
              alt="Le Manoir Logo Detail"
              fill
              sizes="(max-width: 768px) 100vw, 50vw"
              className="object-cover scale-105 transition duration-700 hover:scale-100"
            />
          </div>
        </div>
      </section>

      <section id="suites" className="bg-cream px-6 pb-24 text-charcoal md:px-10 md:pb-36">
        <div className="border-y border-black/10 py-6">
          <div className="w-full overflow-hidden">
            <span className="single-marquee-text whitespace-nowrap font-display text-[clamp(3.5rem,9vw,8rem)] uppercase leading-none tracking-[-0.05em] text-bark">
              LE MANOIR
            </span>
          </div>
        </div>

        <div className="mx-auto mt-16 grid max-w-7xl gap-10 md:grid-cols-3 md:gap-6">
          {suites.map((suite, index) => (
            <SuiteRevealCard key={suite.image} suite={suite} index={index} />
          ))}
        </div>
      </section>

      <section className="relative overflow-hidden bg-olive px-6 py-24 text-cream md:px-10 md:py-32">
        <div className="mx-auto grid max-w-7xl gap-12 md:grid-cols-[1.2fr_0.8fr] md:items-end">
          <div className="overflow-hidden">
            <p className="text-xs font-bold uppercase tracking-[0.42em] text-cream/45">
              Recevoir
            </p>
            <h2 className="mt-7 max-w-5xl font-display text-[clamp(2.2rem,6.5vw,5.5rem)] uppercase leading-[0.85] tracking-[-0.055em] whitespace-nowrap">
              <KineticText text="L'Art de Recevoir" />
            </h2>
          </div>

          <div className="space-y-8">
            <p className="text-lg leading-8 text-cream/85">
              Au Manoir, l’hospitalité est une manière d’être. Nous cultivons le luxe de l’espace, du silence et du détail. Profitez de nos appartements entièrement équipés avec kitchenettes privées pour un séjour en toute autonomie, tout en bénéficiant d’un cadre sécurisé et d’un emplacement central idéal pour découvrir les trésors de Cotonou.
            </p>
            <Link
              href="/rooms"
              className="inline-flex items-center gap-3 border border-cream px-6 py-4 text-[13px] font-black uppercase tracking-[0.28em] transition hover:bg-cream hover:text-bark"
            >
              Demander une suite <ArrowUpRight size={18} />
            </Link>
          </div>
        </div>
      </section>
    </main>
  );
}
