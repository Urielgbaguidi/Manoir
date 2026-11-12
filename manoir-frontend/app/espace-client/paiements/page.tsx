"use client";

import { Eye } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import DataTable, {
  IconAction,
  TableBadge,
  useLocalTable,
  type BadgeTone,
  type DataTableColumn
} from "@/components/dashboard/admin/DataTable";
import { ClientPageHeader } from "@/components/dashboard/client/ClientShell";
import { useAuth } from "@/context/AuthContext";
import { useToast } from "@/context/ToastContext";
import { api, type Payment, type Reservation } from "@/lib/api";
import {
  formatCurrency,
  formatShortDay,
  paymentLabel,
  paymentMethodLabel,
  reservationHref,
  reservationRef,
  reservationTitle
} from "@/lib/reservationDisplay";

type PaymentRow = { payment: Payment; reservation: Reservation };

const paymentStatus: Record<Payment["status"], { label: string; tone: BadgeTone }> = {
  success: { label: "Réussi", tone: "success" },
  pending: { label: "En cours", tone: "warning" },
  failed: { label: "Échoué", tone: "error" }
};

const paymentDate = (payment: Payment) => payment.paid_at || payment.created_at;

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

  const data = useMemo<PaymentRow[]>(
    () =>
      reservations.flatMap((reservation) =>
        (reservation.payments || []).map((payment) => ({ payment, reservation }))
      ),
    [reservations]
  );

  const table = useLocalTable(data, {
    initialSort: "date",
    initialDirection: "desc",
    searchText: ({ payment, reservation }) =>
      [
        paymentLabel(payment),
        reservationTitle(reservation),
        paymentMethodLabel(payment),
        paymentStatus[payment.status].label,
        formatShortDay(paymentDate(payment)),
        String(payment.amount),
        reservationRef(reservation)
      ].join(" "),
    sortValue: ({ payment }, key) => {
      if (key === "date") return new Date(paymentDate(payment)).getTime();
      if (key === "amount") return payment.amount;
      if (key === "method") return paymentMethodLabel(payment);
      if (key === "status") return paymentStatus[payment.status].label;
      return null;
    }
  });

  const columns: DataTableColumn<PaymentRow>[] = [
    {
      key: "date",
      header: "Date",
      sortKey: "date",
      render: ({ payment }) => formatShortDay(paymentDate(payment))
    },
    {
      key: "object",
      header: "Objet",
      render: ({ payment, reservation }) => (
        <div>
          <p className="font-medium text-cream">{paymentLabel(payment)}</p>
          <p className="text-xs text-cream/50">
            {reservationTitle(reservation)} · {reservationRef(reservation)}
          </p>
        </div>
      )
    },
    {
      key: "method",
      header: "Moyen de paiement",
      sortKey: "method",
      render: ({ payment }) => paymentMethodLabel(payment)
    },
    {
      key: "amount",
      header: "Montant",
      sortKey: "amount",
      align: "right",
      render: ({ payment }) => (
        <span className="font-semibold text-cream">{formatCurrency(payment.amount)}</span>
      )
    },
    {
      key: "status",
      header: "Statut",
      sortKey: "status",
      render: ({ payment }) => (
        <TableBadge tone={paymentStatus[payment.status].tone}>
          {paymentStatus[payment.status].label}
        </TableBadge>
      )
    },
    {
      key: "actions",
      header: <span className="sr-only">Actions</span>,
      align: "right",
      render: ({ reservation }) => (
        <IconAction label="Voir la réservation" icon={Eye} href={reservationHref(reservation.id)} />
      )
    }
  ];

  return (
    <div>
      <ClientPageHeader title="Paiements" description="L'historique de vos règlements en ligne." />

      <DataTable
        {...table}
        title="Historique des paiements"
        columns={columns}
        rowKey={({ payment }) => payment.id}
        loading={loading}
        searchPlaceholder="Rechercher un paiement…"
        emptyTitle={data.length ? "Aucun résultat" : "Aucun paiement pour le moment"}
        emptyMessage={
          data.length
            ? "Modifiez votre recherche pour trouver ce que vous cherchez."
            : "Vos paiements de séjour et de prolongation apparaîtront ici."
        }
      />
    </div>
  );
}
