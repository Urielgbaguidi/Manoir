"use client";

import { Download, FileText } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import DataTable, {
  IconAction,
  useLocalTable,
  type DataTableColumn
} from "@/components/dashboard/admin/DataTable";
import { ClientPageHeader } from "@/components/dashboard/client/ClientShell";
import VoucherButton from "@/components/reservations/VoucherButton";
import { useAuth } from "@/context/AuthContext";
import { useToast } from "@/context/ToastContext";
import { api, type Reservation } from "@/lib/api";
import {
  availableDocuments,
  documentHref,
  documentLabels,
  formatCurrency,
  formatShortDay,
  formatStayPeriod,
  reservationRef,
  reservationTitle,
  reservationVouchers,
  voucherLabel
} from "@/lib/reservationDisplay";

type InvoiceRow = {
  key: string;
  label: string;
  number: string | null;
  reservation: Reservation;
  date: string | null;
  amount: number | null;
} & ({ kind: "voucher"; voucherId: number } | { kind: "document"; href: string });

function invoiceRows(reservation: Reservation): InvoiceRow[] {
  const vouchers: InvoiceRow[] = reservationVouchers(reservation).map((voucher) => ({
    key: `voucher-${voucher.id}`,
    kind: "voucher",
    voucherId: voucher.id,
    label: voucherLabel(voucher),
    number: voucher.number,
    reservation,
    date: voucher.issued_at,
    amount: voucher.amount
  }));

  const documents: InvoiceRow[] = availableDocuments(reservation).map((kind) => ({
    key: `document-${reservation.id}-${kind}`,
    kind: "document",
    href: documentHref(reservation, kind),
    label: documentLabels[kind],
    number:
      kind === "deposit"
        ? (reservation.deposit_invoice_number ?? null)
        : kind === "stay"
          ? (reservation.stay_invoice_number ?? null)
          : null,
    reservation,
    date: kind === "cancellation" ? (reservation.cancelled_at ?? null) : null,
    amount: null
  }));

  return [...vouchers, ...documents];
}

export default function FacturesPage() {
  const { user } = useAuth();
  const { showToast } = useToast();
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    api
      .getMyReservations()
      .then(setReservations)
      .catch(() => showToast("Impossible de charger vos factures.", "error"))
      .finally(() => setLoading(false));
  }, [user, showToast]);

  const data = useMemo(() => reservations.flatMap(invoiceRows), [reservations]);

  const table = useLocalTable(data, {
    initialSort: "date",
    initialDirection: "desc",
    searchText: (row) =>
      [
        row.label,
        row.number ?? "",
        reservationTitle(row.reservation),
        reservationRef(row.reservation),
        formatStayPeriod(row.reservation),
        row.date ? formatShortDay(row.date) : ""
      ].join(" "),
    sortValue: (row, key) => {
      if (key === "date") return row.date ? new Date(row.date).getTime() : null;
      if (key === "amount") return row.amount;
      if (key === "document") return row.label;
      return null;
    }
  });

  const columns: DataTableColumn<InvoiceRow>[] = [
    {
      key: "document",
      header: "Document",
      sortKey: "document",
      render: (row) => (
        <div className="flex items-center gap-3">
          <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-gold/15 text-gold-light">
            <FileText size={16} />
          </span>
          <div>
            <p className="font-medium text-cream">{row.label}</p>
            {row.number && <p className="text-xs text-cream/50">N° {row.number}</p>}
          </div>
        </div>
      )
    },
    {
      key: "reservation",
      header: "Séjour",
      render: ({ reservation }) => (
        <div>
          <p className="text-cream/80">{reservationTitle(reservation)}</p>
          <p className="text-xs text-cream/50">{formatStayPeriod(reservation)}</p>
        </div>
      )
    },
    {
      key: "date",
      header: "Émis le",
      sortKey: "date",
      render: (row) => (row.date ? formatShortDay(row.date) : "—")
    },
    {
      key: "amount",
      header: "Montant",
      sortKey: "amount",
      align: "right",
      render: (row) =>
        row.amount != null ? (
          <span className="font-semibold text-cream">{formatCurrency(row.amount)}</span>
        ) : (
          "—"
        )
    },
    {
      key: "actions",
      header: "Télécharger",
      align: "right",
      render: (row) =>
        row.kind === "voucher" ? (
          <VoucherButton
            voucherId={row.voucherId}
            label={`Télécharger ${row.label}`}
            variant="icon"
          />
        ) : (
          <IconAction label={`Télécharger ${row.label}`} icon={Download} href={row.href} />
        )
    }
  ];

  return (
    <div>
      <ClientPageHeader
        title="Factures"
        description="Vos Bons de Séjour et documents, à télécharger à tout moment."
      />

      <DataTable
        {...table}
        title="Mes factures"
        columns={columns}
        rowKey={(row) => row.key}
        loading={loading}
        searchPlaceholder="Rechercher un document…"
        emptyTitle={data.length ? "Aucun résultat" : "Aucune facture pour l'instant"}
        emptyMessage={
          data.length
            ? "Modifiez votre recherche pour trouver ce que vous cherchez."
            : "Votre Bon de Séjour apparaît dès que le paiement de votre séjour est confirmé."
        }
      />
    </div>
  );
}
