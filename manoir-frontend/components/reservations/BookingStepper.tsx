"use client";

import { Check, XCircle } from "lucide-react";
import type { ReservationStatus } from "@/lib/api";
import { cn } from "@/lib/utils";

/** Les cinq étapes du parcours de réservation, de la sélection au Bon de Séjour. */
export const BOOKING_STEPS = [
  "Dates & appartement",
  "Vos informations",
  "Validation",
  "Paiement",
  "Confirmé"
];

const failureLabels: Partial<Record<ReservationStatus, string>> = {
  REFUSEE: "Demande refusée",
  EXPIREE: "Délai de paiement expiré",
  ANNULEE: "Réservation annulée",
  REMBOURSEE: "Remboursement effectué",
  LIBEREE: "Appartement libéré"
};

/**
 * Position dans le parcours pour un statut donné : index de l'étape en cours
 * (BOOKING_STEPS.length = tout est terminé), ou un libellé d'échec.
 */
export function stepForStatus(status: ReservationStatus): { current: number; failure?: string } {
  switch (status) {
    case "EN_ATTENTE":
      return { current: 2 };
    case "VALIDEE_PAIEMENT_REQUIS":
      return { current: 3 };
    case "SEJOUR_PAYE":
    case "CONFIRMEE":
      return { current: BOOKING_STEPS.length };
    default:
      return { current: 2, failure: failureLabels[status] ?? "Réservation close" };
  }
}

export function StatusStepper({
  status,
  compact = false
}: {
  status: ReservationStatus;
  compact?: boolean;
}) {
  const { current, failure } = stepForStatus(status);

  if (failure) {
    return (
      <div className="flex items-center gap-3 rounded-2xl border border-terracotta/40 bg-terracotta/15 p-4 text-xs text-terracotta-light">
        <XCircle className="h-5 w-5 shrink-0" />
        <div>
          <p className="font-bold uppercase tracking-wider">{failure}</p>
          <p className="mt-0.5 text-[11px] text-cream/60">
            Vous pouvez faire une nouvelle demande depuis le catalogue.
          </p>
        </div>
      </div>
    );
  }

  return <BookingStepper current={current} compact={compact} />;
}

/**
 * Frise d'étapes. `current` = index de l'étape en cours ; les précédentes sont
 * cochées. En mode compact (colonne étroite), seul le libellé courant s'affiche.
 */
export default function BookingStepper({
  current,
  compact = false,
  labels = BOOKING_STEPS
}: {
  current: number;
  compact?: boolean;
  labels?: string[];
}) {
  const lastIndex = labels.length - 1;
  const progress = Math.min(current, lastIndex) / lastIndex;
  const allDone = current > lastIndex;

  return (
    <div>
      {/* Pastilles de largeur fixe réparties de bord à bord : la barre de
          progression tombe exactement sur chacune d'elles. */}
      <ol
        className={cn("relative flex w-full items-start justify-between", !compact && "sm:pb-9")}
        aria-label="Étapes de la réservation"
      >
        <span aria-hidden className="absolute left-3 right-3 top-3 h-0.5 bg-white/10" />
        <span
          aria-hidden
          className="absolute left-3 top-3 h-0.5 bg-gradient-to-r from-gold-light to-gold transition-all duration-700"
          style={{ width: `calc((100% - 1.5rem) * ${allDone ? 1 : progress})` }}
        />
        {labels.map((label, index) => {
          const isDone = index < current;
          const isActive = index === current;

          return (
            <li
              key={label}
              className="relative z-10 flex w-6 shrink-0 justify-center"
              aria-current={isActive ? "step" : undefined}
              aria-label={label}
            >
              <span
                className={cn(
                  "flex h-6 w-6 items-center justify-center rounded-full border-2",
                  isDone
                    ? "border-gold bg-gradient-to-br from-gold-light to-gold text-night"
                    : isActive
                      ? "border-gold bg-white/5 text-gold-light ring-4 ring-gold/15"
                      : "border-gold/20 bg-white/5 text-cream/35"
                )}
              >
                {isDone ? (
                  <Check className="h-3.5 w-3.5" strokeWidth={3} />
                ) : (
                  <span className="text-[9px] font-bold">{index + 1}</span>
                )}
              </span>
              {!compact && (
                <span
                  aria-hidden
                  className={cn(
                    "absolute top-8 hidden w-24 text-[9px] uppercase leading-tight tracking-wider sm:block",
                    index === 0
                      ? "left-0 text-left"
                      : index === lastIndex
                        ? "right-0 text-right"
                        : "left-1/2 -translate-x-1/2 text-center",
                    isDone || isActive ? "font-bold text-cream" : "text-cream/40"
                  )}
                >
                  {label}
                </span>
              )}
            </li>
          );
        })}
      </ol>
      <p
        className={cn(
          "mt-3 text-[10px] font-bold uppercase tracking-[0.18em] text-gold-light",
          !compact && "sm:hidden"
        )}
      >
        {allDone
          ? "Parcours terminé"
          : `Étape ${current + 1} sur ${labels.length} · ${labels[current]}`}
      </p>
    </div>
  );
}
