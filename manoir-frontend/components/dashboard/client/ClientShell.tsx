"use client";

import { AnimatePresence, motion } from "framer-motion";
import {
  BedDouble,
  CalendarCheck2,
  ChevronDown,
  Home,
  LifeBuoy,
  LogOut,
  Menu,
  PanelLeftClose,
  PanelLeftOpen,
  Receipt,
  UserRound,
  Wallet,
  X
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useRef, useState, type ComponentType, type ReactNode } from "react";
import NotificationBell from "@/components/ui/NotificationBell";
import ThemeToggle from "@/components/ui/ThemeToggle";
import { useAuth } from "@/context/AuthContext";
import { isAdminUser } from "@/lib/roles";
import { contactMailto, initialsOf } from "@/lib/site";
import { cn } from "@/lib/utils";

type NavItem = {
  label: string;
  href: string;
  icon: ComponentType<{ size?: number; className?: string }>;
  external?: boolean;
  /** Correspondance personnalisée de l'état actif. */
  match?: (pathname: string, tab: string | null) => boolean;
};

const navItems: NavItem[] = [
  {
    label: "Accueil",
    href: "/espace-client",
    icon: Home,
    match: (p) => p === "/espace-client"
  },
  {
    label: "Mes réservations",
    href: "/espace-client/reservations",
    icon: CalendarCheck2,
    match: (p) => p.startsWith("/espace-client/reservations")
  },
  {
    label: "Paiements",
    href: "/espace-client/paiements",
    icon: Wallet,
    match: (p) => p.startsWith("/espace-client/paiements")
  },
  {
    label: "Factures",
    href: "/espace-client/factures",
    icon: Receipt,
    match: (p) => p.startsWith("/espace-client/factures")
  },
  {
    label: "Données personnelles",
    href: "/espace-client/profil",
    icon: UserRound,
    match: (p) => p.startsWith("/espace-client/profil")
  },
  { label: "Réserver un séjour", href: "/rooms", icon: BedDouble },
  {
    label: "Aide & contact",
    href: contactMailto("Assistance espace client | Le Manoir"),
    icon: LifeBuoy,
    external: true
  }
];

const COLLAPSE_KEY = "manoir:client-sidebar-collapsed";

export default function ClientShell({ children }: { children: ReactNode }) {
  const { user, loading, loggingOut, logout } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const isAdmin = isAdminUser(user);

  // Préférence d'affichage mémorisée par navigateur (confort uniquement).
  useEffect(() => {
    try {
      setCollapsed(localStorage.getItem(COLLAPSE_KEY) === "1");
    } catch {
      /* stockage indisponible */
    }
  }, []);

  const toggleCollapsed = () => {
    setCollapsed((value) => {
      try {
        localStorage.setItem(COLLAPSE_KEY, value ? "0" : "1");
      } catch {
        /* stockage indisponible */
      }
      return !value;
    });
  };

  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  useEffect(() => {
    document.body.style.overflow = mobileOpen ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [mobileOpen]);

  useEffect(() => {
    // Pendant une déconnexion, on part vers l'accueil : surtout pas vers le login.
    if (!loading && !user && !loggingOut) {
      const target =
        typeof window !== "undefined"
          ? window.location.pathname + window.location.search
          : "/espace-client";
      router.replace(`/auth/login?redirect=${encodeURIComponent(target)}`);
    }
  }, [loading, user, loggingOut, router]);

  // Un administrateur ne reste jamais dans l'espace client.
  useEffect(() => {
    if (loading || !user || loggingOut) return;
    if (isAdmin) router.replace("/admin");
  }, [loading, user, loggingOut, isAdmin, router]);

  // Accès à l'espace client : adresse confirmée puis téléphone renseigné
  // (comptes Google). L'API refuse de toute façon ces sessions incomplètes.
  const emailUnverified = Boolean(user && user.email_verified_at === null);
  // Les administrateurs sont dispenses du numero de telephone.
  const profileIncomplete = Boolean(user && !isAdmin && user.profile_completed === false);

  useEffect(() => {
    if (loading || !user || loggingOut || isAdmin) return;
    const here = window.location.pathname + window.location.search;
    if (emailUnverified) {
      router.replace(
        `/auth/confirmer-email?email=${encodeURIComponent(user.email)}&redirect=${encodeURIComponent(here)}`
      );
    } else if (profileIncomplete) {
      router.replace(`/auth/register?etape=telephone&redirect=${encodeURIComponent(here)}`);
    }
  }, [loading, user, loggingOut, isAdmin, emailUnverified, profileIncomplete, router]);

  if (loading || !user || isAdmin || emailUnverified || profileIncomplete) {
    return (
      <div className="grid min-h-screen place-items-center">
        <div className="flex flex-col items-center gap-4">
          <span className="size-10 animate-spin rounded-full border-[3px] border-gold border-t-transparent" />
          <p className="text-sm text-cream/55">Chargement de votre espace…</p>
        </div>
      </div>
    );
  }

  return (
    <div className="relative min-h-screen text-cream">
      <ClientHeader onOpenMenu={() => setMobileOpen(true)} />

      {/* Décalage de la hauteur de la navbar fixe (72px). */}
      <div className="flex pt-[72px]">
        {/* Sidebar desktop */}
        <aside
          className={cn(
            "sticky top-[72px] hidden h-[calc(100vh-72px)] shrink-0 border-r border-gold/15 transition-[width] duration-300 lg:block",
            collapsed ? "w-[88px]" : "w-[280px]"
          )}
        >
          <Suspense fallback={null}>
            <SidebarContent
              collapsed={collapsed}
              onToggle={toggleCollapsed}
              onLogout={() => logout()}
            />
          </Suspense>
        </aside>

        {/* Drawer mobile */}
        <AnimatePresence>
          {mobileOpen && (
            <div className="fixed inset-0 z-[120] lg:hidden">
              <motion.button
                type="button"
                aria-label="Fermer le menu"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => setMobileOpen(false)}
                className="absolute inset-0 bg-night/70 backdrop-blur-sm"
              />
              <motion.aside
                initial={{ x: "-100%" }}
                animate={{ x: 0 }}
                exit={{ x: "-100%" }}
                transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
                className="glass-warm relative h-full w-[86%] max-w-[320px] !rounded-none !border-y-0 !border-l-0"
              >
                <button
                  type="button"
                  onClick={() => setMobileOpen(false)}
                  aria-label="Fermer le menu"
                  className="absolute right-4 top-5 grid size-9 place-items-center rounded-full border border-gold/25 text-cream"
                >
                  <X size={17} />
                </button>
                <Suspense fallback={null}>
                  <SidebarContent collapsed={false} onLogout={() => logout()} />
                </Suspense>
              </motion.aside>
            </div>
          )}
        </AnimatePresence>

        <main className="min-w-0 flex-1 overflow-x-clip px-4 pb-16 pt-6 sm:px-6 lg:px-10 lg:pt-10">
          <div className="mx-auto w-full max-w-6xl">{children}</div>
        </main>
      </div>
    </div>
  );
}

function SidebarContent({
  collapsed,
  onToggle,
  onLogout
}: {
  collapsed: boolean;
  onToggle?: () => void;
  onLogout: () => void;
}) {
  const pathname = usePathname() || "";
  const tab = useSearchParams()?.get("onglet") ?? null;

  return (
    <div className="flex h-full flex-col">
      <div
        className={cn(
          "flex items-center gap-3 border-b border-gold/15 px-6 py-7",
          collapsed ? "justify-center px-3" : "justify-between"
        )}
      >
        {!collapsed && (
          <p className="font-display text-[1.45rem] font-semibold uppercase leading-[1.05] tracking-[0.02em] text-gradient-gold">
            Espace
            <br />
            Client
          </p>
        )}
        {onToggle && (
          <button
            type="button"
            onClick={onToggle}
            aria-label={collapsed ? "Déplier le menu" : "Replier le menu"}
            title={collapsed ? "Déplier le menu" : "Replier le menu"}
            className="grid size-11 place-items-center rounded-xl border border-gold/20 bg-white/5 text-cream/80 transition hover:border-gold/50 hover:text-gold-light"
          >
            {collapsed ? <PanelLeftOpen size={20} /> : <PanelLeftClose size={20} />}
          </button>
        )}
      </div>

      <nav className="flex-1 space-y-1.5 overflow-y-auto px-4 py-6" aria-label="Espace client">
        {navItems.map((item) => {
          const active = item.match ? item.match(pathname, tab) : false;
          const classes = cn(
            "group flex items-center gap-3.5 rounded-xl px-3.5 py-3 text-[14px] font-semibold transition",
            collapsed && "justify-center px-0",
            active
              ? "bg-gradient-to-br from-gold-light to-gold text-night shadow-[0_10px_26px_-12px_rgba(201,164,92,0.9)] ring-1 ring-gold/60 ring-offset-2 ring-offset-transparent"
              : "text-cream/75 hover:bg-white/5 hover:text-cream"
          );
          const content = (
            <>
              <item.icon
                size={20}
                className={cn("shrink-0", !active && "text-gold/80 group-hover:text-gold-light")}
              />
              {!collapsed && <span className="truncate">{item.label}</span>}
            </>
          );

          return item.external ? (
            <a
              key={item.label}
              href={item.href}
              className={classes}
              title={collapsed ? item.label : undefined}
            >
              {content}
            </a>
          ) : (
            <Link
              key={item.label}
              href={item.href}
              className={classes}
              aria-current={active ? "page" : undefined}
              title={collapsed ? item.label : undefined}
            >
              {content}
            </Link>
          );
        })}
      </nav>

      <div className="border-t border-gold/15 p-4">
        <button
          type="button"
          onClick={onLogout}
          title={collapsed ? "Déconnexion" : undefined}
          className={cn(
            "flex w-full items-center gap-3.5 rounded-xl bg-red-600 px-3.5 py-3 text-[14px] font-semibold text-white shadow-[0_10px_24px_-12px_rgba(220,38,38,0.8)] transition hover:bg-red-700",
            collapsed && "justify-center px-0"
          )}
        >
          <LogOut size={20} />
          {!collapsed && "Déconnexion"}
        </button>
      </div>
    </div>
  );
}

function ClientHeader({ onOpenMenu }: { onOpenMenu: () => void }) {
  const { user, logout } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!menuOpen) return;
    const onClick = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) setMenuOpen(false);
    };
    const onKey = (event: KeyboardEvent) => event.key === "Escape" && setMenuOpen(false);
    document.addEventListener("mousedown", onClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [menuOpen]);

  return (
    <header className="glass-warm !fixed inset-x-0 top-0 z-[90] h-[72px] !rounded-none !border-x-0 !border-t-0">
      <div className="flex h-full items-center justify-between gap-3 px-4 sm:px-6 lg:px-8">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onOpenMenu}
            aria-label="Ouvrir le menu"
            className="grid size-10 place-items-center rounded-xl border border-gold/25 bg-white/5 text-cream lg:hidden"
          >
            <Menu size={19} />
          </button>
          <Link href="/" className="flex items-center gap-3">
            <span className="grid size-10 place-items-center overflow-hidden rounded-full border border-gold/30 bg-cream sm:size-11">
              <Image
                src="/assets/logo.jpg"
                alt="Le Manoir"
                width={44}
                height={44}
                className="size-full object-cover"
              />
            </span>
            <span className="hidden leading-tight sm:block">
              <span className="block font-display text-[15px] font-semibold uppercase tracking-[0.3em]">
                Le Manoir
              </span>
              <span className="block text-[10px] uppercase tracking-[0.22em] text-cream/50">
                Maison d'hôtes · Cotonou
              </span>
            </span>
          </Link>
        </div>

        <div className="flex items-center gap-2 sm:gap-3">
          <nav className="mr-2 hidden items-center gap-6 text-[12px] font-bold uppercase tracking-[0.16em] text-cream/75 xl:flex">
            <Link href="/comment-reserver" className="transition hover:text-gold-light">
              Comment ça marche ?
            </Link>
            <Link href="/rooms" className="transition hover:text-gold-light">
              Nos appartements
            </Link>
            <a
              href={contactMailto("Support | Le Manoir")}
              className="transition hover:text-gold-light"
            >
              Support
            </a>
          </nav>

          <NotificationBell />
          <ThemeToggle />

          <div ref={menuRef} className="relative">
            <button
              type="button"
              onClick={() => setMenuOpen((value) => !value)}
              aria-expanded={menuOpen}
              aria-haspopup="menu"
              className="flex items-center gap-1.5 rounded-full border border-gold/25 bg-white/5 p-1 pr-2 transition hover:border-gold/50"
            >
              <span className="grid size-8 place-items-center rounded-full bg-gradient-to-br from-gold-light to-gold text-xs font-bold text-night">
                {initialsOf(user?.name)}
              </span>
              <ChevronDown
                size={14}
                className={cn("text-cream/60 transition", menuOpen && "rotate-180")}
              />
            </button>

            <AnimatePresence>
              {menuOpen && (
                <motion.div
                  role="menu"
                  initial={{ opacity: 0, y: -6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -6 }}
                  transition={{ duration: 0.18 }}
                  className="admin-panel absolute right-0 top-[calc(100%+18px)] z-[95] w-64 origin-top-right overflow-hidden rounded-2xl border border-gold/20 p-2 shadow-glass-lg"
                >
                  <div className="border-b border-gold/15 px-3 pb-3 pt-2">
                    <p className="truncate text-sm font-semibold text-cream">{user?.name}</p>
                    <p className="truncate text-xs text-cream/55">{user?.email}</p>
                  </div>
                  <div className="py-1.5 text-sm">
                    <MenuLink href="/espace-client/profil" onClick={() => setMenuOpen(false)}>
                      Mon profil
                    </MenuLink>
                    <MenuLink href="/espace-client/reservations" onClick={() => setMenuOpen(false)}>
                      Mes réservations
                    </MenuLink>
                    <MenuLink href="/" onClick={() => setMenuOpen(false)}>
                      Retour au site
                    </MenuLink>
                  </div>
                  <button
                    type="button"
                    role="menuitem"
                    onClick={() => logout()}
                    className="flex w-full items-center justify-center gap-2 rounded-xl bg-red-600 px-3 py-2.5 text-sm font-semibold text-white transition hover:bg-red-700"
                  >
                    <LogOut size={16} /> Déconnexion
                  </button>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>
    </header>
  );
}

function MenuLink({
  href,
  children,
  onClick
}: {
  href: string;
  children: ReactNode;
  onClick: () => void;
}) {
  return (
    <Link
      href={href}
      role="menuitem"
      onClick={onClick}
      className="block rounded-xl px-3 py-2 text-cream/80 transition hover:bg-white/5 hover:text-cream"
    >
      {children}
    </Link>
  );
}

/** En-tête de page homogène dans l'espace client. */
export function ClientPageHeader({
  title,
  description,
  action
}: {
  title: ReactNode;
  description?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <h1 className="font-display text-[clamp(1.8rem,4vw,2.6rem)] font-semibold leading-[1.05] tracking-[-0.02em] text-cream">
          {title}
        </h1>
        {description && (
          <p className="mt-2 max-w-2xl text-[15px] leading-6 text-cream/60">{description}</p>
        )}
      </div>
      {action}
    </div>
  );
}
