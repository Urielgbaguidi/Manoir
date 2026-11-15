"use client";

import { TriangleAlert } from "lucide-react";
import Modal, { ModalActions, ModalButton } from "@/components/ui/Modal";
import type { Reservation } from "@/lib/api";
import {
  formatCurrency,
  formatStayPeriod,
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
  /** Réservation à annuler ; `null` ferme la fenêtre. */
  reservation: Reservation | null;
  cancelling: boolean;
  onClose: () => void;
  onConfirm: () => void;
}) {
  const preview = reservation ? cancellationPreview(reservation) : null;

  return (
    <Modal
      open={reservation !== null}
      onClose={onClose}
      busy={cancelling}
      icon={TriangleAlert}
      tone="danger"
      title="Annuler ma réservation"
      description={
        reservation
          ? `Voulez-vous vraiment annuler la réservation ${reservationRef(reservation)} ? Cette action est définitive.`
          : undefined
      }
    >
      {reservation && (
        <div className="space-y-4">
          <div className="rounded-xl border border-gold/15 bg-white/5 p-4 text-sm leading-relaxed text-cream/75">
            <p>
              <strong className="text-cream">Appartement :</strong> {reservationTitle(reservation)}
            </p>
            <p>
              <strong className="text-cream">Dates :</strong> {formatStayPeriod(reservation)}
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
            <p className="rounded-xl border border-olive/25 bg-olive/10 p-4 text-sm text-cream/75">
              Aucun paiement n&apos;a été effectué : l&apos;annulation est sans frais.
            </p>
          )}

          <ModalActions>
            <ModalButton variant="secondary" disabled={cancelling} onClick={onClose}>
              Retour
            </ModalButton>
            <ModalButton variant="danger" disabled={cancelling} onClick={onConfirm}>
              {cancelling ? "Annulation…" : "Oui, annuler la réservation"}
            </ModalButton>
          </ModalActions>
        </div>
      )}
    </Modal>
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
          ? "rounded-xl border border-olive/25 bg-olive/10 p-4"
          : "rounded-xl border border-gold/10 bg-white/5 p-4"
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
