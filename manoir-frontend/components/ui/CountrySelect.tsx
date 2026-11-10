"use client";

import { Check, ChevronDown, Globe2, Search } from "lucide-react";
import { useEffect, useId, useMemo, useRef, useState, type KeyboardEvent } from "react";
import CountryFlag from "@/components/ui/CountryFlag";
import { COUNTRIES, filterCountries, getCountry } from "@/lib/countries";
import { cn } from "@/lib/utils";

type CountrySelectProps = {
  /** Code ISO 3166-1 alpha-2 sélectionné, ou chaîne vide. */
  value: string;
  onChange: (code: string) => void;
  label?: string;
  id?: string;
  placeholder?: string;
  hint?: string;
  required?: boolean;
  disabled?: boolean;
  className?: string;
};

/**
 * Sélecteur de pays accessible et recherchable.
 *
 * Reprend le langage visuel du sélecteur d'indicatif existant (verre, or) et
 * applique le motif combobox WAI-ARIA : un bouton ouvre un panneau contenant
 * un champ de recherche et une listbox. La recherche couvre le nom français,
 * le nom anglais et le code ISO alpha-2.
 */
export default function CountrySelect({
  value,
  onChange,
  label = "Pays",
  id,
  placeholder = "Sélectionnez un pays",
  hint,
  required = false,
  disabled = false,
  className
}: CountrySelectProps) {
  const reactId = useId().replace(/[^a-zA-Z0-9_-]/g, "");
  const triggerId = id || `country-select-${reactId}`;
  const labelId = `${triggerId}-label`;
  const listboxId = `${triggerId}-listbox`;
  const searchId = `${triggerId}-search`;
  const hintId = `${triggerId}-hint`;
  const optionId = (code: string) => `${triggerId}-option-${code.toLowerCase()}`;

  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);
  const [placement, setPlacement] = useState<"bottom" | "top">("bottom");

  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);

  const selected = getCountry(value);
  const filtered = useMemo(() => filterCountries(query), [query]);
  const activeCountry = filtered[activeIndex];

  const openMenu = () => {
    if (disabled) return;

    const selectedIndex = selected
      ? COUNTRIES.findIndex((country) => country.code === selected.code)
      : 0;
    const triggerRect = triggerRef.current?.getBoundingClientRect();
    // Hauteur approximative du panneau : recherche + liste (18 rem max) + pied.
    const panelHeight = 384;

    if (triggerRect) {
      const spaceBelow = window.innerHeight - triggerRect.bottom;
      const spaceAbove = triggerRect.top;
      setPlacement(spaceBelow < panelHeight && spaceAbove > spaceBelow ? "top" : "bottom");
    }

    setQuery("");
    setActiveIndex(selectedIndex >= 0 ? selectedIndex : 0);
    setOpen(true);
  };

  const closeMenu = (returnFocus = false) => {
    setOpen(false);
    setQuery("");

    if (returnFocus) {
      window.requestAnimationFrame(() => triggerRef.current?.focus());
    }
  };

  const selectCountry = (code: string) => {
    onChange(code);
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
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) {
        setOpen(false);
        setQuery("");
      }
    };

    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [open]);

  useEffect(() => {
    if (!open) return;

    const option = listRef.current?.querySelector<HTMLElement>(`[data-index="${activeIndex}"]`);
    option?.scrollIntoView({ block: "nearest" });
  }, [activeIndex, open, filtered]);

  const onSearchKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Escape") {
      event.preventDefault();
      closeMenu(true);
      return;
    }

    if (event.key === "Tab") {
      // Laisse le navigateur passer au champ suivant, puis referme le panneau.
      window.setTimeout(() => closeMenu(false), 0);
      return;
    }

    if (event.key === "Enter") {
      event.preventDefault();
      if (activeCountry) selectCountry(activeCountry.code);
      return;
    }

    if (!filtered.length) return;

    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActiveIndex((current) => Math.min(current + 1, filtered.length - 1));
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setActiveIndex((current) => Math.max(current - 1, 0));
    } else if (event.key === "Home") {
      event.preventDefault();
      setActiveIndex(0);
    } else if (event.key === "End") {
      event.preventDefault();
      setActiveIndex(filtered.length - 1);
    }
  };

  const onTriggerKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      openMenu();
    }
  };

  return (
    <div ref={rootRef} className={cn("space-y-1.5", className)}>
      <label id={labelId} htmlFor={triggerId} className="text-sm font-medium text-cream/85">
        {label}
        {required && <span className="ml-0.5 text-gold">*</span>}
      </label>

      <div className="relative">
        <button
          id={triggerId}
          ref={triggerRef}
          type="button"
          disabled={disabled}
          aria-haspopup="listbox"
          aria-expanded={open}
          aria-controls={open ? listboxId : undefined}
          aria-labelledby={`${labelId} ${triggerId}`}
          aria-describedby={hint ? hintId : undefined}
          onClick={() => (open ? closeMenu() : openMenu())}
          onKeyDown={onTriggerKeyDown}
          className={cn(
            "glass-input flex h-12 w-full items-center gap-3 rounded-xl px-4 text-left text-[15px] outline-none transition",
            "focus-visible:ring-2 focus-visible:ring-gold/50 disabled:cursor-not-allowed disabled:opacity-60"
          )}
        >
          {selected ? (
            <>
              <CountryFlag code={selected.code} />
              <span className="min-w-0 flex-1 truncate text-cream">{selected.name}</span>
              <span className="shrink-0 rounded-md border border-gold/25 bg-gold/10 px-1.5 py-0.5 font-mono text-[11px] font-semibold tracking-[0.12em] text-gold-light">
                {selected.code}
              </span>
            </>
          ) : (
            <>
              <span className="grid size-[22px] shrink-0 place-items-center rounded-[3px] border border-dashed border-cream/25 text-cream/35">
                <Globe2 size={12} aria-hidden="true" />
              </span>
              <span className="min-w-0 flex-1 truncate text-cream/45">{placeholder}</span>
            </>
          )}
          <ChevronDown
            size={16}
            aria-hidden="true"
            className={cn(
              "shrink-0 text-cream/50 transition-transform duration-300",
              open && "rotate-180"
            )}
          />
        </button>

        {open && (
          <>
            <div
              aria-hidden="true"
              onClick={() => closeMenu(true)}
              className="fixed inset-0 z-40 bg-night/60 backdrop-blur-sm sm:hidden"
            />
            <div
              className={cn(
                "glass-dark glass-edge z-50 overflow-hidden rounded-2xl shadow-glass-lg",
                "!fixed inset-x-3 bottom-3 max-h-[80vh]",
                "sm:!absolute sm:inset-x-0 sm:max-h-none",
                placement === "top"
                  ? "sm:bottom-full sm:mb-2"
                  : "sm:bottom-auto sm:top-full sm:mt-2"
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
                    id={searchId}
                    ref={searchRef}
                    type="text"
                    role="combobox"
                    aria-expanded="true"
                    aria-controls={listboxId}
                    aria-autocomplete="list"
                    aria-activedescendant={activeCountry ? optionId(activeCountry.code) : undefined}
                    aria-label="Rechercher un pays"
                    autoComplete="off"
                    spellCheck={false}
                    value={query}
                    onChange={(event) => {
                      setQuery(event.target.value);
                      setActiveIndex(0);
                    }}
                    onKeyDown={onSearchKeyDown}
                    placeholder="Rechercher un pays…"
                    className="glass-input h-11 w-full rounded-xl pl-10 pr-3 text-sm outline-none"
                  />
                </div>
              </div>

              {filtered.length === 0 ? (
                <p role="status" className="px-4 py-8 text-center text-sm text-cream/50">
                  Aucun pays ne correspond à « {query} ».
                </p>
              ) : (
                <ul
                  ref={listRef}
                  id={listboxId}
                  role="listbox"
                  aria-labelledby={labelId}
                  className="max-h-[min(60vh,18rem)] overflow-y-auto p-1.5"
                >
                  {filtered.map((country, index) => {
                    const isSelected = selected?.code === country.code;
                    const isActive = index === activeIndex;

                    return (
                      <li
                        key={country.code}
                        id={optionId(country.code)}
                        role="option"
                        aria-selected={isSelected}
                        data-index={index}
                        onMouseEnter={() => setActiveIndex(index)}
                        onClick={() => selectCountry(country.code)}
                        className={cn(
                          "flex min-h-11 cursor-pointer items-center gap-3 rounded-xl px-3 py-2 text-left text-sm transition",
                          isSelected
                            ? "bg-gold/15 text-gold-light"
                            : isActive
                              ? "bg-white/[0.07] text-cream"
                              : "text-cream/80 hover:bg-white/[0.05]"
                        )}
                      >
                        <CountryFlag code={country.code} />
                        <span className="min-w-0 flex-1 truncate">{country.name}</span>
                        <span className="shrink-0 font-mono text-[11px] tracking-[0.12em] text-cream/45">
                          {country.code}
                        </span>
                        <span className="flex w-4 shrink-0 justify-center">
                          {isSelected && (
                            <Check size={15} aria-hidden="true" className="text-gold-light" />
                          )}
                        </span>
                      </li>
                    );
                  })}
                </ul>
              )}

              <p className="border-t border-gold/10 px-4 py-2 text-[10px] uppercase tracking-[0.16em] text-cream/35">
                {filtered.length} résultat{filtered.length > 1 ? "s" : ""}
              </p>
            </div>
          </>
        )}
      </div>

      {hint && (
        <p id={hintId} className="text-xs leading-5 text-cream/50">
          {hint}
        </p>
      )}
    </div>
  );
}
