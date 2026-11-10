"use client";

import { AnimatePresence, motion } from "framer-motion";
import {
  BedDouble,
  CalendarRange,
  ChevronDown,
  ExternalLink,
  FileDown,
  LayoutGrid,
  LogOut,
  Menu,
  Search,
  UserRound,
  Users,
  X
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState, type ComponentType, type FormEvent, type ReactNode } from "react";
import NotificationBell from "@/components/ui/NotificationBell";
import ThemeToggle from "@/components/ui/ThemeToggle";
import { useAuth } from "@/context/AuthContext";
import { initialsOf } from "@/lib/site";
import { cn } from "@/lib/utils";

type NavItem = {
  label: string;
  href: string;
  icon: ComponentType<{ size?: number; className?: string }>;
  exact?: boolean;
};

const menu: { title: string; items: NavItem[] }[] = [
  {
    title: "Menu",
    items: [
      { label: "Tableau de bord", href: "/admin", icon: LayoutGrid, exact: true },
      { label: "Réservations", href: "/admin/reservations", icon: CalendarRange },
      { label: "Appartements", href: "/admin/rooms", icon: BedDouble },
      { label: "Utilisateurs", href: "/admin/users", icon: Users }
    ]
  },
  {
    title: "Site",
    items: [{ label: "Voir le site", href: "/", icon: ExternalLink, exact: true }]
  }
];

/**
 * Coquille du back-office, portée du template TailAdmin
 * (free-nextjs-admin-dashboard) : sidebar repliable qui s'ouvre au survol,
 * tiroir mobile, en-tête collant avec recherche ⌘K, thème, notifications et
 * menu utilisateur — habillée aux couleurs du Manoir.
 */
export default function AdminShell({ children }: { children: ReactNode }) {
  const { user, loading, loggingOut } = useAuth();
  const router = useRouter();
  const pathname = usePathname() || "/admin";
  const [expanded, setExpanded] = useState(true);
  const [hovered, setHovered] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  const showLabels = expanded || hovered || mobileOpen;

  useEffect(() => {
    if (loading || loggingOut) return;
    if (!user) router.replace(`/auth/login?redirect=${encodeURIComponent(pathname)}`);
    else if (!user.is_admin) router.replace("/espace-client");
  }, [loading, loggingOut, user, router, pathname]);

  useEffect(() => setMobileOpen(false), [pathname]);

  const toggleSidebar = () => {
    if (window.matchMedia("(min-width: 1024px)").matches) setExpanded((value) => !value);
    else setMobileOpen((value) => !value);
  };

  if (loading || !user?.is_admin) {
    return (
      <div className="grid min-h-screen place-items-center">
        <span className="size-10 animate-spin rounded-full border-[3px] border-gold border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="min-h-screen text-cream lg:flex">
      {/* Voile mobile */}
      <AnimatePresence>
        {mobileOpen && (
          <motion.button
            type="button"
            aria-label="Fermer le menu"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setMobileOpen(false)}
            className="fixed inset-0 z-[99] bg-night/60 backdrop-blur-sm lg:hidden"
          />
        )}
      </AnimatePresence>

      <aside
        onMouseEnter={() => !expanded && setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        className={cn(
          "admin-sidebar fixed left-0 top-0 z-[100] flex h-screen flex-col border-r border-gold/15 px-5 transition-all duration-300 ease-in-out",
          showLabels ? "w-[290px]" : "w-[90px]",
          mobileOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
        )}
      >
        <div className={cn("flex items-center gap-3 py-7", showLabels ? "justify-start" : "justify-center")}>
          <Link href="/admin" className="flex items-center gap-3">
            <span className="grid size-10 shrink-0 place-items-center overflow-hidden rounded-full border border-gold/30 bg-cream">
              <Image src="/assets/logo.jpg" alt="Le Manoir" width={40} height={40} className="size-full object-cover" />
            </span>
            {showLabels && (
              <span className="leading-tight">
                <span className="block font-display text-base font-semibold uppercase tracking-[0.28em]">
                  Le Manoir
                </span>
                <span className="block text-[10px] uppercase tracking-[0.22em] text-cream/50">Back-office</span>
              </span>
            )}
          </Link>
        </div>

        <nav className="flex-1 overflow-y-auto pb-6" aria-label="Administration">
          {menu.map((group) => (
            <div key={group.title} className="mb-6">
              <h2
                className={cn(
                  "mb-3 text-[11px] font-semibold uppercase tracking-[0.18em] text-cream/40",
                  showLabels ? "px-3" : "text-center"
                )}
              >
                {showLabels ? group.title : "···"}
              </h2>
              <ul className="space-y-1">
                {group.items.map((item) => {
                  const active = item.exact ? pathname === item.href : pathname.startsWith(item.href);
                  return (
                    <li key={item.href}>
                      <Link
                        href={item.href}
                        title={!showLabels ? item.label : undefined}
                        aria-current={active ? "page" : undefined}
                        className={cn(
                          "group flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition",
                          !showLabels && "justify-center",
                          active
                            ? "bg-gold/15 text-gold-light"
                            : "text-cream/70 hover:bg-white/5 hover:text-cream"
                        )}
                      >
                        <item.icon
                          size={22}
                          className={cn("shrink-0", active ? "text-gold-light" : "text-cream/50 group-hover:text-cream")}
                        />
                        {showLabels && <span>{item.label}</span>}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </nav>

        {showLabels && (
          <div className="mb-6 rounded-2xl border border-gold/15 bg-white/5 p-4 text-center">
            <FileDown className="mx-auto mb-2 text-gold-light" size={22} />
            <p className="text-sm font-semibold text-cream">Rapport des réservations</p>
            <p className="mt-1 text-xs leading-5 text-cream/55">
              Filtrez puis exportez la liste au format PDF.
            </p>
            <Link
              href="/admin/reservations"
              className="mt-3 inline-flex w-full items-center justify-center rounded-lg bg-gradient-to-br from-gold-light to-gold px-3 py-2 text-xs font-bold text-night transition hover:brightness-105"
            >
              Ouvrir les réservations
            </Link>
          </div>
        )}
      </aside>

      <div
        className={cn(
          "flex min-w-0 flex-1 flex-col transition-all duration-300 ease-in-out",
          expanded ? "lg:ml-[290px]" : "lg:ml-[90px]"
        )}
      >
        <AdminHeader mobileOpen={mobileOpen} onToggle={toggleSidebar} />
        <main className="mx-auto w-full min-w-0 max-w-screen-2xl overflow-x-clip p-4 md:p-6">{children}</main>
      </div>
    </div>
  );
}

function AdminHeader({ mobileOpen, onToggle }: { mobileOpen: boolean; onToggle: () => void }) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState("");

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        inputRef.current?.focus();
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, []);

  const onSearch = (event: FormEvent) => {
    event.preventDefault();
    const value = query.trim();
    router.push(value ? `/admin/reservations?q=${encodeURIComponent(value)}` : "/admin/reservations");
  };

  return (
    <header className="admin-header sticky top-0 z-[90] flex w-full border-b border-gold/15">
      <div className="flex w-full items-center justify-between gap-3 px-3 py-3 sm:px-4 lg:px-6 lg:py-4">
        <div className="flex flex-1 items-center gap-3">
          <button
            type="button"
            onClick={onToggle}
            aria-label="Afficher / masquer le menu"
            className="grid size-10 shrink-0 place-items-center rounded-lg border border-gold/20 text-cream/70 transition hover:text-cream lg:size-11"
          >
            {mobileOpen ? <X size={20} /> : <Menu size={20} />}
          </button>

          <form onSubmit={onSearch} className="hidden w-full max-w-[430px] md:block">
            <label className="relative block">
              <Search size={18} className="pointer-events-none absolute left-4 top-1/2 z-10 -translate-y-1/2 text-cream/50" />
              <input
                ref={inputRef}
                type="search"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Rechercher un client, un e-mail, une réservation…"
                className="glass-input h-11 w-full rounded-lg pl-11 pr-16 text-sm"
              />
              <kbd className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded-md border border-gold/20 bg-white/5 px-1.5 py-0.5 text-[11px] text-cream/50">
                Ctrl K
              </kbd>
            </label>
          </form>
        </div>

        <div className="flex items-center gap-2 sm:gap-3">
          <ThemeToggle />
          <NotificationBell />
          <UserMenu />
        </div>
      </div>
    </header>
  );
}

function UserMenu() {
  const { user, logout } = useAuth();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onClick = (event: MouseEvent) => {
      if (ref.current && !ref.current.contains(event.target as Node)) setOpen(false);
    };
    const onKey = (event: KeyboardEvent) => event.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", onClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        aria-haspopup="menu"
        className="flex items-center gap-2 rounded-full p-0.5 pr-1 text-cream/80"
      >
        <span className="grid size-10 place-items-center rounded-full bg-gradient-to-br from-gold-light to-gold text-sm font-bold text-night">
          {initialsOf(user?.name)}
        </span>
        <span className="hidden max-w-[140px] truncate text-sm font-medium sm:block">{user?.name?.split(" ")[0]}</span>
        <ChevronDown size={16} className={cn("hidden transition sm:block", open && "rotate-180")} />
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            role="menu"
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.16 }}
            className="admin-panel absolute right-0 top-[calc(100%+12px)] w-[260px] rounded-2xl border border-gold/15 p-3 shadow-glass-lg"
          >
            <div className="px-2 pb-3">
              <p className="truncate text-sm font-semibold text-cream">{user?.name}</p>
              <p className="truncate text-xs text-cream/55">{user?.email}</p>
              <p className="mt-1 text-[11px] uppercase tracking-wider text-gold-light">
                {user?.is_super_admin ? "Super administrateur" : "Administrateur"}
              </p>
            </div>
            <div className="space-y-1 border-y border-gold/10 py-2 text-sm">
              <Link href="/admin/users" onClick={() => setOpen(false)} className="flex items-center gap-3 rounded-lg px-2 py-2 text-cream/75 hover:bg-white/5 hover:text-cream">
                <UserRound size={18} /> Utilisateurs
              </Link>
              <Link href="/" onClick={() => setOpen(false)} className="flex items-center gap-3 rounded-lg px-2 py-2 text-cream/75 hover:bg-white/5 hover:text-cream">
                <ExternalLink size={18} /> Voir le site
              </Link>
            </div>
            <button
              type="button"
              role="menuitem"
              onClick={() => logout()}
              className="mt-2 flex w-full items-center justify-center gap-3 rounded-lg bg-red-600 px-2 py-2.5 text-sm font-semibold text-white transition hover:bg-red-700"
            >
              <LogOut size={18} /> Déconnexion
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/** Fil d'Ariane + titre de page (équivalent du PageBreadcrumb de TailAdmin). */
export function AdminPageHeader({ title, action }: { title: string; action?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
      <h1 className="font-display text-xl font-semibold text-cream sm:text-2xl">{title}</h1>
      <div className="flex items-center gap-3">
        {action}
        <nav aria-label="Fil d'Ariane">
          <ol className="flex items-center gap-1.5 text-sm text-cream/50">
            <li>
              <Link href="/admin" className="hover:text-gold-light">
                Accueil
              </Link>
            </li>
            <li aria-hidden>/</li>
            <li className="text-cream/80">{title}</li>
          </ol>
        </nav>
      </div>
    </div>
  );
}

/** Carte de base du back-office (équivalent ComponentCard de TailAdmin). */
export function AdminCard({ className, children }: { className?: string; children: ReactNode }) {
  return <div className={cn("admin-card rounded-2xl border border-gold/15", className)}>{children}</div>;
}
