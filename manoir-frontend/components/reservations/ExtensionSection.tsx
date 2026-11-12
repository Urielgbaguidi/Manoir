"use client";

import { CalendarPlus, Info } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { useToast } from "@/context/ToastContext";
import { api, type Reservation, type StayExtension } from "@/lib/api";
import {
  addDaysIso,
  countNights,
  extensionStatusLabels,
  extensionStatusTone,
  extensionVoucher,
  formatCurrency,
  formatDay
} from "@/lib/reservationDisplay";
import { cn } from "@/lib/utils";
import DeadlineCountdown from "./DeadlineCountdown";
import PaymentPanel from "./PaymentPanel";
import VoucherButton from "./VoucherButton";
import { errorMessage, isRetryableError, useIdempotentIntent } from "./useIdempotentIntent";

type ExtensionsState = {
  extensions: StayExtension[];
  can_request: boolean;
  refusal_reason: string | null;
};

/**
 * Prolongation d'un séjour payé : demande, validation par l'équipe, puis
 * paiement de la prolongation et nouveau Bon de Séjour.
 */
export default function ExtensionSection({
  reservation,
  onReservationChanged
}: {
  reservation: Reservation;
  /** À appeler quand la réservation change côté serveur (nouvelle date de départ, bon émis). */
  onReservationChanged: () => void;
}) {
  const { showToast } = useToast();
  const [state, setState] = useState<ExtensionsState | null>(null);
  const [loadError, setLoadError] = useState("");
  const [formOpen, setFormOpen] = useState(false);
  const [newCheckOut, setNewCheckOut] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState("");
  const { keyFor, reset, run } = useIdempotentIntent();

  const load = useCallback(async () => {
    setLoadError("");
    try {
      setState(await api.getReservationExtensions(reservation.id));
    } catch (error) {
      setLoadError(errorMessage(error, "Impossible de charger vos prolongations."));
    }
  }, [reservation.id]);

  useEffect(() => {
    load();
  }, [load, reservation.check_out]);

  const minDate = addDaysIso(reservation.check_out, 1);
  const pricePerNight = Number(
    reservation.room?.base_price ||
      (reservation.stay_amount
        ? reservation.stay_amount / countNights(reservation.check_in, reservation.check_out)
        : 0)
  );
  const addedNights =
    newCheckOut && newCheckOut >= minDate ? countNights(reservation.check_out, newCheckOut) : 0;

  const openForm = () => {
    setNewCheckOut(minDate);
    setFormError("");
    setFormOpen(true);
  };

  const submit = () =>
    run(async () => {
      if (!newCheckOut || newCheckOut <= reservation.check_out.slice(0, 10)) {
        setFormError("Choisissez une date de départ postérieure à la date actuelle.");
        return;
      }

      const key = keyFor(`${reservation.id}:${newCheckOut}`);
      setSubmitting(true);
      setFormError("");
      try {
        const response = await api.requestStayExtension(reservation.id, newCheckOut, key);
        reset();
        showToast(response.message || "Demande de prolongation envoyée.", "success");
        setFormOpen(false);
        await load();
      } catch (error) {
        if (!isRetryableError(error)) reset();
        setFormError(errorMessage(error, "La demande de prolongation a échoué."));
      } finally {
        setSubmitting(false);
      }
    });

  const extensions = state?.extensions ?? reservation.extensions ?? [];

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h3 className="flex items-center gap-2 text-sm font-bold uppercase tracking-wider text-cream">
          <CalendarPlus size={16} className="text-gold-light" /> Prolonger mon séjour
        </h3>
        {state?.can_request && !formOpen && (
          <button
            type="button"
            onClick={openForm}
            className="inline-flex items-center gap-2 rounded-full bg-gradient-to-br from-gold-light to-gold px-4 py-2.5 text-[10px] font-bold uppercase tracking-[0.14em] text-night transition hover:brightness-105"
          >
            Demander une prolongation
          </button>
        )}
      </div>

      {loadError && <p className="text-xs text-terracotta-light">{loadError}</p>}

      {state && !state.can_request && state.refusal_reason && (
        <p className="flex gap-2 rounded-xl border border-gold/15 bg-white/5 p-3 text-xs leading-5 text-cream/60">
          <Info size={14} className="mt-0.5 shrink-0 text-gold/70" />
          {state.refusal_reason}
        </p>
      )}

      {formOpen && (
        <div className="space-y-4 rounded-2xl border border-gold/20 bg-white/5 p-4">
          <label className="block">
            <span className="mb-2 block text-[10px] font-semibold uppercase tracking-widest text-gold/80">
              Nouvelle date de départ (actuellement le {formatDay(reservation.check_out)})
            </span>
            <input
              type="date"
              min={minDate}
              value={newCheckOut}
              onChange={(event) => {
                setNewCheckOut(event.target.value);
                setFormError("");
              }}
              onClick={(event) => (event.currentTarget as HTMLInputElement).showPicker?.()}
              className="glass-input w-full cursor-pointer rounded-xl px-4 py-3.5 text-sm outline-none"
            />
          </label>

          {addedNights > 0 && (
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-xl border border-gold/10 bg-white/5 p-3">
                <p className="text-[9px] uppercase tracking-widest text-cream/45">Nuits ajoutées</p>
                <p className="mt-1 font-display text-lg font-bold text-cream">{addedNights}</p>
              </div>
              <div className="rounded-xl border border-olive/25 bg-olive/10 p-3">
                <p className="text-[9px] uppercase tracking-widest text-cream/45">Montant estimé</p>
                <p className="mt-1 font-display text-lg font-bold text-olive-light">
                  {formatCurrency(addedNights * pricePerNight)}
                </p>
              </div>
            </div>
          )}

          <p className="text-xs leading-5 text-cream/60">
            Rien à payer maintenant : l&apos;équipe du Manoir vérifie que l&apos;appartement reste
            libre, puis vous prévient par email. Le paiement de la prolongation s&apos;ouvrira ici
            après validation.
          </p>

          {formError && <p className="text-xs font-semibold text-terracotta-light">{formError}</p>}

          <div className="flex gap-3">
            <button
              type="button"
              disabled={submitting}
              onClick={() => setFormOpen(false)}
              className="flex-1 rounded-xl border border-gold/20 py-3 text-[10px] font-bold uppercase tracking-wider text-cream/70 transition hover:bg-white/5 disabled:opacity-50"
            >
              Annuler
            </button>
            <button
              type="button"
              disabled={submitting}
              onClick={submit}
              className="flex flex-1 items-center justify-center rounded-full bg-gradient-to-br from-gold-light to-gold py-3 text-[10px] font-bold uppercase tracking-wider text-night transition hover:brightness-105 disabled:opacity-50"
            >
              {submitting ? (
                <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-night border-t-transparent" />
              ) : (
                "Envoyer la demande"
              )}
            </button>
          </div>
        </div>
      )}

      {extensions.length > 0 && (
        <ul className="space-y-3">
          {extensions.map((extension) => (
            <ExtensionItem
              key={extension.id}
              reservation={reservation}
              extension={extension}
              onPaid={() => {
                load();
                onReservationChanged();
              }}
              onExpired={load}
            />
          ))}
        </ul>
      )}
    </section>
  );
}

function ExtensionItem({
  reservation,
  extension,
  onPaid,
  onExpired
}: {
  reservation: Reservation;
  extension: StayExtension;
  onPaid: () => void;
  onExpired: () => void;
}) {
  const voucher = extensionVoucher(reservation, extension);
  const awaitingPayment = extension.status === "VALIDEE_PAIEMENT_REQUIS";
  const deadlinePassed =
    awaitingPayment && extension.payment_deadline
      ? new Date(extension.payment_deadline).getTime() <= Date.now()
      : false;

  return (
    <li className="space-y-3 rounded-2xl border border-gold/15 bg-white/5 p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="font-semibold text-cream">
            Jusqu&apos;au {formatDay(extension.requested_check_out)}
          </p>
          <p className="text-xs text-cream/55">
            {extension.nights} nuit{extension.nights > 1 ? "s" : ""} ·{" "}
            {formatCurrency(extension.amount)} · demandée le {formatDay(extension.created_at)}
          </p>
        </div>
        <span
          className={cn(
            "rounded-full border px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider",
            extensionStatusTone(deadlinePassed ? "EXPIREE" : extension.status)
          )}
        >
          {extensionStatusLabels[deadlinePassed ? "EXPIREE" : extension.status]}
        </span>
      </div>

      {extension.status === "EN_ATTENTE" && (
        <p className="text-xs leading-5 text-cream/60">
          Demande transmise à l&apos;équipe du Manoir. Vous recevrez un email dès sa validation ;
          rien n&apos;est à payer d&apos;ici là.
        </p>
      )}

      {extension.status === "REFUSEE" && (
        <p className="rounded-xl border border-terracotta/25 bg-terracotta/10 p-3 text-xs text-terracotta-light">
          {extension.admin_notes || "Aucun motif précisé."}
        </p>
      )}

      {awaitingPayment && !deadlinePassed && (
        <div className="space-y-3">
          {extension.admin_notes && (
            <p className="text-xs text-cream/60">{extension.admin_notes}</p>
          )}
          {extension.payment_deadline && (
            <DeadlineCountdown
              deadline={extension.payment_deadline}
              startedAt={extension.approved_at}
              label="Temps restant pour régler la prolongation"
              onExpire={onExpired}
            />
          )}
          <PaymentPanel
            target={{ kind: "extension", id: extension.id }}
            amount={extension.amount}
            onSuccess={onPaid}
          />
        </div>
      )}

      {extension.status === "PAYEE" && voucher && (
        <VoucherButton
          voucherId={voucher.id}
          label="Bon de Séjour de la prolongation"
          variant="outline"
        />
      )}
    </li>
  );
}
