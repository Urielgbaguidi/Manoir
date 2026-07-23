"use client";

import { Check, ChevronDown } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

export type Country = { code: string; iso: string; name: string };

/** Indicatifs proposés (drapeau ISO + code + nom). */
export const COUNTRY_CODES: Country[] = [
  { code: "+229", iso: "bj", name: "Bénin" },
  { code: "+33", iso: "fr", name: "France" },
  { code: "+225", iso: "ci", name: "Côte d'Ivoire" },
  { code: "+228", iso: "tg", name: "Togo" },
  { code: "+234", iso: "ng", name: "Nigéria" },
  { code: "+221", iso: "sn", name: "Sénégal" },
  { code: "+226", iso: "bf", name: "Burkina Faso" },
  { code: "+227", iso: "ne", name: "Niger" },
  { code: "+223", iso: "ml", name: "Mali" },
  { code: "+237", iso: "cm", name: "Cameroun" },
  { code: "+241", iso: "ga", name: "Gabon" },
  { code: "+242", iso: "cg", name: "Congo" },
  { code: "+243", iso: "cd", name: "RD Congo" },
  { code: "+32", iso: "be", name: "Belgique" },
  { code: "+41", iso: "ch", name: "Suisse" },
  { code: "+1", iso: "us", name: "USA / Canada" },
  { code: "+44", iso: "gb", name: "Royaume-Uni" }
];

/** Drapeau image (rendu fiable multi-OS, contrairement aux emojis). */
function Flag({ iso, className }: { iso: string; className?: string }) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={`https://flagcdn.com/w40/${iso}.png`}
      srcSet={`https://flagcdn.com/w80/${iso}.png 2x`}
      width={22}
      height={16}
      alt=""
      loading="lazy"
      className={cn(
        "h-4 w-[22px] shrink-0 rounded-[3px] object-cover ring-1 ring-black/15",
        className
      )}
    />
  );
}

type CountryCodeSelectProps = {
  value: string;
  onChange: (code: string) => void;
  className?: string;
};

/**
 * Sélecteur d'indicatif téléphonique custom, intégré à la DA (verre, or).
 * Remplace le <select> natif (non stylable + emojis drapeaux non rendus
 * sous Windows) par un dropdown accessible avec vrais drapeaux.
 */
export default function CountryCodeSelect({ value, onChange, className }: CountryCodeSelectProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const selected = COUNTRY_CODES.find((country) => country.code === value) ?? COUNTRY_CODES[0];

  useEffect(() => {
    const onDocClick = (event: MouseEvent) => {
      if (ref.current && !ref.current.contains(event.target as Node)) setOpen(false);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDocClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDocClick);
      document.removeEventListener("keydown", onKey);
    };
  }, []);

  return (
    <div ref={ref} className={cn("relative", className)}>
      <button
        type="button"
        onClick={() => setOpen((current) => !current)}
        aria-haspopup="listbox"
        aria-expanded={open}
        className="glass-input flex w-[104px] shrink-0 items-center gap-2 rounded-xl px-3 py-3.5 text-sm outline-none"
      >
        <Flag iso={selected.iso} />
        <span className="font-medium">{selected.code}</span>
        <ChevronDown
          size={15}
          className={cn("text-cream/50 transition-transform duration-300", open && "rotate-180")}
        />
      </button>

      {open && (
        <ul
          role="listbox"
          className="glass-dark glass-edge !absolute left-0 top-full z-50 mt-2 max-h-72 w-64 overflow-y-auto rounded-2xl p-1.5 shadow-glass-lg"
        >
          {COUNTRY_CODES.map((country) => {
            const active = country.code === value;
            return (
              <li key={`${country.code}-${country.iso}`}>
                <button
                  type="button"
                  role="option"
                  aria-selected={active}
                  onClick={() => {
                    onChange(country.code);
                    setOpen(false);
                  }}
                  className={cn(
                    "flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm transition",
                    active ? "bg-gold/15 text-gold-light" : "text-cream/80 hover:bg-white/5"
                  )}
                >
                  <Flag iso={country.iso} />
                  <span className="min-w-0 flex-1 truncate">{country.name}</span>
                  <span className="w-12 shrink-0 text-right text-xs tabular-nums text-cream/50">
                    {country.code}
                  </span>
                  <span className="flex w-4 shrink-0 justify-center">
                    {active && <Check size={15} className="text-gold-light" />}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
