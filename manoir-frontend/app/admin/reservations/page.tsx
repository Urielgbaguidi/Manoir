"use client";

import { Suspense, useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import {
  BedDouble,
  CalendarPlus,
  Check,
  Download,
  Eye,
  Mail,
  Phone,
  RefreshCcw,
  X,
  type LucideIcon
} from "lucide-react";
import { useToast } from "@/context/ToastContext";
import {
  api,
  type AdminTableQuery,
  type Paginated,
  type Reservation,
  type Room,
  type StayExtension,
  type User
} from "@/lib/api";
import { cn } from "@/lib/utils";
import { AdminPageHeader } from "@/components/dashboard/admin/AdminShell";
import DataTable, {
  FilterField,
  IconAction,
  TableBadge,
  filterInputClass,
  type BadgeTone,
  type DataTableColumn,
  type SortDirection
} from "@/components/dashboard/admin/DataTable";

/* ---------------------------------------------------------------------------
 * Libelles et constantes
 * ------------------------------------------------------------------------- */

type RequestType = "reservation" | "extension";

const reservationStatusLabels: Record<string, string> = {
  EN_ATTENTE: "En attente",
  VALIDEE_PAIEMENT_REQUIS: "Validée – paiement attendu",
  CONFIRMEE: "Confirmée",
  SEJOUR_PAYE: "Séjour payé",
  REFUSEE: "Refusée",
  EXPIREE: "Expirée",
  ANNULEE: "Annulée",
  REMBOURSEE: "Remboursée",
  LIBEREE: "Appartement libéré"
};

const extensionStatusLabels: Record<string, string> = {
  EN_ATTENTE: "En attente",
  VALIDEE_PAIEMENT_REQUIS: "Validée – paiement attendu",
  PAYEE: "Payée",
  REFUSEE: "Refusée",
  EXPIREE: "Expirée"
};

/** Options du filtre « Statut » : une option peut regrouper plusieurs statuts. */
const statusOptions: Record<RequestType, { key: string; label: string; statuses: string[] }[]> = {
  reservation: [
    { key: "EN_ATTENTE", label: "En attente", statuses: ["EN_ATTENTE"] },
    {
      key: "VALIDEE_PAIEMENT_REQUIS",
      label: "Validée – paiement attendu",
      statuses: ["VALIDEE_PAIEMENT_REQUIS"]
    },
    { key: "PAYEE", label: "Payée", statuses: ["SEJOUR_PAYE", "CONFIRMEE"] },
    { key: "REFUSEE", label: "Refusée", statuses: ["REFUSEE"] },
    { key: "EXPIREE", label: "Expirée", statuses: ["EXPIREE"] },
    { key: "ANNULEE", label: "Annulée", statuses: ["ANNULEE"] },
    { key: "REMBOURSEE", label: "Remboursée", statuses: ["REMBOURSEE"] },
    { key: "LIBEREE", label: "Appartement libéré", statuses: ["LIBEREE"] }
  ],
  extension: [
    { key: "EN_ATTENTE", label: "En attente", statuses: ["EN_ATTENTE"] },
    {
      key: "VALIDEE_PAIEMENT_REQUIS",
      label: "Validée – paiement attendu",
      statuses: ["VALIDEE_PAIEMENT_REQUIS"]
    },
    { key: "PAYEE", label: "Payée", statuses: ["PAYEE"] },
    { key: "REFUSEE", label: "Refusée", statuses: ["REFUSEE"] },
    { key: "EXPIREE", label: "Expirée", statuses: ["EXPIREE"] }
  ]
};

/** Cles de tri acceptees par l'API, par type de demande. */
const sortKeys: Record<RequestType, string[]> = {
  reservation: ["id", "created_at", "check_in", "check_out", "status", "amount"],
  extension: ["id", "created_at", "requested_check_out", "status", "amount"]
};

const categoryLabels: Record<string, string> = {
  vip: "Appartement VIP",
  deux_chambres: "Appartement 2 Chambres",
  une_chambre: "Appartement 1 Chambre"
};

const DEFAULT_SORT = "created_at";
const DEFAULT_DIRECTION: SortDirection = "desc";
const DEFAULT_PER_PAGE = 10;

const statusTones: Record<string, BadgeTone> = {
  EN_ATTENTE: "warning",
  VALIDEE_PAIEMENT_REQUIS: "info",
  CONFIRMEE: "success",
  SEJOUR_PAYE: "success",
  PAYEE: "success",
  REFUSEE: "error",
  ANNULEE: "error",
  LIBEREE: "info"
};

function StatusBadge({ status, labels }: { status: string; labels: Record<string, string> }) {
  return (
    <TableBadge tone={statusTones[status] ?? "neutral"}>{labels[status] || status}</TableBadge>
  );
}

/* ---------------------------------------------------------------------------
 * Utilitaires d'affichage
 * ------------------------------------------------------------------------- */

const parseDate = (value?: string | null) => {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
};

const formatDate = (value?: string | null) => parseDate(value)?.toLocaleDateString("fr-FR") || "—";

const formatDateTime = (value?: string | null) =>
  parseDate(value)?.toLocaleString("fr-FR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  }) || "—";

const formatAmount = (value?: number | null) => `${(value ?? 0).toLocaleString("fr-FR")} FCFA`;

const countNights = (start?: string | null, end?: string | null) => {
  const from = parseDate(start);
  const to = parseDate(end);
  if (!from || !to) return 0;
  return Math.max(1, Math.round((to.getTime() - from.getTime()) / (1000 * 60 * 60 * 24)));
};

const reservationAmount = (reservation: Reservation) =>
  reservation.stay_amount ?? reservation.total_price;

const apartmentLabel = (room?: Room, categoryType?: string) => {
  if (room?.apartment_number) {
    const label =
      categoryType === "vip"
        ? room.name
        : categoryType === "deux_chambres"
          ? "2 Chambres"
          : categoryType === "une_chambre"
            ? "1 Chambre"
            : room.name;
    return `Appartement N°${room.apartment_number} · ${label}`;
  }
  return categoryLabels[categoryType || ""] || room?.name || "Appartement";
};

const extensionClient = (extension: StayExtension) => extension.reservation?.user ?? extension.user;

const emptyPage = <T,>(): Paginated<T> => ({
  data: [],
  current_page: 1,
  last_page: 1,
  per_page: DEFAULT_PER_PAGE,
  total: 0,
  from: null,
  to: null
});

type TableState =
  | { type: "reservation"; data: Paginated<Reservation> }
  | { type: "extension"; data: Paginated<StayExtension> };

type PendingAction =
  | { kind: "reservation"; action: "approve" | "reject"; item: Reservation }
  | { kind: "extension"; action: "approve" | "reject"; item: StayExtension };

type DetailsTarget =
  { kind: "reservation"; item: Reservation } | { kind: "extension"; item: StayExtension };

/** Action disponible sur une demande : icône dans le tableau, bouton libellé dans la fiche. */
type RowCommand = {
  label: string;
  icon: LucideIcon;
  tone: "success" | "danger";
  disabled?: boolean;
  run: () => void;
};

/* ---------------------------------------------------------------------------
 * Page
 * ------------------------------------------------------------------------- */

export default function AdminReservationsPage() {
  // useSearchParams (liens des e-mails admin) impose une frontiere Suspense en export statique.
  return (
    <Suspense fallback={<AdminLoader />}>
      <AdminRequests />
    </Suspense>
  );
}

function AdminLoader() {
  return (
    <div className="flex min-h-[50vh] items-center justify-center">
      <div className="h-10 w-10 animate-spin rounded-full border-[3px] border-gold border-t-transparent" />
    </div>
  );
}

function AdminRequests() {
  const { showToast } = useToast();
  const router = useRouter();
  const pathname = usePathname() || "/admin/reservations";
  const searchParams = useSearchParams();

  // Lien profond : /admin/reservations?type=extension&id=45
  const linkType: RequestType =
    searchParams.get("type") === "extension" ? "extension" : "reservation";
  const rawLinkId = Number(searchParams.get("id"));
  const linkId = Number.isInteger(rawLinkId) && rawLinkId > 0 ? rawLinkId : null;
  const legacyQuery = searchParams.get("q") || "";
  const initialSearch = linkId ? `#${linkId}` : legacyQuery.trim();

  /* ---- Filtres (tous appliques cote serveur) ---- */
  const [type, setType] = useState<RequestType>(linkType);
  const [focusId, setFocusId] = useState<number | null>(linkId);
  const [search, setSearch] = useState(initialSearch);
  const [statusKey, setStatusKey] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [dateField, setDateField] = useState<"stay" | "created">("stay");
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(DEFAULT_PER_PAGE);
  const [sort, setSort] = useState(DEFAULT_SORT);
  const [direction, setDirection] = useState<SortDirection>(DEFAULT_DIRECTION);

  /* ---- Donnees ---- */
  const [table, setTable] = useState<TableState>({
    type: linkType,
    data: emptyPage()
  } as TableState);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const requestId = useRef(0);
  const autoOpened = useRef<string | null>(null);

  /* ---- Actions ---- */
  const [pending, setPending] = useState<PendingAction | null>(null);
  const [details, setDetails] = useState<DetailsTarget | null>(null);
  const [adminNotes, setAdminNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [actionError, setActionError] = useState("");
  const [exportingReport, setExportingReport] = useState(false);

  // Nouveau lien profond alors que la page est deja ouverte (clic dans un autre e-mail).
  useEffect(() => {
    setType(linkType);
    setFocusId(linkId);
    if (linkId || legacyQuery) {
      setSearch(linkId ? `#${linkId}` : legacyQuery.trim());
      setStatusKey("");
      setDateFrom("");
      setDateTo("");
      setPage(1);
    }
  }, [linkType, linkId, legacyQuery]);

  const loadRequests = useCallback(async () => {
    const statuses = statusOptions[type].find((option) => option.key === statusKey)?.statuses;
    const query: AdminTableQuery = {
      page,
      per_page: perPage,
      search: search || undefined,
      status: statuses,
      date_from: dateFrom || undefined,
      date_to: dateTo || undefined,
      date_field: dateFrom || dateTo ? dateField : undefined,
      sort,
      direction
    };

    const current = ++requestId.current;
    setLoading(true);
    setLoadError(null);
    try {
      const next: TableState =
        type === "reservation"
          ? { type, data: await api.getAdminReservations(query) }
          : { type, data: await api.getAdminExtensions(query) };
      if (current !== requestId.current) return;
      if (
        next.data.data.length === 0 &&
        next.data.current_page > 1 &&
        next.data.last_page < next.data.current_page
      ) {
        setPage(Math.max(1, next.data.last_page));
        return;
      }
      setTable(next);
    } catch (err) {
      if (current !== requestId.current) return;
      setTable({ type, data: emptyPage() } as TableState);
      setLoadError(err instanceof Error ? err.message : "Impossible de charger les demandes.");
    } finally {
      if (current === requestId.current) setLoading(false);
    }
  }, [type, statusKey, page, perPage, search, dateFrom, dateTo, dateField, sort, direction]);

  useEffect(() => {
    loadRequests();
  }, [loadRequests]);

  // Lien profond : ouvre la fiche de la demande ciblee une fois chargee.
  useEffect(() => {
    if (!focusId || loading || table.type !== type) return;
    const marker = `${type}-${focusId}`;
    if (autoOpened.current === marker) return;
    if (table.type === "reservation") {
      const item = table.data.data.find((row) => row.id === focusId);
      if (item) {
        autoOpened.current = marker;
        setDetails({ kind: "reservation", item });
      }
    } else {
      const item = table.data.data.find((row) => row.id === focusId);
      if (item) {
        autoOpened.current = marker;
        setDetails({ kind: "extension", item });
      }
    }
  }, [focusId, loading, table, type]);

  /* ---- Changements de filtres ---- */

  const changeType = (next: RequestType) => {
    if (next === type) return;
    setType(next);
    setStatusKey("");
    setFocusId(null);
    if (!sortKeys[next].includes(sort)) {
      setSort(DEFAULT_SORT);
      setDirection(DEFAULT_DIRECTION);
    }
    setPage(1);
  };

  const isFiltered =
    search !== "" ||
    statusKey !== "" ||
    dateFrom !== "" ||
    dateTo !== "" ||
    dateField !== "stay" ||
    sort !== DEFAULT_SORT ||
    direction !== DEFAULT_DIRECTION ||
    perPage !== DEFAULT_PER_PAGE;

  const resetFilters = () => {
    setSearch("");
    setStatusKey("");
    setDateFrom("");
    setDateTo("");
    setDateField("stay");
    setSort(DEFAULT_SORT);
    setDirection(DEFAULT_DIRECTION);
    setPerPage(DEFAULT_PER_PAGE);
    setPage(1);
    setFocusId(null);
    // Retire ?id= / ?q= de l'adresse pour qu'un rechargement ne reapplique pas le lien.
    if (searchParams.get("id") || searchParams.get("q")) {
      router.replace(`${pathname}?type=${type}`);
    }
  };

  /* ---- Actions administrateur ---- */

  const openAction = (next: PendingAction) => {
    setPending(next);
    setAdminNotes("");
    setActionError("");
  };

  const submitAction = async () => {
    if (!pending) return;
    if (pending.action === "reject" && !adminNotes.trim()) {
      setActionError("Un motif est obligatoire pour refuser une demande.");
      return;
    }

    setSubmitting(true);
    setActionError("");
    try {
      const notes = adminNotes.trim();
      let message: string;
      if (pending.kind === "reservation") {
        message =
          pending.action === "approve"
            ? (await api.approveReservation(pending.item.id, { admin_notes: notes || undefined }))
                .message
            : (await api.rejectReservation(pending.item.id, { admin_notes: notes })).message;
      } else {
        message =
          pending.action === "approve"
            ? (await api.approveExtension(pending.item.id, { admin_notes: notes || undefined }))
                .message
            : (await api.rejectExtension(pending.item.id, { admin_notes: notes })).message;
      }
      showToast(message, "success");
      setPending(null);
      setDetails(null);
      loadRequests();
    } catch (err) {
      const message = err instanceof Error ? err.message : "L'action a échoué.";
      setActionError(message);
      showToast(message, "error");
    } finally {
      setSubmitting(false);
    }
  };

  const markRefunded = async (reservation: Reservation) => {
    if (!confirm(`Confirmer le remboursement de la réservation #${reservation.id} ?`)) return;
    setSubmitting(true);
    try {
      const response = await api.markReservationRefunded(reservation.id);
      showToast(response.message || "Remboursement marqué comme effectué.", "success");
      setDetails(null);
      loadRequests();
    } catch (err) {
      showToast(
        err instanceof Error ? err.message : "Le remboursement n'a pas pu être confirmé.",
        "error"
      );
    } finally {
      setSubmitting(false);
    }
  };

  const exportPdf = async () => {
    if (table.type !== "reservation" || table.data.data.length === 0 || exportingReport) return;
    setExportingReport(true);
    try {
      const statusLabel =
        statusOptions.reservation.find((option) => option.key === statusKey)?.label || "Toutes";
      const { blob, filename } = await api.downloadAdminReservationsReport({
        reservation_ids: table.data.data.map((reservation) => reservation.id),
        filter_label: statusLabel,
        search: search || undefined,
        date_from: dateFrom || undefined,
        date_to: dateTo || undefined
      });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      showToast("Le rapport PDF a été généré avec succès.", "success");
    } catch (err) {
      showToast(
        err instanceof Error ? err.message : "Impossible de générer le rapport PDF.",
        "error"
      );
    } finally {
      setExportingReport(false);
    }
  };

  /* ---- Colonnes ---- */

  const clientCell = (person?: User) => (
    <span className="font-medium text-cream">{person?.name || "Client inconnu"}</span>
  );

  /** Actions possibles selon le statut (communes au tableau et à la fiche détaillée). */
  const reservationCommands = (reservation: Reservation): RowCommand[] => [
    ...(reservation.status === "EN_ATTENTE"
      ? [
          {
            label: "Valider",
            icon: Check,
            tone: "success" as const,
            run: () => openAction({ kind: "reservation", action: "approve", item: reservation })
          }
        ]
      : []),
    ...(reservation.status === "EN_ATTENTE" || reservation.status === "VALIDEE_PAIEMENT_REQUIS"
      ? [
          {
            label: "Refuser",
            icon: X,
            tone: "danger" as const,
            run: () => openAction({ kind: "reservation", action: "reject", item: reservation })
          }
        ]
      : []),
    ...(reservation.status === "ANNULEE"
      ? [
          {
            label: "Marquer comme remboursée",
            icon: RefreshCcw,
            tone: "success" as const,
            disabled: submitting,
            run: () => markRefunded(reservation)
          }
        ]
      : [])
  ];

  const extensionCommands = (extension: StayExtension): RowCommand[] => [
    ...(extension.status === "EN_ATTENTE"
      ? [
          {
            label: "Valider",
            icon: Check,
            tone: "success" as const,
            run: () => openAction({ kind: "extension", action: "approve", item: extension })
          }
        ]
      : []),
    ...(extension.status === "EN_ATTENTE" || extension.status === "VALIDEE_PAIEMENT_REQUIS"
      ? [
          {
            label: "Refuser",
            icon: X,
            tone: "danger" as const,
            run: () => openAction({ kind: "extension", action: "reject", item: extension })
          }
        ]
      : [])
  ];

  const rowActions = (onView: () => void, commands: RowCommand[]) => (
    <div className="inline-flex items-center gap-2">
      <IconAction label="Voir le détail" icon={Eye} onClick={onView} />
      {commands.map((command) => (
        <IconAction
          key={command.label}
          label={command.label}
          icon={command.icon}
          tone={command.tone}
          disabled={command.disabled}
          onClick={command.run}
        />
      ))}
    </div>
  );

  const reservationColumns: DataTableColumn<Reservation>[] = [
    {
      key: "id",
      header: "N°",
      sortKey: "id",
      className: "font-semibold text-cream",
      render: (r) => `#${r.id}`
    },
    { key: "client", header: "Client", render: (r) => clientCell(r.user) },
    {
      key: "room",
      header: "Appartement",
      className: "min-w-[180px]",
      render: (r) => apartmentLabel(r.room, r.category_type)
    },
    {
      key: "check_in",
      header: "Arrivée",
      sortKey: "check_in",
      className: "whitespace-nowrap",
      render: (r) => formatDate(r.check_in)
    },
    {
      key: "check_out",
      header: "Départ",
      sortKey: "check_out",
      className: "whitespace-nowrap",
      render: (r) => (
        <>
          {formatDate(r.check_out)}
          <span className="block text-xs text-cream/45">
            {countNights(r.check_in, r.check_out)} nuit(s)
          </span>
        </>
      )
    },
    {
      key: "amount",
      header: "Montant séjour",
      sortKey: "amount",
      className: "whitespace-nowrap font-semibold text-cream",
      render: (r) => (
        <>
          {formatAmount(reservationAmount(r))}
          {(r.status === "ANNULEE" || r.status === "REMBOURSEE") && (
            <span className="block text-xs font-normal text-orange-300">
              À rembourser : {formatAmount(r.cancellation_refund_amount)}
            </span>
          )}
        </>
      )
    },
    {
      key: "status",
      header: "Statut",
      sortKey: "status",
      render: (r) => (
        <>
          <StatusBadge status={r.status} labels={reservationStatusLabels} />
          {r.status === "VALIDEE_PAIEMENT_REQUIS" && r.payment_deadline && (
            <span className="mt-1 block whitespace-nowrap text-xs text-cream/45">
              Avant le {formatDateTime(r.payment_deadline)}
            </span>
          )}
        </>
      )
    },
    {
      key: "created_at",
      header: "Demandée le",
      sortKey: "created_at",
      className: "whitespace-nowrap text-cream/65",
      render: (r) => formatDateTime(r.created_at)
    },
    {
      key: "actions",
      header: "Actions",
      align: "right",
      render: (r) =>
        rowActions(() => setDetails({ kind: "reservation", item: r }), reservationCommands(r))
    }
  ];

  const extensionColumns: DataTableColumn<StayExtension>[] = [
    {
      key: "id",
      header: "N°",
      sortKey: "id",
      className: "font-semibold text-cream",
      render: (e) => `#${e.id}`
    },
    {
      key: "reservation",
      header: "Réservation",
      className: "whitespace-nowrap",
      render: (e) => `#${e.reservation_id}`
    },
    { key: "client", header: "Client", render: (e) => clientCell(extensionClient(e)) },
    {
      key: "room",
      header: "Appartement",
      className: "min-w-[180px]",
      render: (e) => apartmentLabel(e.reservation?.room, e.reservation?.category_type)
    },
    {
      key: "requested_check_out",
      header: "Départ actuel → demandé",
      sortKey: "requested_check_out",
      className: "whitespace-nowrap",
      render: (e) => (
        <>
          {formatDate(e.previous_check_out)} →{" "}
          <strong className="text-cream">{formatDate(e.requested_check_out)}</strong>
          <span className="block text-xs text-cream/45">+{e.nights} nuit(s)</span>
        </>
      )
    },
    {
      key: "amount",
      header: "Montant",
      sortKey: "amount",
      className: "whitespace-nowrap font-semibold text-cream",
      render: (e) => formatAmount(e.amount)
    },
    {
      key: "status",
      header: "Statut",
      sortKey: "status",
      render: (e) => <StatusBadge status={e.status} labels={extensionStatusLabels} />
    },
    {
      key: "payment_deadline",
      header: "Échéance paiement",
      className: "whitespace-nowrap text-cream/65",
      render: (e) => (e.payment_deadline ? formatDateTime(e.payment_deadline) : "—")
    },
    {
      key: "created_at",
      header: "Demandée le",
      sortKey: "created_at",
      className: "whitespace-nowrap text-cream/65",
      render: (e) => formatDateTime(e.created_at)
    },
    {
      key: "actions",
      header: "Actions",
      align: "right",
      render: (e) =>
        rowActions(() => setDetails({ kind: "extension", item: e }), extensionCommands(e))
    }
  ];

  /* ---- Props communes du tableau ---- */

  const highlight = (id: number) =>
    focusId === id ? "bg-gold/10 ring-1 ring-inset ring-gold/50" : undefined;

  const activeData = table.type === type ? table.data : emptyPage<never>();

  const tableProps = {
    loading: loading || table.type !== type,
    error: loadError,
    emptyMessage: "Aucune demande ne correspond à ces filtres.",
    minWidth: "1150px",
    search,
    onSearchChange: (value: string) => {
      setSearch(value);
      setFocusId(null);
      setPage(1);
    },
    searchPlaceholder: "N° (#123), client, e-mail, téléphone, appartement…",
    sort,
    direction,
    onSortChange: (nextSort: string, nextDirection: SortDirection) => {
      setSort(nextSort);
      setDirection(nextDirection);
      setPage(1);
    },
    page: activeData.current_page,
    lastPage: activeData.last_page,
    total: activeData.total,
    from: activeData.from,
    to: activeData.to,
    perPage,
    onPageChange: setPage,
    onPerPageChange: (value: number) => {
      setPerPage(value);
      setPage(1);
    },
    onReset: resetFilters,
    resetLabel: "Réinitialiser les filtres",
    canReset: isFiltered,
    actions:
      type === "reservation" ? (
        <button
          type="button"
          onClick={exportPdf}
          disabled={
            loading ||
            table.type !== "reservation" ||
            table.data.data.length === 0 ||
            exportingReport
          }
          title="Exporte les demandes affichées sur cette page"
          className="inline-flex h-10 items-center gap-2 rounded-lg bg-gradient-to-br from-gold-light to-gold px-4 text-xs font-bold uppercase tracking-wider text-night transition hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <Download size={14} className={exportingReport ? "animate-bounce" : ""} />
          {exportingReport ? "Création du PDF…" : "Export PDF"}
        </button>
      ) : null,
    filters: (
      <>
        <FilterField label="Statut">
          <select
            value={statusKey}
            onChange={(event) => {
              setStatusKey(event.target.value);
              setPage(1);
            }}
            className={filterInputClass}
          >
            <option value="" className="text-night">
              Tous les statuts
            </option>
            {statusOptions[type].map((option) => (
              <option key={option.key} value={option.key} className="text-night">
                {option.label}
              </option>
            ))}
          </select>
        </FilterField>

        <FilterField label="Période appliquée à">
          <select
            value={dateField}
            onChange={(event) => {
              setDateField(event.target.value as "stay" | "created");
              setPage(1);
            }}
            className={filterInputClass}
          >
            <option value="stay" className="text-night">
              {type === "reservation" ? "Dates du séjour" : "Nuits demandées"}
            </option>
            <option value="created" className="text-night">
              Date de la demande
            </option>
          </select>
        </FilterField>

        <FilterField label="Du">
          <input
            type="date"
            value={dateFrom}
            max={dateTo || undefined}
            onChange={(event) => {
              setDateFrom(event.target.value);
              setPage(1);
            }}
            className={filterInputClass}
          />
        </FilterField>

        <FilterField label="Au">
          <input
            type="date"
            value={dateTo}
            min={dateFrom || undefined}
            onChange={(event) => {
              setDateTo(event.target.value);
              setPage(1);
            }}
            className={filterInputClass}
          />
        </FilterField>
      </>
    )
  };

  return (
    <div className="relative text-cream">
      <AdminPageHeader title="Demandes" />

      <section className="space-y-4">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="font-display text-2xl font-bold uppercase tracking-wider text-cream">
              {type === "reservation" ? "Demandes de réservation" : "Demandes de prolongation"}
            </h2>
            <p className="mt-1 text-sm text-cream/55">
              {type === "reservation"
                ? "Après validation, le client dispose d'un délai pour régler la totalité de son séjour."
                : "Après validation, le client règle les nuits supplémentaires depuis son espace."}
            </p>
          </div>
          <div
            className="inline-flex rounded-lg border border-gold/15 p-1"
            role="tablist"
            aria-label="Type de demande"
          >
            {(["reservation", "extension"] as const).map((value) => (
              <button
                key={value}
                type="button"
                role="tab"
                aria-selected={type === value}
                onClick={() => changeType(value)}
                className={cn(
                  "inline-flex items-center gap-2 rounded-md px-4 py-2 text-xs font-semibold uppercase tracking-wider transition",
                  type === value
                    ? "bg-gradient-to-br from-gold-light to-gold text-night"
                    : "text-cream/60 hover:text-gold-light"
                )}
              >
                {value === "reservation" ? <BedDouble size={14} /> : <CalendarPlus size={14} />}
                {value === "reservation" ? "Réservations" : "Prolongations"}
              </button>
            ))}
          </div>
        </div>

        {type === "reservation" ? (
          <DataTable<Reservation>
            {...tableProps}
            columns={reservationColumns}
            rows={table.type === "reservation" ? table.data.data : []}
            rowKey={(r) => r.id}
            rowClassName={(r) => highlight(r.id)}
          />
        ) : (
          <DataTable<StayExtension>
            {...tableProps}
            columns={extensionColumns}
            rows={table.type === "extension" ? table.data.data : []}
            rowKey={(e) => e.id}
            rowClassName={(e) => highlight(e.id)}
          />
        )}
      </section>

      {/* Fiche detaillee */}
      <Modal
        open={!!details}
        onClose={() => !submitting && !pending && setDetails(null)}
        maxWidth="max-w-2xl"
      >
        {details?.kind === "reservation" && (
          <ReservationDetails
            reservation={details.item}
            actions={<DetailsActions commands={reservationCommands(details.item)} />}
          />
        )}
        {details?.kind === "extension" && (
          <ExtensionDetails
            extension={details.item}
            actions={<DetailsActions commands={extensionCommands(details.item)} />}
          />
        )}
      </Modal>

      {/* Validation / refus */}
      <Modal open={!!pending} onClose={() => !submitting && setPending(null)} zIndex="z-[120]">
        {pending && (
          <div className="space-y-6">
            <div>
              <h3 className="font-display text-2xl font-bold uppercase tracking-wide text-cream">
                {pending.action === "approve"
                  ? pending.kind === "reservation"
                    ? "Valider la demande"
                    : "Valider la prolongation"
                  : pending.kind === "reservation"
                    ? "Refuser la demande"
                    : "Refuser la prolongation"}
              </h3>
              <p className="mt-1 text-[10px] uppercase tracking-widest text-cream/50">
                {pending.kind === "reservation"
                  ? `Réservation #${pending.item.id} · ${pending.item.user?.name || "Client"}`
                  : `Prolongation #${pending.item.id} · ${extensionClient(pending.item)?.name || "Client"}`}
              </p>
            </div>

            <div className="space-y-2 rounded-2xl border border-gold/10 bg-white/5 p-4 text-xs text-cream/70">
              {pending.kind === "reservation" ? (
                <>
                  <p>
                    <strong>Appartement :</strong>{" "}
                    {apartmentLabel(pending.item.room, pending.item.category_type)}
                  </p>
                  <p>
                    <strong>Dates :</strong> du {formatDate(pending.item.check_in)} au{" "}
                    {formatDate(pending.item.check_out)} (
                    {countNights(pending.item.check_in, pending.item.check_out)} nuit(s))
                  </p>
                  <p>
                    <strong>Montant du séjour :</strong>{" "}
                    {formatAmount(reservationAmount(pending.item))}
                  </p>
                </>
              ) : (
                <>
                  <p>
                    <strong>Appartement :</strong>{" "}
                    {apartmentLabel(
                      pending.item.reservation?.room,
                      pending.item.reservation?.category_type
                    )}
                  </p>
                  <p>
                    <strong>Départ :</strong> {formatDate(pending.item.previous_check_out)} →{" "}
                    {formatDate(pending.item.requested_check_out)} (+{pending.item.nights} nuit(s))
                  </p>
                  <p>
                    <strong>Montant de la prolongation :</strong>{" "}
                    {formatAmount(pending.item.amount)}
                  </p>
                </>
              )}
              {pending.action === "approve" && (
                <p className="pt-1 text-cream/55">
                  {pending.kind === "reservation"
                    ? "Le client sera prévenu par e-mail et pourra régler la totalité de son séjour."
                    : "Le client sera prévenu par e-mail et pourra régler les nuits supplémentaires."}
                </p>
              )}
            </div>

            <label className="block">
              <span className="mb-2 block text-[10px] font-semibold uppercase tracking-wider text-gold/80">
                {pending.action === "approve" ? "Note facultative" : "Motif du refus (obligatoire)"}
              </span>
              <textarea
                rows={4}
                value={adminNotes}
                onChange={(event) => setAdminNotes(event.target.value)}
                maxLength={1000}
                className="glass-input w-full resize-none rounded-xl p-4 text-sm outline-none"
              />
            </label>

            {actionError && <p className="text-xs font-semibold text-red-400">{actionError}</p>}

            <div className="flex gap-3 border-t border-gold/10 pt-4">
              <button
                type="button"
                disabled={submitting}
                onClick={() => setPending(null)}
                className="flex-1 rounded-xl border border-gold/15 py-4 text-xs font-bold uppercase tracking-wider text-cream/70 transition hover:bg-white/5 disabled:opacity-50"
              >
                Annuler
              </button>
              <button
                type="button"
                disabled={submitting}
                onClick={submitAction}
                className={cn(
                  "flex-1 rounded-xl py-4 text-xs font-black uppercase tracking-[0.2em] transition disabled:opacity-50",
                  pending.action === "approve"
                    ? "bg-gradient-to-br from-gold-light to-gold text-night hover:brightness-105"
                    : "bg-terracotta text-cream hover:brightness-110"
                )}
              >
                {submitting ? "Envoi…" : pending.action === "approve" ? "Valider" : "Refuser"}
              </button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}

/* ---------------------------------------------------------------------------
 * Sous-composants
 * ------------------------------------------------------------------------- */

/** Boutons libellés de la fiche détaillée (le tableau affiche les mêmes actions en icônes). */
function DetailsActions({ commands }: { commands: RowCommand[] }) {
  if (commands.length === 0) return null;
  return (
    <div className="flex flex-wrap gap-2">
      {commands.map(({ label, icon: Icon, tone, disabled, run }) => (
        <button
          key={label}
          type="button"
          disabled={disabled}
          onClick={run}
          className={cn(
            "inline-flex items-center justify-center gap-1.5 whitespace-nowrap rounded-lg px-3 py-2 text-[10px] font-black uppercase tracking-wider transition disabled:opacity-50",
            tone === "danger"
              ? "border border-terracotta/40 text-terracotta-light hover:bg-terracotta/15"
              : "bg-gradient-to-br from-gold-light to-gold text-night hover:brightness-105"
          )}
        >
          <Icon size={13} /> {label}
        </button>
      ))}
    </div>
  );
}

function Modal({
  open,
  onClose,
  children,
  zIndex = "z-[100]",
  maxWidth = "max-w-lg"
}: {
  open: boolean;
  onClose: () => void;
  children: ReactNode;
  zIndex?: string;
  maxWidth?: string;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => event.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  return (
    <AnimatePresence>
      {open && (
        <div className={cn("fixed inset-0 flex items-center justify-center p-4", zIndex)}>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-night/80 backdrop-blur-md"
          />
          <motion.div
            role="dialog"
            aria-modal="true"
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            className={cn(
              "glass-dark glass-edge relative max-h-[90vh] w-full overflow-y-auto rounded-3xl p-6 text-cream shadow-2xl sm:p-8",
              maxWidth
            )}
          >
            <button
              type="button"
              onClick={onClose}
              className="absolute right-5 top-5 flex h-9 w-9 items-center justify-center rounded-full border border-gold/20 bg-white/5 text-cream transition hover:border-gold hover:text-gold-light"
              aria-label="Fermer"
            >
              <X size={15} />
            </button>
            {children}
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}

function DetailRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="rounded-xl bg-white/5 p-3">
      <span className="block text-[9px] font-bold uppercase tracking-widest text-cream/45">
        {label}
      </span>
      <div className="mt-1 text-sm text-cream">{children}</div>
    </div>
  );
}

function ClientBlock({ person }: { person?: User }) {
  return (
    <div className="rounded-xl border border-gold/15 bg-white/5 p-4 text-sm">
      <p className="mb-2 text-[10px] font-black uppercase tracking-widest text-gold/70">Client</p>
      <p className="font-semibold text-cream">{person?.name || "Client non renseigné"}</p>
      <p className="mt-1 flex items-center gap-2 text-cream/65">
        <Mail size={13} /> {person?.email || "E-mail non renseigné"}
      </p>
      <p className="mt-1 flex items-center gap-2 text-cream/65">
        <Phone size={13} /> {person?.phone || "Téléphone non renseigné"}
      </p>
    </div>
  );
}

function ReservationDetails({
  reservation,
  actions
}: {
  reservation: Reservation;
  actions: ReactNode;
}) {
  return (
    <div className="space-y-5">
      <div className="pr-10">
        <p className="text-[10px] uppercase tracking-widest text-cream/50">
          Réservation #{reservation.id}
        </p>
        <h3 className="mt-1 font-display text-2xl font-bold uppercase tracking-wide text-cream">
          {apartmentLabel(reservation.room, reservation.category_type)}
        </h3>
        <div className="mt-2">
          <StatusBadge status={reservation.status} labels={reservationStatusLabels} />
        </div>
      </div>

      <ClientBlock person={reservation.user} />

      <div className="grid gap-3 sm:grid-cols-2">
        <DetailRow label="Séjour">
          Du {formatDate(reservation.check_in)} au {formatDate(reservation.check_out)} (
          {countNights(reservation.check_in, reservation.check_out)} nuit(s))
        </DetailRow>
        <DetailRow label="Voyageurs">{reservation.guests}</DetailRow>
        <DetailRow label="Montant du séjour">
          {formatAmount(reservationAmount(reservation))}
        </DetailRow>
        <DetailRow label="Demandée le">{formatDateTime(reservation.created_at)}</DetailRow>
        {reservation.approved_at && (
          <DetailRow label="Validée le">{formatDateTime(reservation.approved_at)}</DetailRow>
        )}
        {reservation.payment_deadline && reservation.status === "VALIDEE_PAIEMENT_REQUIS" && (
          <DetailRow label="Paiement attendu avant le">
            {formatDateTime(reservation.payment_deadline)}
          </DetailRow>
        )}
        {(reservation.stay_paid_at || reservation.paid_at) && (
          <DetailRow label="Séjour payé le">
            {formatDateTime(reservation.stay_paid_at || reservation.paid_at)}
          </DetailRow>
        )}
        {(reservation.status === "ANNULEE" || reservation.status === "REMBOURSEE") && (
          <DetailRow label="À rembourser">
            {formatAmount(reservation.cancellation_refund_amount)}
          </DetailRow>
        )}
        {reservation.released_at && (
          <DetailRow label="Libéré le">{formatDateTime(reservation.released_at)}</DetailRow>
        )}
      </div>

      {reservation.special_requests && (
        <div className="rounded-xl border border-gold/10 bg-white/5 p-3 text-xs leading-relaxed text-cream/65">
          <span className="mb-1 block text-[9px] font-bold uppercase tracking-widest text-gold/70">
            Demande du client
          </span>
          {reservation.special_requests}
        </div>
      )}

      {reservation.admin_notes && (
        <div className="rounded-xl border border-gold/10 bg-white/5 p-3 text-xs leading-relaxed text-cream/65">
          <span className="mb-1 block text-[9px] font-bold uppercase tracking-widest text-gold/70">
            Note de l&apos;administration
          </span>
          {reservation.admin_notes}
        </div>
      )}

      {!!reservation.extensions?.length && (
        <div className="rounded-xl border border-gold/10 bg-white/5 p-3 text-xs text-cream/70">
          <span className="mb-2 block text-[9px] font-bold uppercase tracking-widest text-gold/70">
            Prolongations
          </span>
          <ul className="space-y-1.5">
            {reservation.extensions.map((extension) => (
              <li key={extension.id} className="flex flex-wrap items-center justify-between gap-2">
                <span>
                  #{extension.id} · jusqu&apos;au {formatDate(extension.requested_check_out)} ·{" "}
                  {formatAmount(extension.amount)}
                </span>
                <StatusBadge status={extension.status} labels={extensionStatusLabels} />
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="border-t border-gold/10 pt-4">{actions}</div>
    </div>
  );
}

function ExtensionDetails({
  extension,
  actions
}: {
  extension: StayExtension;
  actions: ReactNode;
}) {
  const reservation = extension.reservation;
  return (
    <div className="space-y-5">
      <div className="pr-10">
        <p className="text-[10px] uppercase tracking-widest text-cream/50">
          Prolongation #{extension.id} · Réservation #{extension.reservation_id}
        </p>
        <h3 className="mt-1 font-display text-2xl font-bold uppercase tracking-wide text-cream">
          {apartmentLabel(reservation?.room, reservation?.category_type)}
        </h3>
        <div className="mt-2">
          <StatusBadge status={extension.status} labels={extensionStatusLabels} />
        </div>
      </div>

      <ClientBlock person={extensionClient(extension)} />

      <div className="grid gap-3 sm:grid-cols-2">
        {reservation && (
          <DetailRow label="Séjour initial">
            Du {formatDate(reservation.check_in)} au {formatDate(extension.previous_check_out)}
          </DetailRow>
        )}
        <DetailRow label="Nouveau départ demandé">
          {formatDate(extension.requested_check_out)} (+{extension.nights} nuit(s))
        </DetailRow>
        <DetailRow label="Prix par nuit">{formatAmount(extension.price_per_night)}</DetailRow>
        <DetailRow label="Montant">{formatAmount(extension.amount)}</DetailRow>
        <DetailRow label="Demandée le">{formatDateTime(extension.created_at)}</DetailRow>
        {extension.payment_deadline && (
          <DetailRow label="Échéance de paiement">
            {formatDateTime(extension.payment_deadline)}
          </DetailRow>
        )}
        {extension.paid_at && (
          <DetailRow label="Payée le">{formatDateTime(extension.paid_at)}</DetailRow>
        )}
        {extension.voucher?.number && (
          <DetailRow label="Bon de séjour">{extension.voucher.number}</DetailRow>
        )}
      </div>

      {extension.admin_notes && (
        <div className="rounded-xl border border-gold/10 bg-white/5 p-3 text-xs leading-relaxed text-cream/65">
          <span className="mb-1 block text-[9px] font-bold uppercase tracking-widest text-gold/70">
            Note de l&apos;administration
          </span>
          {extension.admin_notes}
        </div>
      )}

      <div className="border-t border-gold/10 pt-4">{actions}</div>
    </div>
  );
}
