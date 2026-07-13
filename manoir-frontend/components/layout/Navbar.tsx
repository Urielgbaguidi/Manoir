"use client";

import { AnimatePresence, motion } from "framer-motion";
import { Menu, X, LogOut } from "lucide-react";
import { useEffect, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import Link from "next/link";

export default function Navbar() {
  const [open, setOpen] = useState(false);
  const { user, logout, isAdmin } = useAuth();

  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  const navLinks = [
    { label: "Accueil", href: "/" },
    { label: "Nos appartements", href: "/rooms" },
  ];

  if (user) {
    if (isAdmin) {
      navLinks.push({ label: "Back-office", href: "/admin" });
    }
    navLinks.push({ label: "Mon Espace", href: "/espace-client" });
  } else {
    navLinks.push({ label: "Connexion", href: "/auth/login" });
  }

  return (
    <>
      <motion.header
        initial={{ y: -80 }}
        animate={{ y: 0 }}
        transition={{ duration: 0.9, ease: [0.22, 1, 0.36, 1] }}
        className="fixed inset-x-0 top-0 z-[90] bg-black px-5 py-5 text-white md:px-8"
      >
        <nav className="relative mx-auto flex max-w-7xl items-center justify-between">
          <Link
            href={user ? "/espace-client" : "/rooms"}
            className="hidden text-[11px] font-semibold uppercase tracking-[0.36em] md:block text-white"
          >
            {user ? "Mon Espace" : "Reserver"}
          </Link>

          <Link
            href="/"
            className="absolute left-1/2 -translate-x-1/2 font-display text-xl font-semibold uppercase tracking-[0.32em] md:text-2xl text-white"
          >
            Le Manoir
          </Link>

          <button
            type="button"
            aria-label={open ? "Fermer le menu" : "Ouvrir le menu"}
            aria-expanded={open}
            onClick={() => setOpen((current) => !current)}
            className="ml-auto grid size-11 place-items-center border border-white/70 transition hover:bg-white hover:text-black"
          >
            {open ? <X size={21} /> : <Menu size={21} />}
          </button>
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
            className="fixed inset-0 z-[100] bg-white text-bark"
          >
            <div className="mx-auto flex min-h-screen max-w-7xl flex-col justify-between px-6 pb-10 pt-24 md:px-10 md:pb-14">
              <motion.div
                initial="hidden"
                animate="visible"
                exit="hidden"
                variants={{
                  hidden: {},
                  visible: { transition: { staggerChildren: 0.085, delayChildren: 0.25 } }
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
                        transition: { duration: 0.75, ease: [0.22, 1, 0.36, 1] }
                      }
                    }}
                  >
                    <Link
                      href={link.href}
                      onClick={() => setOpen(false)}
                      className="group flex items-center gap-5 border-b border-bark/15 py-3 font-display text-[clamp(2rem,6vw,5rem)] uppercase leading-[0.9] tracking-[-0.02em] text-bark"
                    >
                      <span className="w-10 pb-2 text-xs font-semibold tracking-[0.3em] opacity-50">
                        0{index + 1}
                      </span>
                      <span className="transition-transform duration-500 group-hover:translate-x-4">
                        {link.label}
                      </span>
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
                        transition: { duration: 0.75, ease: [0.22, 1, 0.36, 1] }
                      }
                    }}
                  >
                    <button
                      onClick={() => {
                        setOpen(false);
                        logout();
                      }}
                      className="group flex w-full items-center gap-5 border-b border-bark/15 py-3 font-display text-[clamp(2rem,6vw,5rem)] uppercase leading-[0.9] tracking-[-0.02em] text-left text-terracotta hover:text-terracotta-light"
                    >
                      <span className="w-10 pb-2 text-xs font-semibold tracking-[0.3em] opacity-50">
                        0{navLinks.length + 1}
                      </span>
                      <span className="flex items-center gap-4 transition-transform duration-500 group-hover:translate-x-4">
                        Déconnexion <LogOut size={28} className="inline" />
                      </span>
                    </button>
                  </motion.div>
                )}
              </motion.div>

              <div className="flex flex-col gap-3 text-xs uppercase tracking-[0.3em] text-bark/55 md:flex-row md:justify-between">
                <span>{user ? `Connecté : ${user.name}` : "Maison privée / Suites / Table"}</span>
                <span>Cotonou, Benin</span>
              </div>
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </>
  );
}
