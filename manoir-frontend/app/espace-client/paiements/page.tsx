"use client";

import { CreditCard, FileText, Receipt, Wallet } from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { ClientPageHeader } from "@/components/dashboard/client/ClientShell";
import { useAuth } from "@/context/AuthContext";
import { useToast } from "@/context/ToastContext";
import { api, type Payment, type Reservation } from "@/lib/api";
import {
  availableDocuments,
  documentHref,
  documentLabels,
  effectiveStatus,
  formatCurrency,
  formatDay,
  paymentLabel,
  paymentMethodLabel,
  reservationTitle,
  statusLabels,
  statusTone
} from "@/lib/reservationDisplay";
import { cn } from "@/lib/utils";

type PaymentRow = { payment: Payment; reservation: Reservation };

const paymentStatus: Record<Payment["status"], { label: string; tone: string }> = {
  success: { label: "Réussi", tone: "border-olive/40 bg-olive/15 text-olive-light" },
  pending: { label: "En cours", tone: "border-gold/40 bg-gold/15 text-gold-light" },
  failed: { label: "Échoué", tone: "border-terracotta/40 bg-terracotta/15 text-terracotta-light" }
};

export default function PaiementsPage() {
  const { user } = useAuth();
  const { showToast } = useToast();
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    api
      .getMyReservations()
      .then(setReservations)
      .catch(() => showToast("Impossible de charger vos paiements.", "error"))
      .finally(() => setLoading(false));
  }, [user, showToast]);

  const rows = useMemo<PaymentRow[]>(
    () =>
      reservations
        .flatMap((reservation) => (reservation.payments || []).map((payment) => ({ payment, reservation })))
        .sort(
          (a, b) =>
            new Date(b.payment.paid_at || b.payment.created_at).getTime() -
            new Date(a.payment.paid_at || a.payment.created_at).getTime()
        ),
    [reservations]
  );

  const totals = useMemo(() => {
    const success = rows.filter((row) => row.payment.status === "success");
    return {
      paid: success.reduce((sum, row) => sum + Number(row.payment.amount || 0), 0),
      count: success.length,
      documents: reservations.reduce((sum, reservation) => sum + availableDocuments(reservation).length, 0)
    };
  }, [rows, reservations]);

  const withDocuments = reservations.filter((reservation) => availableDocuments(reservation).length > 0);

  return (
    <div>
      <ClientPageHeader
        title="Paiements & factures"
        description="Vos règlements et l'ensemble de vos documents de séjour, au même endroit."
      />

      <div className="mb-8 grid gap-4 sm:grid-cols-3">
        <SummaryCard icon={Wallet} label="Total réglé" value={loading ? "…" : formatCurrency(totals.paid)} />
        <SummaryCard icon={CreditCard} label="Paiements réussis" value={loading ? "…" : String(totals.count)} />
        <SummaryCard icon={FileText} label="Documents disponibles" value={loading ? "…" : String(totals.documents)} />
      </div>

      {/* Historique des paiements */}
      <section className="glass-warm glass-edge mb-8 overflow-hidden rounded-3xl">
        <div className="flex items-center justify-between gap-3 border-b border-gold/15 px-5 py-4 sm:px-6">
          <h2 className="text-lg font-semibold text-cream">Historique des paiements</h2>
          <span className="text-xs text-cream/50">{rows.length} opération(s)</span>
        </div>

        {loading ? (
          <div className="space-y-3 p-6">
            {[0, 1, 2].map((index) => (
              <div key={index} className="h-12 animate-pulse rounded-xl bg-white/5" />
            ))}
          </div>
        ) : rows.length === 0 ? (
          <EmptyState
            title="Aucun paiement pour le moment"
            text="Vos règlements d'acompte et de séjour apparaîtront ici."
          />
        ) : (
          <>
            {/* Tableau (tablette et plus) */}
            <div className="hidden overflow-x-auto md:block">
              <table className="w-full text-left text-sm">
                <thead className="text-xs uppercase tracking-wider text-cream/50">
                  <tr className="border-b border-gold/10">
                    <th className="px-6 py-3 font-semibold">Date</th>
                    <th className="px-6 py-3 font-semibold">Objet</th>
                    <th className="px-6 py-3 font-semibold">Moyen</th>
                    <th className="px-6 py-3 text-right font-semibold">Montant</th>
                    <th className="px-6 py-3 font-semibold">Statut</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gold/10">
                  {rows.map(({ payment, reservation }) => (
                    <tr key={payment.id} className="transition hover:bg-white/5">
                      <td className="whitespace-nowrap px-6 py-4 text-cream/70">
                        {formatDay(payment.paid_at || payment.created_at)}
                      </td>
                      <td className="px-6 py-4">
                        <p className="font-medium text-cream">{paymentLabel(payment)}</p>
                        <p className="text-xs text-cream/50">{reservationTitle(reservation)}</p>
                      </td>
                      <td className="px-6 py-4 text-cream/70">{paymentMethodLabel(payment)}</td>
                      <td className="whitespace-nowrap px-6 py-4 text-right font-semibold text-cream">
                        {formatCurrency(payment.amount)}
                      </td>
                      <td className="px-6 py-4">
                        <Pill tone={paymentStatus[payment.status].tone}>{paymentStatus[payment.status].label}</Pill>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Liste (mobile) */}
            <ul className="divide-y divide-gold/10 md:hidden">
              {rows.map(({ payment, reservation }) => (
                <li key={payment.id} className="flex items-start justify-between gap-3 px-5 py-4">
                  <div className="min-w-0">
                    <p className="font-medium text-cream">{paymentLabel(payment)}</p>
                    <p className="truncate text-xs text-cream/50">{reservationTitle(reservation)}</p>
                    <p className="mt-1 text-xs text-cream/50">
                      {formatDay(payment.paid_at || payment.created_at)} · {paymentMethodLabel(payment)}
                    </p>
                  </div>
                  <div className="shrink-0 text-right">
                    <p className="font-semibold text-cream">{formatCurrency(payment.amount)}</p>
                    <Pill tone={cn("mt-1", paymentStatus[payment.status].tone)}>
                      {paymentStatus[payment.status].label}
                    </Pill>
                  </div>
                </li>
              ))}
            </ul>
          </>
        )}
      </section>

      {/* Documents par séjour */}
      <section>
        <h2 className="mb-4 text-lg font-semibold text-cream">Documents de séjour</h2>
        {loading ? (
          <div className="glass-warm h-32 animate-pulse rounded-3xl" />
        ) : withDocuments.length === 0 ? (
          <div className="glass-warm glass-edge rounded-3xl">
            <EmptyState
              title="Aucun document pour l'instant"
              text="Le bon de réservation apparaît dès qu'un appartement vous est retenu."
            />
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            {withDocuments.map((reservation) => {
              const status = effectiveStatus(reservation);
              return (
                <article key={reservation.id} className="glass-warm glass-edge min-w-0 rounded-2xl p-5">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate font-semibold text-cream">{reservationTitle(reservation)}</p>
                      <p className="text-xs text-cream/55">
                        {formatDay(reservation.check_in)} → {formatDay(reservation.check_out)} · Réf. #{reservation.id}
                      </p>
                    </div>
                    <Pill tone={statusTone(status)}>{statusLabels[status]}</Pill>
                  </div>
                  <div className="mt-4 flex flex-wrap gap-2">
                    {availableDocuments(reservation).map((kind) => (
                      <Link
                        key={kind}
                        href={documentHref(reservation, kind)}
                        className="inline-flex items-center gap-2 rounded-full border border-gold/25 bg-white/5 px-3.5 py-2 text-xs font-semibold text-cream transition hover:border-gold/60 hover:text-gold-light"
                      >
                        <Receipt size={14} />
                        {documentLabels[kind]}
                      </Link>
                    ))}
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}

function SummaryCard({
  icon: Icon,
  label,
  value
}: {
  icon: typeof Wallet;
  label: string;
  value: string;
}) {
  return (
    <div className="glass-warm glass-edge flex items-center gap-4 rounded-2xl p-5">
      <span className="grid size-12 shrink-0 place-items-center rounded-xl bg-gold/15 text-gold-light">
        <Icon size={22} />
      </span>
      <div className="min-w-0">
        <p className="text-sm text-cream/55">{label}</p>
        <p className="truncate font-display text-xl font-semibold text-cream">{value}</p>
      </div>
    </div>
  );
}

function Pill({ tone, children }: { tone: string; children: React.ReactNode }) {
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center rounded-full border px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider",
        tone
      )}
    >
      {children}
    </span>
  );
}

function EmptyState({ title, text }: { title: string; text: string }) {
  return (
    <div className="px-6 py-14 text-center">
      <Receipt className="mx-auto mb-4 text-gold/50" size={36} />
      <p className="font-semibold text-cream">{title}</p>
      <p className="mx-auto mt-1 max-w-sm text-sm text-cream/55">{text}</p>
    </div>
  );
}
