"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { api, type AdminTableQuery, type Paginated, type Reservation } from "@/lib/api";
import { AdminPageHeader } from "@/components/dashboard/admin/AdminShell";
import DataTable, {
  FilterField,
  TableBadge,
  filterInputClass,
  type BadgeTone,
  type DataTableColumn,
  type SortDirection
} from "@/components/dashboard/admin/DataTable";

/** Statuts d'une réservation dont le séjour a été réglé. */
const PAID_STATUSES = ["SEJOUR_PAYE", "CONFIRMEE", "LIBEREE"];

const DEFAULT_SORT = "check_in";
const DEFAULT_DIRECTION: SortDirection = "desc";
const DEFAULT_PER_PAGE = 10;

const emptyPage: Paginated<Reservation> = {
  data: [],
  current_page: 1,
  last_page: 1,
  per_page: DEFAULT_PER_PAGE,
  total: 0,
  from: null,
  to: null
};

const categoryLabels: Record<string, string> = {
  vip: "VIP",
  deux_chambres: "2 Chambres",
  une_chambre: "1 Chambre"
};

/** Partie date (AAAA-MM-JJ) d'une valeur renvoyée par l'API. */
const dayOf = (value?: string | null) => (value ? value.slice(0, 10) : "");

const formatDate = (value?: string | null) => {
  if (!value) return "—";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "—" : date.toLocaleDateString("fr-FR");
};

const formatAmount = (value?: number | null) => `${(value ?? 0).toLocaleString("fr-FR")} FCFA`;

const countNights = (start?: string | null, end?: string | null) => {
  const from = new Date(dayOf(start));
  const to = new Date(dayOf(end));
  if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime())) return 0;
  return Math.max(1, Math.round((to.getTime() - from.getTime()) / (1000 * 60 * 60 * 24)));
};

const todayKey = () => {
  const now = new Date();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${now.getFullYear()}-${month}-${day}`;
};

const apartmentLabel = (reservation: Reservation) => {
  const room = reservation.room;
  if (room?.apartment_number) return `N°${room.apartment_number} · ${room.name}`;
  return room?.name || categoryLabels[reservation.category_type || ""] || "Appartement";
};

/** Situation du séjour : libéré, à venir (payé), en cours ou terminé. */
const stayState = (reservation: Reservation, today: string): { label: string; tone: BadgeTone } => {
  if (reservation.status === "LIBEREE") return { label: "Libéré", tone: "info" };
  if (today < dayOf(reservation.check_in)) return { label: "Séjour payé", tone: "success" };
  if (today < dayOf(reservation.check_out)) return { label: "En cours", tone: "warning" };
  return { label: "Terminé", tone: "neutral" };
};

export default function AdminStaysPage() {
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(DEFAULT_PER_PAGE);
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState(DEFAULT_SORT);
  const [direction, setDirection] = useState<SortDirection>(DEFAULT_DIRECTION);
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  const [result, setResult] = useState<Paginated<Reservation>>(emptyPage);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const requestId = useRef(0);

  const loadStays = useCallback(async () => {
    const query: AdminTableQuery = {
      page,
      per_page: perPage,
      search: search || undefined,
      status: PAID_STATUSES,
      date_from: dateFrom || undefined,
      date_to: dateTo || undefined,
      date_field: dateFrom || dateTo ? "stay" : undefined,
      sort,
      direction
    };

    // Seule la dernière requête lancée met à jour le tableau.
    const current = ++requestId.current;
    setLoading(true);
    setError(null);
    try {
      const data = await api.getAdminReservations(query);
      if (current !== requestId.current) return;
      if (data.data.length === 0 && data.current_page > 1 && data.last_page < data.current_page) {
        setPage(Math.max(1, data.last_page));
        return;
      }
      setResult(data);
    } catch (err) {
      if (current !== requestId.current) return;
      setResult(emptyPage);
      setError(
        err instanceof Error ? err.message : "Impossible de charger l'historique des séjours."
      );
    } finally {
      if (current === requestId.current) setLoading(false);
    }
  }, [page, perPage, search, dateFrom, dateTo, sort, direction]);

  useEffect(() => {
    loadStays();
  }, [loadStays]);

  const isFiltered =
    search !== "" ||
    dateFrom !== "" ||
    dateTo !== "" ||
    sort !== DEFAULT_SORT ||
    direction !== DEFAULT_DIRECTION ||
    perPage !== DEFAULT_PER_PAGE;

  const resetFilters = () => {
    setSearch("");
    setDateFrom("");
    setDateTo("");
    setSort(DEFAULT_SORT);
    setDirection(DEFAULT_DIRECTION);
    setPerPage(DEFAULT_PER_PAGE);
    setPage(1);
  };

  const today = todayKey();

  const columns: DataTableColumn<Reservation>[] = [
    {
      key: "client",
      header: "Client",
      render: (r) => (
        <span className="font-medium text-cream">{r.user?.name || "Client inconnu"}</span>
      )
    },
    { key: "room", header: "Appartement", render: (r) => apartmentLabel(r) },
    {
      key: "check_in",
      header: "Arrivée",
      sortKey: "check_in",
      render: (r) => formatDate(r.check_in)
    },
    {
      key: "check_out",
      header: "Départ",
      sortKey: "check_out",
      render: (r) => formatDate(r.check_out)
    },
    {
      key: "nights",
      header: "Nuits",
      align: "center",
      render: (r) => countNights(r.check_in, r.check_out)
    },
    {
      key: "amount",
      header: "Montant payé",
      sortKey: "amount",
      className: "font-semibold text-cream",
      render: (r) => formatAmount(r.stay_amount ?? r.total_price)
    },
    {
      key: "status",
      header: "Statut",
      sortKey: "status",
      render: (r) => {
        const state = stayState(r, today);
        return <TableBadge tone={state.tone}>{state.label}</TableBadge>;
      }
    }
  ];

  return (
    <div className="relative text-cream">
      <AdminPageHeader title="Historique des séjours" />

      <DataTable
        title="Séjours payés"
        description="Qui a séjourné dans quel appartement, et pour combien de nuits."
        columns={columns}
        rows={result.data}
        rowKey={(r) => r.id}
        loading={loading}
        error={error}
        emptyTitle="Aucun séjour"
        emptyMessage="Aucun séjour payé ne correspond à votre recherche."
        minWidth="900px"
        search={search}
        onSearchChange={(value) => {
          setSearch(value);
          setPage(1);
        }}
        searchPlaceholder="Client, appartement, N° (#123)…"
        sort={sort}
        direction={direction}
        onSortChange={(nextSort, nextDirection) => {
          setSort(nextSort);
          setDirection(nextDirection);
          setPage(1);
        }}
        page={result.current_page}
        lastPage={result.last_page}
        total={result.total}
        from={result.from}
        to={result.to}
        perPage={perPage}
        onPageChange={setPage}
        onPerPageChange={(value) => {
          setPerPage(value);
          setPage(1);
        }}
        onReset={resetFilters}
        resetLabel="Réinitialiser les filtres"
        canReset={isFiltered}
        filters={
          <>
            <FilterField label="Séjour du">
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
        }
      />
    </div>
  );
}
