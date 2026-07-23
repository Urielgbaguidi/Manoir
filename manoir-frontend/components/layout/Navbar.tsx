"use client";

import { AnimatePresence, motion } from "framer-motion";
import { ArrowUpRight, LogOut, Menu, X } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { cn } from "@/lib/utils";
import BotanicalLeaf from "@/components/visual/BotanicalLeaf";
import ThemeToggle from "@/components/ui/ThemeToggle";
import NotificationBell from "@/components/ui/NotificationBell";

export default function Navbar() {
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const { user, logout, isAdmin } = useAuth();
  const pathname = usePathname();
  // Au repos, la navbar "fusionne" avec le fond (transparente) dans les deux
  // thèmes. Sur la home elle surplombe le hero sombre → texte clair (on-dark).
  const overDarkHero = pathname === "/";

  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  useEffect(() => {
    // Hystérésis : évite que l'état bascule en boucle autour d'un seuil unique
    // (sur mobile, la barre d'adresse qui apparaît/disparaît fait osciller scrollY
    // → le fond de la navbar clignotait). Zone morte 10–56px.
    const onScroll = () => setScrolled((prev) => (prev ? window.scrollY > 10 : window.scrollY > 56));
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const navLinks = [
    { label: "Accueil", href: "/" },
    { label: "Nos appartements", href: "/rooms" },
    { label: "Comment réserver", href: "/comment-reserver" }
  ];

  if (user) {
    if (isAdmin) navLinks.push({ label: "Back-office", href: "/admin" });
    navLinks.push({ label: "Mon Espace", href: "/espace-client" });
  } else {
    navLinks.push({ label: "Connexion", href: "/auth/login" });
  }

  return (
    <>
      <motion.header
        initial={{ y: -90 }}
        animate={{ y: 0 }}
        transition={{ duration: 0.9, ease: [0.22, 1, 0.36, 1] }}
        className="fixed inset-x-0 top-0 z-[90] px-4 pt-3 md:px-6 md:pt-4"
      >
        <nav
          className={cn(
            "relative mx-auto flex max-w-7xl items-center justify-between rounded-full px-3 py-2.5 transition-all duration-500 md:px-4",
            scrolled
              ? "glass-warm glass-edge shadow-glass"
              : "border border-transparent bg-transparent",
            !scrolled && overDarkHero && "on-dark"
          )}
        >
          {/* Extrême gauche : sceau + titre */}
          <Link href="/" className="flex items-center gap-3">
            <span className="relative grid size-10 place-items-center overflow-hidden rounded-full border border-gold/30 bg-cream shadow-inner md:size-11">
              <Image
                src="/assets/logo.jpg"
                alt="Le Manoir"
                width={44}
                height={44}
                className="size-full object-cover"
              />
            </span>
            <span className="hidden whitespace-nowrap font-display text-[15px] font-semibold uppercase tracking-[0.3em] text-cream sm:inline md:text-base md:tracking-[0.34em]">
              Le Manoir
            </span>
          </Link>

          {/* Centre : liens de navigation */}
          <div className="absolute left-1/2 hidden -translate-x-1/2 items-center gap-6 lg:flex xl:gap-7">
            {navLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="group relative text-[12px] font-semibold uppercase tracking-[0.18em] text-cream/75 transition hover:text-cream"
              >
                {link.label}
                <span className="absolute -bottom-1.5 left-0 h-px w-0 bg-gold transition-all duration-300 group-hover:w-full" />
              </Link>
            ))}
          </div>

          {/* Extrême droite : Réserver + actions */}
          <div className="flex items-center gap-2.5">
            <Link
              href="/rooms"
              className="inline-flex items-center gap-1 rounded-full bg-gradient-to-br from-gold-light to-gold px-3.5 py-1.5 text-[12px] font-semibold uppercase tracking-[0.18em] text-night transition hover:brightness-105"
            >
              Réserver
              <ArrowUpRight size={13} />
            </Link>

            {user && <NotificationBell />}

            <ThemeToggle />

            {user && (
              <button
                type="button"
                onClick={() => logout()}
                aria-label="Déconnexion"
                title="Déconnexion"
                className="hidden size-10 place-items-center rounded-full border border-gold/25 bg-white/5 text-cream backdrop-blur-md transition hover:border-terracotta/50 hover:bg-terracotta/15 lg:grid"
              >
                <LogOut size={17} />
              </button>
            )}

            {/* Hamburger — mobile / tablette uniquement */}
            <button
              type="button"
              aria-label={open ? "Fermer le menu" : "Ouvrir le menu"}
              aria-expanded={open}
              onClick={() => setOpen((current) => !current)}
              className="grid size-10 place-items-center rounded-full border border-gold/25 bg-white/5 text-cream backdrop-blur-md transition hover:border-gold/60 hover:bg-gold/15 lg:hidden"
            >
              {open ? <X size={19} /> : <Menu size={19} />}
            </button>
          </div>
        </nav>
      </motion.header>

      <AnimatePresence>
        {open ? (
          <motion.div
            key="menu"
            initial={{ clipPath: "inset(0 0 100% 0)" }}
            animate={{ clipPath: "inset(0 0 0% 0)" }}
            exit={{ clipPath: "inset(0 0 100% 0)" }}
            transition={{ duration: 0.8, ease: [0.77, 0, 0.175, 1] }}
            className="on-dark fixed inset-0 z-[100] overflow-hidden bg-night/85 text-cream backdrop-blur-2xl"
          >
            {/* Ambiance du menu */}
            <div className="pointer-events-none absolute inset-0">
              <div className="absolute -right-24 top-10 h-[60vh] w-[60vh] rounded-full bg-terracotta/25 blur-[120px]" />
              <div className="absolute -left-16 bottom-0 h-[50vh] w-[50vh] rounded-full bg-olive/20 blur-[120px]" />
              <BotanicalLeaf
                variant="olive"
                className="absolute right-[8%] top-[16%] w-40 rotate-12 text-gold/10"
              />
            </div>

            <div className="relative mx-auto flex min-h-screen max-w-7xl flex-col justify-between px-6 pb-10 pt-24 md:px-10 md:pb-14">
              <div className="mb-6 flex items-center justify-between">
                <span className="eyebrow">Menu</span>
                <button
                  type="button"
                  aria-label="Fermer le menu"
                  onClick={() => setOpen(false)}
                  className="grid size-11 place-items-center rounded-full border border-gold/30 text-cream transition hover:border-gold hover:bg-gold/10"
                >
                  <X size={20} />
                </button>
              </div>

              <motion.div
                initial="hidden"
                animate="visible"
                exit="hidden"
                variants={{
                  hidden: {},
                  visible: { transition: { staggerChildren: 0.08, delayChildren: 0.2 } }
                }}
                className="space-y-1"
              >
                {navLinks.map((link, index) => (
                  <motion.div
                    key={link.href}
                    variants={{
                      hidden: { y: 56, opacity: 0 },
                      visible: {
                        y: 0,
                        opacity: 1,
                        transition: { duration: 0.7, ease: [0.22, 1, 0.36, 1] }
                      }
                    }}
                  >
                    <Link
                      href={link.href}
                      onClick={() => setOpen(false)}
                      className="group flex items-center gap-5 border-b border-cream/10 py-3 font-display text-[clamp(2rem,6vw,4.6rem)] uppercase leading-[0.95] tracking-[-0.02em] text-cream transition-colors hover:text-gold-light"
                    >
                      <span className="w-10 pb-2 text-xs font-semibold tracking-[0.3em] text-gold/60">
                        0{index + 1}
                      </span>
                      <span className="transition-transform duration-500 group-hover:translate-x-4">
                        {link.label}
                      </span>
                      <ArrowUpRight
                        className="ml-auto opacity-0 transition-all duration-500 group-hover:opacity-100"
                        size={34}
                      />
                    </Link>
                  </motion.div>
                ))}

                {user && (
                  <motion.div
                    variants={{
                      hidden: { y: 56, opacity: 0 },
                      visible: {
                        y: 0,
                        opacity: 1,
                        transition: { duration: 0.7, ease: [0.22, 1, 0.36, 1] }
                      }
                    }}
                  >
                    <button
                      onClick={() => {
                        setOpen(false);
                        logout();
                      }}
                      className="group flex w-full items-center gap-5 border-b border-cream/10 py-3 text-left font-display text-[clamp(2rem,6vw,4.6rem)] uppercase leading-[0.95] tracking-[-0.02em] text-terracotta-light hover:text-terracotta"
                    >
                      <span className="w-10 pb-2 text-xs font-semibold tracking-[0.3em] text-gold/50">
                        0{navLinks.length + 1}
                      </span>
                      <span className="flex items-center gap-4 transition-transform duration-500 group-hover:translate-x-4">
                        Déconnexion <LogOut size={26} />
                      </span>
                    </button>
                  </motion.div>
                )}
              </motion.div>

              <div className="mt-8 flex flex-col gap-3 text-[11px] uppercase tracking-[0.3em] text-cream/50 md:flex-row md:justify-between">
                <span>{user ? `Connecté · ${user.name}` : "Maison privée · Suites · Table"}</span>
                <span>Place de l'Étoile Rouge · Cotonou, Bénin</span>
              </div>
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </>
  );
}
