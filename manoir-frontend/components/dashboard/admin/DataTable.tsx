"use client";

import {
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  ChevronsUpDown,
  Inbox,
  RotateCcw,
  Search
} from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState, type ComponentType, type ReactNode } from "react";
import { cn } from "@/lib/utils";

/*
 * Tableau de données au style du template « TailAdmin » (free-nextjs-admin-
 * dashboard) : carte arrondie, en-tête titre + recherche, lignes aérées,
 * badges clairs et pagination à boutons carrés. Les couleurs reprennent la
 * charte du Manoir (or / crème) pour fonctionner en thème clair et sombre.
 */

export type SortDirection = "asc" | "desc";

export interface DataTableColumn<T> {
  /** Identifiant unique de la colonne. */
  key: string;
  header: ReactNode;
  /** Clé de tri : la colonne n'est triable que si elle est renseignée. */
  sortKey?: string;
  align?: "left" | "center" | "right";
  /** Classes de la cellule (td). */
  className?: string;
  /** Classes de l'en-tête (th). */
  headerClassName?: string;
  render: (row: T) => ReactNode;
}

export interface DataTableProps<T> {
  columns: DataTableColumn<T>[];
  rows: T[];
  rowKey: (row: T) => string | number;
  rowClassName?: (row: T) => string | undefined;
  loading?: boolean;
  error?: string | null;
  /** Titre de la carte (à gauche de la recherche). */
  title?: ReactNode;
  description?: ReactNode;
  emptyTitle?: string;
  emptyMessage?: string;

  /** Recherche globale (valeur appliquée). La saisie est temporisée de `searchDelay` ms. */
  search: string;
  onSearchChange: (value: string) => void;
  searchPlaceholder?: string;
  searchDelay?: number;

  sort: string;
  direction: SortDirection;
  onSortChange: (sort: string, direction: SortDirection) => void;

  /** Pagination (`current_page`, `last_page`, `total`, `from`, `to`). */
  page: number;
  lastPage: number;
  total: number;
  from: number | null;
  to: number | null;
  perPage: number;
  perPageOptions?: number[];
  onPageChange: (page: number) => void;
  onPerPageChange: (perPage: number) => void;

  /** Filtres supplémentaires affichés sous l'en-tête. */
  filters?: ReactNode;
  /** Boutons à droite de la recherche (export, etc.). */
  actions?: ReactNode;
  /** Bouton « Réinitialiser » : remet recherche, filtres, tri et pagination à zéro. */
  onReset?: () => void;
  resetLabel?: string;
  /** Désactive le bouton quand rien n'est filtré. */
  canReset?: boolean;
  /** Largeur minimale du tableau (défile horizontalement en dessous). */
  minWidth?: string;
}

const alignClass = { left: "text-left", center: "text-center", right: "text-right" } as const;

/** Pages à afficher, comme le template : 1 2 3 4 5 … 12 */
function pageWindow(current: number, last: number): (number | "gap-start" | "gap-end")[] {
  if (last <= 7) return Array.from({ length: last }, (_, index) => index + 1);
  if (current <= 4) return [1, 2, 3, 4, 5, "gap-end", last];
  if (current >= last - 3) return [1, "gap-start", last - 4, last - 3, last - 2, last - 1, last];
  return [1, "gap-start", current - 1, current, current + 1, "gap-end", last];
}

const pagerButton =
  "inline-flex size-10 items-center justify-center rounded-lg border border-gold/15 text-sm font-medium text-cream/70 transition hover:border-gold/40 hover:bg-white/5 hover:text-gold-light disabled:pointer-events-none disabled:opacity-40";

/**
 * Tableau piloté par le parent (recherche, tri et pagination). Pour une
 * liste déjà chargée en mémoire, utiliser `useLocalTable`.
 */
export default function DataTable<T>({
  columns,
  rows,
  rowKey,
  rowClassName,
  loading = false,
  error,
  title,
  description,
  emptyTitle = "Aucun résultat",
  emptyMessage = "Modifiez votre recherche ou vos filtres pour trouver ce que vous cherchez.",
  search,
  onSearchChange,
  searchPlaceholder = "Rechercher…",
  searchDelay = 300,
  sort,
  direction,
  onSortChange,
  page,
  lastPage,
  total,
  from,
  to,
  perPage,
  perPageOptions = [10, 25, 50],
  onPageChange,
  onPerPageChange,
  filters,
  actions,
  onReset,
  resetLabel = "Réinitialiser",
  canReset = true,
  minWidth = "760px"
}: DataTableProps<T>) {
  const [draft, setDraft] = useState(search);
  const onSearchChangeRef = useRef(onSearchChange);
  onSearchChangeRef.current = onSearchChange;

  // Valeur appliquée modifiée de l'extérieur (réinitialisation, lien profond).
  useEffect(() => {
    setDraft((current) => (current.trim() === search ? current : search));
  }, [search]);

  useEffect(() => {
    if (draft.trim() === search) return;
    const timer = window.setTimeout(() => onSearchChangeRef.current(draft.trim()), searchDelay);
    return () => window.clearTimeout(timer);
  }, [draft, search, searchDelay]);

  const toggleSort = (column: DataTableColumn<T>) => {
    if (!column.sortKey) return;
    if (sort === column.sortKey) onSortChange(column.sortKey, direction === "asc" ? "desc" : "asc");
    else onSortChange(column.sortKey, "asc");
  };

  const safeLast = Math.max(1, lastPage);
  const showSkeleton = loading && rows.length === 0;

  return (
    <div className="admin-card dt-line w-full min-w-0 overflow-hidden rounded-2xl border">
      {/* En-tête : titre, recherche, actions */}
      <div className="flex flex-col gap-4 px-5 py-4 sm:px-6 lg:flex-row lg:items-center lg:justify-between">
        {(title || description) && (
          <div className="min-w-0">
            {title && <h3 className="text-lg font-semibold text-cream">{title}</h3>}
            {description && <p className="mt-0.5 text-sm text-cream/50">{description}</p>}
          </div>
        )}

        <div
          className={cn(
            "flex w-full flex-col gap-3 sm:flex-row sm:items-center lg:w-auto",
            !title && !description && "lg:w-full lg:justify-between"
          )}
        >
          <label className="relative block w-full sm:w-[300px]">
            <span className="sr-only">Recherche</span>
            <Search
              size={18}
              className="pointer-events-none absolute left-3.5 top-1/2 z-10 -translate-y-1/2 text-cream/40"
            />
            <input
              type="search"
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") onSearchChangeRef.current(draft.trim());
              }}
              placeholder={searchPlaceholder}
              className="glass-input h-10 w-full rounded-lg pl-11 pr-4 text-sm outline-none"
            />
          </label>

          {(onReset || actions) && (
            <div className="flex flex-wrap items-center gap-2">
              {onReset && (
                <button
                  type="button"
                  onClick={onReset}
                  disabled={!canReset}
                  className="inline-flex h-10 items-center gap-2 rounded-lg border border-gold/20 px-4 text-sm font-medium text-cream/70 transition hover:border-gold/50 hover:text-gold-light disabled:cursor-not-allowed disabled:opacity-40"
                >
                  <RotateCcw size={15} />
                  {resetLabel}
                </button>
              )}
              {actions}
            </div>
          )}
        </div>
      </div>

      {filters && (
        <div className="dt-line grid gap-3 border-t px-5 py-4 sm:grid-cols-2 sm:px-6 xl:grid-cols-4">
          {filters}
        </div>
      )}

      {/* Tableau */}
      <div className="relative px-5 pb-1 sm:px-6">
        <div className="max-w-full overflow-x-auto">
          <table className="dt-grid w-full border-collapse" style={{ minWidth }}>
            <thead>
              <tr>
                {columns.map((column) => {
                  const active = column.sortKey && sort === column.sortKey;
                  const SortIcon = active
                    ? direction === "asc"
                      ? ChevronUp
                      : ChevronDown
                    : ChevronsUpDown;
                  return (
                    <th
                      key={column.key}
                      scope="col"
                      aria-sort={
                        active ? (direction === "asc" ? "ascending" : "descending") : undefined
                      }
                      className={cn(
                        "h-12 whitespace-nowrap px-5 py-3 text-sm font-medium text-cream/70",
                        alignClass[column.align ?? "left"],
                        column.headerClassName
                      )}
                    >
                      {column.sortKey ? (
                        <button
                          type="button"
                          onClick={() => toggleSort(column)}
                          className={cn(
                            "flex w-full items-center justify-between gap-3 transition hover:text-gold-light",
                            active && "text-gold-light"
                          )}
                        >
                          {column.header}
                          <SortIcon
                            size={14}
                            className={cn("shrink-0", active ? "" : "opacity-40")}
                          />
                        </button>
                      ) : (
                        column.header
                      )}
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody className={cn("transition-opacity", loading && !showSkeleton && "opacity-50")}>
              {showSkeleton &&
                Array.from({ length: Math.min(perPage, 5) }, (_, index) => (
                  <tr key={`skeleton-${index}`} className="h-16">
                    <td colSpan={columns.length} className="px-5 py-3">
                      <div className="h-8 animate-pulse rounded-lg bg-white/5" />
                    </td>
                  </tr>
                ))}

              {!showSkeleton &&
                rows.map((row) => (
                  <tr
                    key={rowKey(row)}
                    className={cn("h-16 transition hover:bg-white/[0.03]", rowClassName?.(row))}
                  >
                    {columns.map((column) => (
                      <td
                        key={column.key}
                        className={cn(
                          "whitespace-nowrap px-5 py-3 align-middle text-sm text-cream/70",
                          alignClass[column.align ?? "left"],
                          column.className
                        )}
                      >
                        {column.render(row)}
                      </td>
                    ))}
                  </tr>
                ))}

              {!loading && rows.length === 0 && (
                <tr>
                  <td colSpan={columns.length} className="px-6 py-12 text-center">
                    <div className="flex flex-col items-center justify-center">
                      <div className="mb-3 flex size-12 items-center justify-center rounded-full bg-white/5">
                        <Inbox className="size-6 text-cream/80" />
                      </div>
                      {error ? (
                        <p className="text-sm text-terracotta-light">{error}</p>
                      ) : (
                        <>
                          <h4 className="text-base font-semibold text-cream">{emptyTitle}</h4>
                          <p className="mt-1 text-sm text-cream/50">{emptyMessage}</p>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {loading && !showSkeleton && (
          <div className="pointer-events-none absolute inset-0 grid place-items-center">
            <span className="size-8 animate-spin rounded-full border-[3px] border-gold border-t-transparent" />
          </div>
        )}
      </div>

      {/* Pied : taille de page, compteur, pagination */}
      <div className="flex flex-col gap-3 px-5 py-4 text-sm text-cream/60 sm:px-6 md:flex-row md:items-center md:justify-between">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
          <label className="flex items-center gap-2">
            Afficher
            <select
              value={perPage}
              onChange={(event) => onPerPageChange(Number(event.target.value))}
              className="glass-input h-9 rounded-lg px-2.5 text-sm"
              aria-label="Nombre de lignes par page"
            >
              {perPageOptions.map((option) => (
                <option key={option} value={option} className="text-night">
                  {option}
                </option>
              ))}
            </select>
          </label>
          <span aria-live="polite">
            {total > 0
              ? `${from ?? 0}–${to ?? 0} sur ${total.toLocaleString("fr-FR")}`
              : "0 résultat"}
          </span>
        </div>

        {/* Mobile : page courante + précédent / suivant */}
        <div className="flex items-center justify-between sm:hidden">
          <span className="font-medium text-cream/70">
            {page}/{safeLast}
          </span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => onPageChange(page - 1)}
              disabled={page <= 1 || loading}
              className={pagerButton}
              aria-label="Page précédente"
            >
              <ChevronLeft size={18} />
            </button>
            <button
              type="button"
              onClick={() => onPageChange(page + 1)}
              disabled={page >= safeLast || loading}
              className={pagerButton}
              aria-label="Page suivante"
            >
              <ChevronRight size={18} />
            </button>
          </div>
        </div>

        {/* Bureau : pagination complète */}
        <nav aria-label="Pagination" className="hidden items-center gap-1.5 sm:flex">
          <button
            type="button"
            onClick={() => onPageChange(page - 1)}
            disabled={page <= 1 || loading}
            className={pagerButton}
            aria-label="Page précédente"
          >
            <ChevronLeft size={18} />
          </button>
          {pageWindow(page, safeLast).map((item) =>
            typeof item !== "number" ? (
              <span
                key={item}
                className="inline-flex size-10 items-center justify-center text-cream/40"
              >
                …
              </span>
            ) : (
              <button
                key={item}
                type="button"
                onClick={() => onPageChange(item)}
                disabled={loading}
                aria-current={item === page ? "page" : undefined}
                className={cn(
                  pagerButton,
                  item === page &&
                    "border-transparent bg-gradient-to-br from-gold-light to-gold text-night hover:bg-none hover:text-night"
                )}
              >
                {item}
              </button>
            )
          )}
          <button
            type="button"
            onClick={() => onPageChange(page + 1)}
            disabled={page >= safeLast || loading}
            className={pagerButton}
            aria-label="Page suivante"
          >
            <ChevronRight size={18} />
          </button>
        </nav>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------------ */
/*  Tableau local : recherche, tri et pagination en mémoire                  */
/* ------------------------------------------------------------------------ */

export interface LocalTableOptions<T> {
  /** Texte indexé pour la recherche globale. */
  searchText: (row: T) => string;
  /** Valeur de tri par clé de colonne (`sortKey`). */
  sortValue?: (row: T, sortKey: string) => string | number | null | undefined;
  initialSort?: string;
  initialDirection?: SortDirection;
  initialPerPage?: number;
}

const normalize = (value: string) => value.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

/**
 * Pilote un `DataTable` sur une liste déjà chargée : renvoie les props de
 * recherche, tri et pagination à étaler sur le composant.
 */
export function useLocalTable<T>(data: T[], options: LocalTableOptions<T>) {
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState(options.initialSort ?? "");
  const [direction, setDirection] = useState<SortDirection>(options.initialDirection ?? "desc");
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(options.initialPerPage ?? 10);
  const optionsRef = useRef(options);
  optionsRef.current = options;

  const filtered = useMemo(() => {
    const term = normalize(search.trim());
    const matching = term
      ? data.filter((row) => normalize(optionsRef.current.searchText(row)).includes(term))
      : data;
    const sortValue = optionsRef.current.sortValue;
    if (!sort || !sortValue) return matching;
    return [...matching].sort((a, b) => {
      const left = sortValue(a, sort);
      const right = sortValue(b, sort);
      if (left == null && right == null) return 0;
      if (left == null) return 1;
      if (right == null) return -1;
      const order =
        typeof left === "number" && typeof right === "number"
          ? left - right
          : String(left).localeCompare(String(right), "fr", { numeric: true });
      return direction === "asc" ? order : -order;
    });
  }, [data, search, sort, direction]);

  const total = filtered.length;
  const lastPage = Math.max(1, Math.ceil(total / perPage));
  const currentPage = Math.min(page, lastPage);
  const start = (currentPage - 1) * perPage;
  const rows = filtered.slice(start, start + perPage);

  return {
    rows,
    search,
    onSearchChange: (value: string) => {
      setSearch(value);
      setPage(1);
    },
    sort,
    direction,
    onSortChange: (nextSort: string, nextDirection: SortDirection) => {
      setSort(nextSort);
      setDirection(nextDirection);
      setPage(1);
    },
    page: currentPage,
    lastPage,
    total,
    from: total ? start + 1 : null,
    to: total ? start + rows.length : null,
    perPage,
    onPageChange: (next: number) => setPage(Math.min(Math.max(1, next), lastPage)),
    onPerPageChange: (next: number) => {
      setPerPage(next);
      setPage(1);
    }
  };
}

/* ------------------------------------------------------------------------ */
/*  Éléments de cellule                                                       */
/* ------------------------------------------------------------------------ */

export type BadgeTone = "success" | "warning" | "error" | "info" | "neutral";

const badgeTones: Record<BadgeTone, string> = {
  success: "bg-olive/15 text-olive-light",
  warning: "bg-gold/15 text-gold-light",
  error: "bg-terracotta/15 text-terracotta-light",
  info: "bg-sky-500/15 text-sky-400",
  neutral: "bg-white/5 text-cream/70"
};

/** Badge clair (variante « light » du template). */
export function TableBadge({ tone, children }: { tone: BadgeTone; children: ReactNode }) {
  return (
    <span
      className={cn(
        "inline-flex h-6 w-fit shrink-0 items-center justify-center whitespace-nowrap rounded-lg px-2.5 text-xs font-medium",
        badgeTones[tone]
      )}
    >
      {children}
    </span>
  );
}

const iconTones = {
  default: "text-cream/60 hover:border-gold/40 hover:text-gold-light",
  danger: "text-cream/60 hover:border-terracotta/50 hover:text-terracotta-light",
  success: "text-cream/60 hover:border-olive/50 hover:text-olive-light"
} as const;

type IconActionProps = {
  /** Libellé lu par les lecteurs d'écran et affiché au survol. */
  label: string;
  icon: ComponentType<{ size?: number; className?: string }>;
  tone?: keyof typeof iconTones;
  disabled?: boolean;
} & ({ href: string; onClick?: never } | { onClick: () => void; href?: never });

/** Bouton d'action en icône seule (sans texte), avec infobulle. */
export function IconAction({
  label,
  icon: Icon,
  tone = "default",
  disabled,
  ...rest
}: IconActionProps) {
  const className = cn(
    "inline-flex size-9 items-center justify-center rounded-lg border border-gold/15 transition disabled:pointer-events-none disabled:opacity-40",
    iconTones[tone]
  );
  if ("href" in rest && rest.href) {
    return (
      <Link href={rest.href} aria-label={label} title={label} className={className}>
        <Icon size={17} />
      </Link>
    );
  }
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      disabled={disabled}
      onClick={rest.onClick}
      className={className}
    >
      <Icon size={17} />
    </button>
  );
}

/** Champ de filtre libellé, au style du back-office. */
export function FilterField({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block min-w-0">
      <span className="mb-1.5 block text-xs font-medium text-cream/50">{label}</span>
      {children}
    </label>
  );
}

export const filterInputClass = "glass-input h-10 w-full rounded-lg px-3 text-sm outline-none";
