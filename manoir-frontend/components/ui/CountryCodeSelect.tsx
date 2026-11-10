"use client";

import { Check, ChevronDown, Search } from "lucide-react";
import { useEffect, useId, useMemo, useRef, useState, type KeyboardEvent } from "react";
import type { CountryCode } from "libphonenumber-js/min";
import CountryFlag from "@/components/ui/CountryFlag";
import {
  DEFAULT_DIAL_COUNTRY,
  SUGGESTED_DIAL_COUNTRIES,
  filterDialCountries,
  getDialCountry,
  type DialCountry
} from "@/lib/phone";
import { cn } from "@/lib/utils";

type CountryCodeSelectProps = {
  /** Pays de l'indicatif, code ISO alpha-2 (ex. « BJ »). */
  value: CountryCode;
  onChange: (country: CountryCode) => void;
  className?: string;
};

type Row = { country: DialCountry; group: "suggested" | "all" };

/**
 * Sélecteur d'indicatif téléphonique : tous les pays du monde (245),
 * recherche par nom, code ISO ou indicatif (« 229 », « +33 », « benin »),
 * navigation clavier, et feuille basse sur mobile.
 *
 * La valeur est le pays (ISO) et non l'indicatif : plusieurs pays partagent
 * le même indicatif (+1 pour les États-Unis et le Canada, +7…), seul le pays
 * permet de valider correctement le numéro.
 */
export default function CountryCodeSelect({ value, onChange, className }: CountryCodeSelectProps) {
  const reactId = useId().replace(/[^a-zA-Z0-9_-]/g, "");
  const listboxId = `dial-${reactId}-listbox`;
  const optionId = (row: Row) => `dial-${reactId}-${row.group}-${row.country.code.toLowerCase()}`;

  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);
  const [placement, setPlacement] = useState<"bottom" | "top">("bottom");

  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);

  const selected = getDialCountry(value) ?? getDialCountry(DEFAULT_DIAL_COUNTRY)!;

  // Sans recherche : suggestions en tête, puis tous les pays.
  const rows = useMemo<Row[]>(() => {
    if (query.trim()) return filterDialCountries(query).map((country) => ({ country, group: "all" as const }));
    const suggested = SUGGESTED_DIAL_COUNTRIES.map(getDialCountry)
      .filter((country): country is DialCountry => Boolean(country))
      .map((country) => ({ country, group: "suggested" as const }));
    return [...suggested, ...filterDialCountries("").map((country) => ({ country, group: "all" as const }))];
  }, [query]);

  const activeRow = rows[activeIndex];
  const firstAllIndex = rows.findIndex((row) => row.group === "all");

  const openMenu = () => {
    const rect = triggerRef.current?.getBoundingClientRect();
    if (rect) {
      const spaceBelow = window.innerHeight - rect.bottom;
      setPlacement(spaceBelow < 380 && rect.top > spaceBelow ? "top" : "bottom");
    }
    setQuery("");
    const index = rows.findIndex((row) => row.country.code === selected.code);
    setActiveIndex(index >= 0 ? index : 0);
    setOpen(true);
  };

  const closeMenu = (returnFocus = false) => {
    setOpen(false);
    setQuery("");
    if (returnFocus) window.requestAnimationFrame(() => triggerRef.current?.focus());
  };

  const pick = (country: DialCountry) => {
    onChange(country.code);
    closeMenu(true);
  };

  useEffect(() => {
    if (!open) return;
    const frame = window.requestAnimationFrame(() => searchRef.current?.focus());
    return () => window.cancelAnimationFrame(frame);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: PointerEvent) => {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) closeMenu();
    };
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    listRef.current?.querySelector<HTMLElement>(`[data-index="${activeIndex}"]`)?.scrollIntoView({ block: "nearest" });
  }, [activeIndex, open, rows]);

  const onSearchKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Escape") {
      event.preventDefault();
      closeMenu(true);
    } else if (event.key === "Tab") {
      window.setTimeout(() => closeMenu(false), 0);
    } else if (event.key === "Enter") {
      event.preventDefault();
      if (activeRow) pick(activeRow.country);
    } else if (event.key === "ArrowDown" && rows.length) {
      event.preventDefault();
      setActiveIndex((index) => Math.min(index + 1, rows.length - 1));
    } else if (event.key === "ArrowUp" && rows.length) {
      event.preventDefault();
      setActiveIndex((index) => Math.max(index - 1, 0));
    }
  };

  return (
    <div ref={rootRef} className={cn("relative shrink-0", className)}>
      <button
        ref={triggerRef}
        type="button"
        onClick={() => (open ? closeMenu() : openMenu())}
        onKeyDown={(event) => {
          if (event.key === "ArrowDown" || event.key === "ArrowUp") {
            event.preventDefault();
            openMenu();
          }
        }}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? listboxId : undefined}
        aria-label={`Indicatif téléphonique : ${selected.name} ${selected.dial}`}
        title={`${selected.name} (${selected.dial})`}
        className="glass-input flex h-12 w-[128px] items-center gap-1.5 rounded-xl pl-3 pr-2.5 text-sm outline-none focus-visible:ring-2 focus-visible:ring-gold/50"
      >
        <CountryFlag code={selected.code} />
        <span className="min-w-0 flex-1 truncate text-left font-medium tabular-nums">{selected.dial}</span>
        <ChevronDown
          size={15}
          aria-hidden="true"
          className={cn("shrink-0 text-cream/50 transition-transform duration-300", open && "rotate-180")}
        />
      </button>

      {open && (
        <>
          {/* Voile mobile : le panneau s'ouvre en feuille basse. */}
          <div
            aria-hidden="true"
            onClick={() => closeMenu(true)}
            className="fixed inset-0 z-40 bg-night/60 backdrop-blur-sm sm:hidden"
          />
          <div
            className={cn(
              "admin-panel z-50 overflow-hidden rounded-2xl border border-gold/20 shadow-glass-lg",
              "fixed inset-x-3 bottom-3 max-h-[80vh]",
              "sm:absolute sm:inset-x-auto sm:left-0 sm:w-80 sm:max-h-none",
              placement === "top" ? "sm:bottom-full sm:mb-2" : "sm:bottom-auto sm:top-full sm:mt-2"
            )}
          >
            <div className="border-b border-gold/10 p-2">
              <div className="relative">
                <Search
                  size={16}
                  aria-hidden="true"
                  className="pointer-events-none absolute left-3 top-1/2 z-10 -translate-y-1/2 text-cream/50"
                />
                <input
                  ref={searchRef}
                  type="text"
                  role="combobox"
                  aria-expanded="true"
                  aria-controls={listboxId}
                  aria-autocomplete="list"
                  aria-activedescendant={activeRow ? optionId(activeRow) : undefined}
                  aria-label="Rechercher un indicatif"
                  autoComplete="off"
                  spellCheck={false}
                  value={query}
                  onChange={(event) => {
                    setQuery(event.target.value);
                    setActiveIndex(0);
                  }}
                  onKeyDown={onSearchKeyDown}
                  placeholder="Pays ou indicatif (ex. 229)"
                  className="glass-input h-11 w-full rounded-xl pl-10 pr-3 text-sm outline-none"
                />
              </div>
            </div>

            {rows.length === 0 ? (
              <p role="status" className="px-4 py-8 text-center text-sm text-cream/50">
                Aucun pays ne correspond à « {query} ».
              </p>
            ) : (
              <ul
                ref={listRef}
                id={listboxId}
                role="listbox"
                aria-label="Indicatifs téléphoniques"
                className="max-h-[min(55vh,18rem)] overflow-y-auto p-1.5"
              >
                {rows.map((row, index) => {
                  const isSelected = row.country.code === selected.code;
                  const isActive = index === activeIndex;
                  return (
                    <li key={optionId(row)} role="presentation">
                      {!query && index === 0 && <GroupLabel>Suggestions</GroupLabel>}
                      {!query && index === firstAllIndex && <GroupLabel>Tous les pays</GroupLabel>}
                      <div
                        id={optionId(row)}
                        role="option"
                        aria-selected={isSelected}
                        data-index={index}
                        onMouseEnter={() => setActiveIndex(index)}
                        onClick={() => pick(row.country)}
                        className={cn(
                          "flex min-h-11 cursor-pointer items-center gap-3 rounded-xl px-3 py-2 text-sm transition",
                          isSelected
                            ? "bg-gold/15 text-gold-light"
                            : isActive
                              ? "bg-white/[0.07] text-cream"
                              : "text-cream/80"
                        )}
                      >
                        <CountryFlag code={row.country.code} />
                        <span className="min-w-0 flex-1 truncate">{row.country.name}</span>
                        <span className="shrink-0 text-xs tabular-nums text-cream/50">{row.country.dial}</span>
                        <span className="flex w-4 shrink-0 justify-center">
                          {isSelected && <Check size={15} aria-hidden="true" className="text-gold-light" />}
                        </span>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </>
      )}
    </div>
  );
}

function GroupLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="px-3 pb-1 pt-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-cream/40">{children}</p>
  );
}
