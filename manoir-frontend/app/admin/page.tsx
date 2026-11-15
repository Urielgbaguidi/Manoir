"use client";

import {
  ArrowDownRight,
  ArrowRight,
  ArrowUpRight,
  CalendarRange,
  CircleAlert,
  Eye,
  Users,
  Wallet,
  WalletCards
} from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useState, type ComponentType, type ReactNode } from "react";
import { AdminCard, AdminPageHeader } from "@/components/dashboard/admin/AdminShell";
import DataTable, {
  IconAction,
  TableBadge,
  useLocalTable,
  type DataTableColumn
} from "@/components/dashboard/admin/DataTable";
import { MonthlyRevenueChart, OccupancyGauge } from "@/components/dashboard/admin/charts";
import { useToast } from "@/context/ToastContext";
import { api, type AdminStatsResponse, type Reservation } from "@/lib/api";
import {
  formatCurrency,
  formatDay,
  formatStayPeriod,
  parseDay,
  reservationRef,
  reservationTitle,
  stayAmountOf,
  statusLabels,
  reservationStatusColor
} from "@/lib/reservationDisplay";
import { cn } from "@/lib/utils";

type Stats = AdminStatsResponse["stats"] & { revenue_this_month?: number };

const sameDay = (a: Date | null, b: Date) =>
  Boolean(a) &&
  a!.getFullYear() === b.getFullYear() &&
  a!.getMonth() === b.getMonth() &&
  a!.getDate() === b.getDate();

const statusBadge = reservationStatusColor;

export default function AdminDashboardPage() {
  const { showToast } = useToast();
  const [stats, setStats] = useState<Stats | null>(null);
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [occupied, setOccupied] = useState<Reservation[]>([]);
  const [pendingExtensions, setPendingExtensions] = useState(0);
  const [loading, setLoading] = useState(true);
  const currentYear = new Date().getFullYear();
  const [year, setYear] = useState(currentYear);

  useEffect(() => {
    Promise.all([
      api.getAdminStats(),
      api.getAdminReservations({ per_page: 500 }),
      api.getOccupiedRooms(),
      // Les prolongations ont leur propre table : seul le total est utile ici.
      api.getAdminExtensions({ status: "EN_ATTENTE", per_page: 1 })
    ])
      .then(([statsData, reservationData, occupiedData, extensionData]) => {
        setStats(statsData.stats);
        setReservations(reservationData.data);
        setOccupied(occupiedData.data);
        setPendingExtensions(extensionData.total);
      })
      .catch(() => showToast("Impossible de charger le tableau de bord.", "error"))
      .finally(() => setLoading(false));
  }, [showToast]);

  const years = useMemo(() => {
    const set = new Set<number>([currentYear]);
    reservations.forEach((reservation) => {
      const date = parseDay(reservation.created_at);
      if (date) set.add(date.getFullYear());
    });
    return [...set].sort((a, b) => b - a);
  }, [reservations, currentYear]);

  const monthlyRevenue = useMemo(() => {
    const revenue = Array(12).fill(0) as number[];
    reservations.forEach((reservation) =>
      (reservation.payments || [])
        .filter((payment) => payment.status === "success")
        .forEach((payment) => {
          const paid = new Date(payment.paid_at || payment.created_at);
          if (paid.getFullYear() === year) revenue[paid.getMonth()] += Number(payment.amount || 0);
        })
    );
    return revenue;
  }, [reservations, year]);

  const insights = useMemo(() => {
    const today = new Date();
    const thisMonth = today.getMonth();
    // Encaissements du mois en cours (0) et du mois précédent (1).
    const revenueByOffset = [0, 0];
    reservations.forEach((reservation) =>
      (reservation.payments || [])
        .filter((payment) => payment.status === "success")
        .forEach((payment) => {
          const paid = new Date(payment.paid_at || payment.created_at);
          const offset =
            (today.getFullYear() - paid.getFullYear()) * 12 + (thisMonth - paid.getMonth());
          if (offset === 0 || offset === 1) revenueByOffset[offset] += Number(payment.amount || 0);
        })
    );
    const [current, previous] = revenueByOffset;
    const revenueChange = previous > 0 ? ((current - previous) / previous) * 100 : null;

    const stayed = ["CONFIRMEE", "SEJOUR_PAYE"];
    const countWhere = (predicate: (reservation: Reservation) => boolean) =>
      reservations.filter(predicate).length;

    return {
      current,
      revenueChange,
      arrivals: countWhere(
        (r) => stayed.includes(r.status) && sameDay(parseDay(r.check_in), today)
      ),
      departures: countWhere(
        (r) => stayed.includes(r.status) && sameDay(parseDay(r.check_out), today)
      ),
      pendingRequests: countWhere((r) => r.status === "EN_ATTENTE"),
      refunds: countWhere((r) => r.status === "ANNULEE"),
      awaitingPayment: countWhere((r) => r.status === "VALIDEE_PAIEMENT_REQUIS")
    };
  }, [reservations]);

  const recent = useLocalTable(reservations, {
    searchText: (r) =>
      [
        reservationRef(r),
        reservationTitle(r),
        r.user?.name,
        r.user?.email,
        r.user?.phone,
        statusLabels[r.status]
      ].join(" "),
    sortValue: (r, key) => {
      if (key === "created_at") return new Date(r.created_at).getTime();
      if (key === "check_in") return r.check_in;
      if (key === "amount") return stayAmountOf(r);
      return null;
    },
    initialSort: "created_at",
    initialDirection: "desc",
    initialPerPage: 5
  });

  const recentColumns: DataTableColumn<Reservation>[] = [
    {
      key: "ref",
      header: "Réf.",
      className: "font-semibold text-cream",
      render: (r) => reservationRef(r)
    },
    {
      key: "room",
      header: "Appartement",
      render: (r) => <span className="text-cream">{reservationTitle(r)}</span>
    },
    { key: "client", header: "Client", render: (r) => r.user?.name || "Non renseigné" },
    {
      key: "check_in",
      header: "Séjour",
      sortKey: "check_in",
      render: (r) => formatStayPeriod(r)
    },
    {
      key: "amount",
      header: "Montant",
      sortKey: "amount",
      className: "font-semibold text-cream",
      render: (r) => formatCurrency(stayAmountOf(r))
    },
    {
      key: "status",
      header: "Statut",
      render: (r) => <TableBadge tone={statusBadge[r.status]}>{statusLabels[r.status]}</TableBadge>
    },
    {
      key: "actions",
      header: "Actions",
      align: "right",
      render: (r) => (
        <IconAction
          label="Voir la demande"
          icon={Eye}
          href={`/admin/reservations?type=reservation&id=${r.id}`}
        />
      )
    }
  ];

  const todo = [
    {
      count: insights.pendingRequests,
      label: "demande(s) de réservation à valider",
      href: "/admin/reservations?type=reservation"
    },
    {
      count: pendingExtensions,
      label: "prolongation(s) à valider",
      href: "/admin/reservations?type=extension"
    },
    { count: insights.refunds, label: "remboursement(s) à confirmer", href: "/admin/reservations" },
    {
      count: insights.awaitingPayment,
      label: "séjour(s) validé(s) en attente de paiement",
      href: "/admin/reservations"
    }
  ].filter((item) => item.count > 0);

  return (
    <div className="space-y-4 md:space-y-6">
      <AdminPageHeader title="Tableau de bord" />

      {todo.length > 0 && (
        <div className="flex flex-col gap-3 rounded-2xl border border-gold/30 bg-gold/10 p-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3">
            <CircleAlert size={20} className="mt-0.5 shrink-0 text-gold-light" />
            <p className="text-sm text-cream/80">
              À traiter :{" "}
              {todo.map((item, index) => (
                <span key={item.label}>
                  <Link href={item.href} className="hover:text-gold-light hover:underline">
                    <strong className="text-cream">{item.count}</strong> {item.label}
                  </Link>
                  {index < todo.length - 1 ? " · " : ""}
                </span>
              ))}
            </p>
          </div>
          <Link
            href="/admin/reservations"
            className="inline-flex shrink-0 items-center gap-2 text-sm font-semibold text-gold-light hover:underline"
          >
            Ouvrir les réservations <ArrowRight size={15} />
          </Link>
        </div>
      )}

      {/* Indicateurs : 1, 2 puis 4 colonnes, jamais de case vide */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:gap-6 2xl:grid-cols-4">
        <MetricCard
          icon={Users}
          title="Clients"
          value={loading ? "…" : String(stats?.total_users ?? 0)}
        />
        <MetricCard
          icon={CalendarRange}
          title="Réservations"
          value={loading ? "…" : String(stats?.total_reservations ?? 0)}
        />
        <MetricCard
          icon={Wallet}
          title="Chiffre d'affaires total"
          value={loading ? "…" : formatCurrency(stats?.total_revenue ?? 0)}
        />
        <MetricCard
          icon={WalletCards}
          title="Encaissé ce mois-ci"
          value={loading ? "…" : formatCurrency(stats?.revenue_this_month ?? insights.current)}
          change={insights.revenueChange}
        />
      </div>

      {/* Encaissements + occupation : même hauteur, le graphique remplit sa carte */}
      <div className="grid grid-cols-1 gap-4 md:gap-6 xl:grid-cols-12">
        <AdminCard className="flex min-w-0 flex-col p-5 sm:p-6 xl:col-span-7 2xl:col-span-8">
          <CardTitle
            title="Encaissements mensuels"
            subtitle="Paiements reçus, mois par mois"
            action={<YearSelect years={years} value={year} onChange={setYear} />}
          />
          <MonthlyRevenueChart data={monthlyRevenue} className="flex-1" />
        </AdminCard>

        <AdminCard className="flex min-w-0 flex-col overflow-hidden xl:col-span-5 2xl:col-span-4">
          <div className="flex flex-1 flex-col px-5 pt-5 sm:px-6 sm:pt-6">
            <CardTitle
              title="Taux d'occupation"
              subtitle="Appartements occupés aujourd'hui"
              action={
                <Link
                  href="/admin/rooms"
                  className="inline-flex shrink-0 items-center gap-1.5 text-sm font-semibold text-gold-light hover:underline"
                >
                  Gérer <ArrowRight size={14} />
                </Link>
              }
            />
            <OccupancyGauge value={stats?.occupancy_rate ?? 0} />
            <p className="text-center text-sm text-cream/60">
              {loading
                ? "Chargement…"
                : `${occupied.length} appartement(s) occupé(s) sur ${stats?.total_rooms ?? 0}`}
            </p>

            {/* Séjours en cours : la liste prend la hauteur restante et défile au besoin */}
            <div className="mt-5 flex min-h-[200px] flex-1 flex-col pb-5">
              <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-cream/45">
                En ce moment
              </p>
              <div className="relative flex flex-1 flex-col">
                <div className="flex flex-1 flex-col xl:absolute xl:inset-0 xl:overflow-y-auto">
                  {occupied.length === 0 ? (
                    <p className="flex flex-1 items-center justify-center rounded-xl border border-dashed border-gold/20 px-4 py-5 text-center text-sm text-cream/50">
                      {loading ? "Chargement…" : "Aucun appartement occupé."}
                    </p>
                  ) : (
                    <ul className="divide-y divide-gold/10">
                      {occupied.map((reservation) => (
                        <li
                          key={reservation.id}
                          className="flex items-center justify-between gap-3 py-2.5"
                        >
                          <div className="min-w-0">
                            <p className="truncate text-sm font-medium text-cream">
                              {reservationTitle(reservation)}
                            </p>
                            <p className="truncate text-xs text-cream/50">
                              {reservation.user?.name || "Client"}
                            </p>
                          </div>
                          <span className="shrink-0 text-xs text-cream/60">
                            Départ{" "}
                            {formatDay(reservation.check_out, { day: "numeric", month: "short" })}
                          </span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>
            </div>
          </div>
          <div className="grid grid-cols-3 divide-x divide-gold/10 border-t border-gold/10 px-2 py-4">
            <MiniStat label="Occupés" value={occupied.length} />
            <MiniStat label="Arrivées du jour" value={insights.arrivals} />
            <MiniStat label="Départs du jour" value={insights.departures} />
          </div>
        </AdminCard>
      </div>

      {/* Réservations récentes : tableau du back-office, pleine largeur */}
      <DataTable
        title="Réservations récentes"
        description="Les dernières demandes reçues"
        columns={recentColumns}
        rowKey={(r) => r.id}
        loading={loading}
        emptyTitle="Aucune réservation"
        emptyMessage="Les nouvelles demandes apparaîtront ici."
        searchPlaceholder="Réf. (MN121126), client, appartement…"
        perPageOptions={[5, 10, 25]}
        actions={
          <Link
            href="/admin/reservations"
            className="inline-flex h-10 items-center gap-2 rounded-lg border border-gold/20 px-4 text-sm font-medium text-cream/70 transition hover:border-gold/50 hover:text-gold-light"
          >
            Tout voir <ArrowRight size={15} />
          </Link>
        }
        {...recent}
      />
    </div>
  );
}

function MetricCard({
  icon: Icon,
  title,
  value,
  change
}: {
  icon: ComponentType<{ size?: number; className?: string }>;
  title: string;
  value: string;
  change?: number | null;
}) {
  return (
    <AdminCard className="flex min-w-0 flex-col p-5 md:p-6">
      <div className="flex items-start justify-between gap-3">
        <div className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-gold/15 text-gold-light">
          <Icon size={24} />
        </div>
        {typeof change === "number" && Number.isFinite(change) && (
          <span
            title="Par rapport au mois précédent"
            className={cn(
              "inline-flex shrink-0 items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold",
              change >= 0
                ? "bg-olive/15 text-olive-light"
                : "bg-terracotta/15 text-terracotta-light"
            )}
          >
            {change >= 0 ? <ArrowUpRight size={13} /> : <ArrowDownRight size={13} />}
            {Math.abs(change).toFixed(1)}%
          </span>
        )}
      </div>
      <div className="mt-auto pt-5">
        <span className="text-sm text-cream/55">{title}</span>
        <p className="mt-1.5 break-words font-display text-2xl font-bold leading-tight text-cream">
          {value}
        </p>
      </div>
    </AdminCard>
  );
}

function CardTitle({
  title,
  subtitle,
  action
}: {
  title: string;
  subtitle?: string;
  action?: ReactNode;
}) {
  return (
    <div className="mb-4 flex items-start justify-between gap-3">
      <div className="min-w-0">
        <h3 className="text-lg font-semibold text-cream">{title}</h3>
        {subtitle && <p className="mt-0.5 text-sm text-cream/50">{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}

function YearSelect({
  years,
  value,
  onChange
}: {
  years: number[];
  value: number;
  onChange: (year: number) => void;
}) {
  return (
    <select
      value={value}
      onChange={(event) => onChange(Number(event.target.value))}
      aria-label="Année"
      className="glass-input h-9 shrink-0 rounded-lg px-2.5 text-sm"
    >
      {years.map((year) => (
        <option key={year} value={year} className="text-night">
          {year}
        </option>
      ))}
    </select>
  );
}

function MiniStat({ label, value }: { label: string; value: number }) {
  return (
    <div className="px-2 text-center">
      <p className="mb-1 text-xs text-cream/50 sm:text-sm">{label}</p>
      <p className="font-display text-lg font-semibold text-cream sm:text-xl">{value}</p>
    </div>
  );
}
