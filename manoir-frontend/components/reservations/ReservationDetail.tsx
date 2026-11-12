"use client";

import {
  ArrowLeft,
  Calendar,
  CheckCircle2,
  FileText,
  Hourglass,
  Mail,
  Users,
  XCircle
} from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";
import type { Reservation, ReservationStatus } from "@/lib/api";
import {
  availableDocuments,
  countNights,
  documentHref,
  documentLabels,
  formatCurrency,
  formatDateTime,
  formatDay,
  isPaidStatus,
  reservationRef,
  reservationTitle,
  reservationVouchers,
  statusLabels,
  statusTone,
  stayAmountOf,
  voucherLabel
} from "@/lib/reservationDisplay";
import { cn } from "@/lib/utils";
import { StatusStepper } from "./BookingStepper";
import DeadlineCountdown from "./DeadlineCountdown";
import ExtensionSection from "./ExtensionSection";
import PaymentPanel from "./PaymentPanel";
import VoucherButton from "./VoucherButton";

/** Détail d'une réservation : où en est-elle, et quelle est la prochaine action. */
export default function ReservationDetail({
  reservation,
  status,
  canCancel,
  onRefresh,
  onCancel,
  onPaid
}: {
  reservation: Reservation;
  /** Statut affiché (un délai de paiement dépassé est montré comme expiré). */
  status: ReservationStatus;
  canCancel: boolean;
  onRefresh: () => void;
  onCancel: () => void;
  onPaid: () => void;
}) {
  const nights = countNights(reservation.check_in, reservation.check_out);
  const amount = stayAmountOf(reservation);

  return (
    <div className="space-y-6">
      <Link
        href="/espace-client/reservations"
        className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-cream/60 transition hover:text-gold-light"
      >
        <ArrowLeft size={14} /> Toutes mes réservations
      </Link>

      <article className="glass-warm glass-edge space-y-8 rounded-3xl p-5 sm:p-8">
        <header className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-[10px] uppercase tracking-widest text-cream/45">
              Réservation {reservationRef(reservation)}
            </p>
            <h2 className="mt-1 font-display text-2xl font-bold uppercase tracking-wide text-cream sm:text-3xl">
              {reservationTitle(reservation)}
            </h2>
          </div>
          <span
            className={cn(
              "rounded-full border px-3 py-1 text-[10px] font-bold uppercase tracking-wider",
              statusTone(status)
            )}
          >
            {statusLabels[status]}
          </span>
        </header>

        <StatusStepper status={status} />

        <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_300px]">
          <div className="min-w-0 space-y-6">
            <StatusPanel
              reservation={reservation}
              status={status}
              amount={amount}
              onRefresh={onRefresh}
              onPaid={onPaid}
            />

            {isPaidStatus(status) && reservation.room_id && (
              <div className="border-t border-gold/10 pt-6">
                <ExtensionSection reservation={reservation} onReservationChanged={onRefresh} />
              </div>
            )}
          </div>

          <aside className="space-y-4 border-t border-gold/15 pt-6 lg:border-l lg:border-t-0 lg:pl-8 lg:pt-0">
            <InfoRow
              icon={<Calendar size={16} />}
              label="Arrivée"
              value={formatDay(reservation.check_in, {
                weekday: "short",
                day: "numeric",
                month: "long",
                year: "numeric"
              })}
            />
            <InfoRow
              icon={<Calendar size={16} />}
              label="Départ"
              value={formatDay(reservation.check_out, {
                weekday: "short",
                day: "numeric",
                month: "long",
                year: "numeric"
              })}
            />
            <InfoRow
              icon={<Users size={16} />}
              label="Voyageurs"
              value={`${reservation.guests} · ${nights} nuit${nights > 1 ? "s" : ""}`}
            />

            <div className="rounded-2xl border border-gold/10 bg-white/5 p-4">
              <p className="text-[9px] uppercase tracking-widest text-cream/45">
                Montant du séjour
              </p>
              <p className="mt-1 font-display text-2xl font-bold text-cream">
                {formatCurrency(amount)}
              </p>
              {status === "CONFIRMEE" && reservation.deposit_amount ? (
                <p className="mt-1 text-[11px] text-cream/50">
                  Acompte versé : {formatCurrency(reservation.deposit_amount)}
                </p>
              ) : null}
            </div>

            {reservation.special_requests && (
              <div className="rounded-2xl border border-gold/15 bg-white/5 p-4 text-xs text-cream/70">
                <span className="mb-1 block text-[9px] uppercase tracking-wider text-gold/70">
                  Demandes spéciales
                </span>
                {reservation.special_requests}
              </div>
            )}

            {reservation.admin_notes && (
              <div className="rounded-2xl border border-gold/20 bg-gold/[0.06] p-4 text-xs text-cream/75">
                <span className="mb-1 block text-[9px] uppercase tracking-wider text-gold/70">
                  Message du Manoir
                </span>
                {reservation.admin_notes}
              </div>
            )}

            {availableDocuments(reservation).length > 0 && (
              <div className="space-y-2">
                <p className="text-[9px] uppercase tracking-widest text-cream/45">
                  Autres documents
                </p>
                {availableDocuments(reservation).map((kind) => (
                  <Link
                    key={kind}
                    href={documentHref(reservation, kind)}
                    className="flex items-center gap-2 rounded-xl border border-gold/20 px-4 py-2.5 text-[10px] font-black uppercase tracking-wider text-cream transition hover:border-gold/40 hover:bg-white/10 hover:text-gold-light"
                  >
                    <FileText size={14} /> {documentLabels[kind]}
                  </Link>
                ))}
              </div>
            )}

            {canCancel && (
              <button
                type="button"
                onClick={onCancel}
                className="flex w-full items-center justify-center gap-2 rounded-xl border border-terracotta/40 px-5 py-3 text-[10px] font-black uppercase tracking-wider text-terracotta-light transition hover:bg-terracotta hover:text-white"
              >
                <XCircle size={14} /> Annuler ma réservation
              </button>
            )}
          </aside>
        </div>
      </article>
    </div>
  );
}

function StatusPanel({
  reservation,
  status,
  amount,
  onRefresh,
  onPaid
}: {
  reservation: Reservation;
  status: ReservationStatus;
  amount: number;
  onRefresh: () => void;
  onPaid: () => void;
}) {
  if (status === "EN_ATTENTE") {
    return (
      <Panel icon={<Hourglass size={20} />} title="Demande envoyée · en attente de validation">
        <p>
          L&apos;équipe du Manoir vérifie votre demande. Vous recevrez un{" "}
          <strong className="text-cream">email</strong> dès qu&apos;elle sera validée : le paiement
          s&apos;ouvrira alors ici, avec un délai pour le régler.
        </p>
        <p className="mt-2 flex items-center gap-2 text-cream/55">
          <Mail size={14} /> Aucun paiement n&apos;est demandé pour l&apos;instant.
        </p>
      </Panel>
    );
  }

  if (status === "VALIDEE_PAIEMENT_REQUIS") {
    return (
      <div className="space-y-4">
        <Panel
          icon={<CheckCircle2 size={20} />}
          title="Demande validée · réglez votre séjour"
          tone="olive"
        >
          <p>
            Bonne nouvelle : votre demande est acceptée. Réglez le séjour complet (
            {formatCurrency(amount)}) pour le confirmer. Votre Bon de Séjour sera disponible
            aussitôt le paiement reçu.
          </p>
        </Panel>
        {reservation.payment_deadline && (
          <DeadlineCountdown
            deadline={reservation.payment_deadline}
            startedAt={reservation.approved_at}
            onExpire={onRefresh}
          />
        )}
        <PaymentPanel
          target={{ kind: "reservation", id: reservation.id }}
          amount={amount}
          onSuccess={onPaid}
        />
      </div>
    );
  }

  if (isPaidStatus(status)) {
    const vouchers = reservationVouchers(reservation);
    const main = vouchers.find((voucher) => !voucher.stay_extension_id);
    const others = vouchers.filter((voucher) => voucher !== main);

    return (
      <Panel icon={<CheckCircle2 size={20} />} title="Séjour confirmé" tone="olive">
        {main ? (
          <div className="space-y-3">
            <p>
              Paiement reçu le {formatDateTime(main.issued_at)}. Présentez votre Bon de Séjour à
              votre arrivée.
            </p>
            <div className="flex flex-wrap items-center gap-3">
              <VoucherButton voucherId={main.id} />
              <span className="text-[11px] text-cream/50">N° {main.number}</span>
            </div>
          </div>
        ) : status === "CONFIRMEE" ? (
          <p>
            Votre réservation est confirmée par le versement de l&apos;acompte (ancienne formule).
          </p>
        ) : (
          <p>
            Paiement reçu. Votre Bon de Séjour est en cours de préparation : actualisez la page dans
            un instant.
          </p>
        )}
        {others.length > 0 && (
          <div className="mt-4 space-y-2 border-t border-olive/20 pt-4">
            {others.map((voucher) => (
              <div key={voucher.id} className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-xs text-cream/65">
                  {voucherLabel(voucher)} · {formatCurrency(voucher.amount)}
                </span>
                <VoucherButton voucherId={voucher.id} label="Télécharger" variant="outline" />
              </div>
            ))}
          </div>
        )}
      </Panel>
    );
  }

  const messages: Partial<Record<ReservationStatus, string>> = {
    REFUSEE:
      "Votre demande n'a pas pu être acceptée. Consultez le message du Manoir et choisissez d'autres dates si vous le souhaitez.",
    EXPIREE:
      "Le délai de paiement est dépassé : l'appartement a été remis à la location. Vous pouvez refaire une demande.",
    ANNULEE: "Cette réservation a été annulée.",
    REMBOURSEE: "Le remboursement de cette réservation a été effectué.",
    LIBEREE: "L'occupation a été clôturée par l'administration."
  };

  return (
    <Panel icon={<XCircle size={20} />} title={statusLabels[status]} tone="terracotta">
      <p>{messages[status] ?? "Cette réservation est close."}</p>
      <Link
        href="/rooms"
        className="mt-4 inline-flex items-center gap-2 rounded-full bg-gradient-to-br from-gold-light to-gold px-5 py-2.5 text-[11px] font-bold uppercase tracking-[0.14em] text-night transition hover:brightness-105"
      >
        Nouvelle demande
      </Link>
    </Panel>
  );
}

const panelTones = {
  gold: "border-gold/25 bg-white/5 [&_.panel-icon]:text-gold-light",
  olive: "border-olive/35 bg-olive/10 [&_.panel-icon]:text-olive-light",
  terracotta: "border-terracotta/35 bg-terracotta/10 [&_.panel-icon]:text-terracotta-light"
} as const;

function Panel({
  icon,
  title,
  tone = "gold",
  children
}: {
  icon: ReactNode;
  title: string;
  tone?: keyof typeof panelTones;
  children: ReactNode;
}) {
  return (
    <div className={cn("rounded-2xl border p-5", panelTones[tone])}>
      <div className="flex items-start gap-3">
        <span className="panel-icon mt-0.5 shrink-0">{icon}</span>
        <div className="min-w-0 flex-1 text-sm leading-6 text-cream/70">
          <p className="mb-1 font-semibold text-cream">{title}</p>
          {children}
        </div>
      </div>
    </div>
  );
}

function InfoRow({ icon, label, value }: { icon: ReactNode; label: string; value: string }) {
  return (
    <div className="flex items-center gap-3">
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-gold/15 bg-white/5 text-gold/80">
        {icon}
      </span>
      <div className="min-w-0">
        <p className="text-[10px] uppercase tracking-widest text-cream/45">{label}</p>
        <p className="font-semibold capitalize text-cream">{value}</p>
      </div>
    </div>
  );
}
