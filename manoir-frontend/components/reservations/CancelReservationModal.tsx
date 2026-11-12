"use client";

import { motion } from "framer-motion";
import type { Reservation } from "@/lib/api";
import {
  formatCurrency,
  formatDay,
  parseDay,
  reservationRef,
  reservationTitle,
  todayIso
} from "@/lib/reservationDisplay";

const daysBetween = (from?: string, to?: string) => {
  const start = parseDay(from);
  const end = parseDay(to);
  if (!start || !end) return 0;
  return Math.max(0, Math.round((end.getTime() - start.getTime()) / 86_400_000));
};

/** Estimation affichée avant confirmation ; le serveur refait le calcul. */
function cancellationPreview(reservation: Reservation) {
  if (reservation.status !== "CONFIRMEE") {
    return null;
  }

  const depositAmount = Number(reservation.deposit_amount ?? reservation.total_price ?? 0);
  const today = todayIso();
  const consumedDays = daysBetween(reservation.created_at, today);

  if (today >= reservation.check_in.slice(0, 10)) {
    return { depositAmount, consumedDays, retainedAmount: depositAmount, refundAmount: 0 };
  }

  const retainedAmount = Math.min(
    depositAmount,
    consumedDays * Number(reservation.deposit_daily_rate ?? 0)
  );
  return {
    depositAmount,
    consumedDays,
    retainedAmount,
    refundAmount: Math.max(0, depositAmount - retainedAmount)
  };
}

export default function CancelReservationModal({
  reservation,
  cancelling,
  onClose,
  onConfirm
}: {
  reservation: Reservation;
  cancelling: boolean;
  onClose: () => void;
  onConfirm: () => void;
}) {
  const preview = cancellationPreview(reservation);

  return (
    <div className="fixed inset-0 z-[110] flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={() => !cancelling && onClose()}
        className="absolute inset-0 bg-black/80 backdrop-blur-md"
      />
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 20 }}
        className="glass-dark glass-edge relative w-full max-w-xl rounded-3xl p-8 text-cream"
      >
        <div className="space-y-6">
          <div>
            <h3 className="font-display text-2xl font-bold uppercase tracking-wide text-cream">
              Annuler ma réservation
            </h3>
            <p className="mt-1 text-[10px] uppercase tracking-widest text-cream/50">
              Réservation {reservationRef(reservation)}
            </p>
          </div>

          <div className="rounded-2xl border border-gold/15 bg-white/5 p-4 text-xs leading-relaxed text-cream/70">
            <p>
              <strong>Appartement :</strong> {reservationTitle(reservation)}
            </p>
            <p>
              <strong>Dates :</strong> du {formatDay(reservation.check_in)} au{" "}
              {formatDay(reservation.check_out)}
            </p>
          </div>

          {preview ? (
            <div className="grid gap-3 sm:grid-cols-2">
              <Amount label="Acompte payé" value={formatCurrency(preview.depositAmount)} />
              <Amount label="Jours consommés" value={String(preview.consumedDays)} />
              <Amount label="Montant retenu" value={formatCurrency(preview.retainedAmount)} />
              <Amount
                label="Montant remboursé"
                value={formatCurrency(preview.refundAmount)}
                highlight
              />
            </div>
          ) : (
            <p className="rounded-2xl border border-olive/25 bg-olive/10 p-4 text-sm text-cream/75">
              Aucun paiement n&apos;a été effectué : l&apos;annulation est sans frais.
            </p>
          )}

          <div className="flex gap-3 border-t border-gold/10 pt-4">
            <button
              type="button"
              disabled={cancelling}
              onClick={onClose}
              className="flex-1 rounded-xl border border-gold/20 py-4 text-xs font-bold uppercase tracking-wider text-cream/70 transition hover:border-gold/40 hover:bg-white/5 hover:text-cream disabled:opacity-50"
            >
              Retour
            </button>
            <button
              type="button"
              disabled={cancelling}
              onClick={onConfirm}
              className="flex-1 rounded-xl bg-terracotta py-4 text-xs font-black uppercase tracking-wider text-white transition hover:bg-terracotta/90 disabled:opacity-50"
            >
              {cancelling ? "Annulation..." : "Confirmer l'annulation"}
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  );
}

function Amount({
  label,
  value,
  highlight = false
}: {
  label: string;
  value: string;
  highlight?: boolean;
}) {
  return (
    <div
      className={
        highlight
          ? "rounded-2xl border border-olive/25 bg-olive/10 p-4"
          : "rounded-2xl border border-gold/10 bg-white/5 p-4"
      }
    >
      <p className="text-[9px] uppercase tracking-widest text-cream/45">{label}</p>
      <p
        className={`mt-1 font-display text-xl font-bold ${highlight ? "text-olive-light" : "text-cream"}`}
      >
        {value}
      </p>
    </div>
  );
}
