"use client";

import { cn } from "@/lib/utils";

/**
 * Interrupteur on / off, au style du template TailAdmin (piste arrondie,
 * pouce blanc qui glisse), aux couleurs du Manoir.
 */
export default function Switch({
  checked,
  onCheckedChange,
  disabled = false,
  label,
  className
}: {
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  disabled?: boolean;
  /** Libellé lu par les lecteurs d'écran. */
  label: string;
  className?: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onCheckedChange(!checked)}
      className={cn(
        "relative inline-flex h-6 w-[52px] shrink-0 cursor-pointer items-center rounded-full p-0.5 outline-none transition-colors",
        "focus-visible:ring-2 focus-visible:ring-gold/40 disabled:cursor-not-allowed disabled:opacity-50",
        checked ? "bg-gold hover:bg-gold-light" : "switch-track",
        className
      )}
    >
      <span
        aria-hidden
        className={cn(
          "pointer-events-none block h-5 w-[30px] rounded-full bg-white shadow-sm transition-transform duration-150 ease-linear",
          checked ? "translate-x-[18px]" : "translate-x-0"
        )}
      />
    </button>
  );
}
