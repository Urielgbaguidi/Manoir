"use client";

import {
  ArrowDownRight,
  ArrowRight,
  ArrowUpRight,
  CalendarRange,
  CircleAlert,
  Users,
  Wallet,
  WalletCards
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useEffect, useMemo, useState, type ComponentType, type ReactNode } from "react";
import { AdminCard, AdminPageHeader } from "@/components/dashboard/admin/AdminShell";
import {
  ActivityChart,
  CategoryDonut,
  MonthlyRevenueChart,
  OccupancyGauge
} from "@/components/dashboard/admin/charts";
import { useToast } from "@/context/ToastContext";
import { api, type AdminStatsResponse, type Reservation } from "@/lib/api";
import {
  categoryLabels,
  formatCurrency,
  formatDay,
  parseDay,
  reservationTitle,
  statusLabels,
  statusTone
} from "@/lib/reservationDisplay";
import { cn } from "@/lib/utils";

type Stats = AdminStatsResponse["stats"] & { revenue_this_month?: number };

const sameDay = (a: Date | null, b: Date) =>
  Boolean(a) &&
  a!.getFullYear() === b.getFullYear() &&
  a!.getMonth() === b.getMonth() &&
  a!.getDate() === b.getDate();

export default function AdminDashboardPage() {
  const { showToast } = useToast();
  const [stats, setStats] = useState<Stats | null>(null);
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [occupied, setOccupied] = useState<Reservation[]>([]);
  const [loading, setLoading] = useState(true);
  const currentYear = new Date().getFullYear();
  const [year, setYear] = useState(currentYear);

  useEffect(() => {
    Promise.all([api.getAdminStats(), api.getAdminReservations({ per_page: 500 }), api.getOccupiedRooms()])
      .then(([statsData, reservationData, occupiedData]) => {
        setStats(statsData.stats);
        setReservations(reservationData.data);
        setOccupied(occupiedData.data);
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

  const series = useMemo(() => {
    const revenue = Array(12).fill(0) as number[];
    const requests = Array(12).fill(0) as number[];
    const confirmed = Array(12).fill(0) as number[];

    reservations.forEach((reservation) => {
      const created = new Date(reservation.created_at);
      if (created.getFullYear() === year) requests[created.getMonth()] += 1;

      (reservation.payments || [])
        .filter((payment) => payment.status === "success")
        .forEach((payment) => {
          const paid = new Date(payment.paid_at || payment.created_at);
          if (paid.getFullYear() !== year) return;
          revenue[paid.getMonth()] += Number(payment.amount || 0);
          if (payment.payment_type !== "stay") confirmed[paid.getMonth()] += 1;
        });
    });

    return { revenue, requests, confirmed };
  }, [reservations, year]);

  const insights = useMemo(() => {
    const today = new Date();
    const thisMonth = today.getMonth();
    const revenueAll = Array(24).fill(0) as number[];
    reservations.forEach((reservation) =>
      (reservation.payments || [])
        .filter((payment) => payment.status === "success")
        .forEach((payment) => {
          const paid = new Date(payment.paid_at || payment.created_at);
          const offset = (today.getFullYear() - paid.getFullYear()) * 12 + (thisMonth - paid.getMonth());
          if (offset >= 0 && offset < 24) revenueAll[offset] += Number(payment.amount || 0);
        })
    );
    const current = revenueAll[0];
    const previous = revenueAll[1];
    const revenueChange = previous > 0 ? ((current - previous) / previous) * 100 : null;

    const stayed = ["CONFIRMEE", "SEJOUR_PAYE"];
    const arrivals = reservations.filter(
      (reservation) => stayed.includes(reservation.status) && sameDay(parseDay(reservation.check_in), today)
    ).length;
    const departures = reservations.filter(
      (reservation) => stayed.includes(reservation.status) && sameDay(parseDay(reservation.check_out), today)
    ).length;

    const extensions = reservations.filter((reservation) => reservation.extension_status === "EN_ATTENTE").length;
    const refunds = reservations.filter((reservation) => reservation.status === "ANNULEE").length;
    const awaitingDeposit = reservations.filter((reservation) => reservation.status === "VALIDEE_PAIEMENT_REQUIS").length;

    const byCategory = (["vip", "deux_chambres", "une_chambre"] as const).map(
      (type) => reservations.filter((reservation) => reservation.category_type === type).length
    );

    const recent = [...reservations]
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
      .slice(0, 6);

    return { current, revenueChange, arrivals, departures, extensions, refunds, awaitingDeposit, byCategory, recent };
  }, [reservations]);

  const todo = [
    { count: insights.extensions, label: "prolongation(s) à valider", href: "/admin/reservations" },
    { count: insights.refunds, label: "remboursement(s) à confirmer", href: "/admin/reservations" },
    { count: insights.awaitingDeposit, label: "acompte(s) en attente de paiement", href: "/admin/reservations" }
  ].filter((item) => item.count > 0);

  return (
    <div>
      <AdminPageHeader title="Tableau de bord" />

      {todo.length > 0 && (
        <div className="mb-6 flex flex-col gap-3 rounded-2xl border border-gold/30 bg-gold/10 p-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3">
            <CircleAlert size={20} className="mt-0.5 shrink-0 text-gold-light" />
            <p className="text-sm text-cream/80">
              À traiter :{" "}
              {todo.map((item, index) => (
                <span key={item.label}>
                  <strong className="text-cream">{item.count}</strong> {item.label}
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

      <div className="grid grid-cols-12 gap-4 md:gap-6">
        {/* Métriques + CA mensuel */}
        <div className="col-span-12 space-y-4 md:space-y-6 xl:col-span-7">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:gap-6">
            <MetricCard icon={Users} title="Clients" value={loading ? "…" : String(stats?.total_users ?? 0)} />
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

          <AdminCard className="overflow-hidden px-5 pt-5 sm:px-6 sm:pt-6">
            <CardTitle
              title="Encaissements mensuels"
              subtitle="Acomptes et soldes de séjour réglés"
              action={<YearSelect years={years} value={year} onChange={setYear} />}
            />
            <div className="overflow-x-auto">
              <MonthlyRevenueChart data={series.revenue} />
            </div>
          </AdminCard>
        </div>

        {/* Occupation */}
        <div className="col-span-12 xl:col-span-5">
          <AdminCard className="flex h-full flex-col bg-white/[0.02]">
            <div className="flex flex-1 flex-col rounded-2xl px-5 pb-6 pt-5 sm:px-6 sm:pt-6">
              <CardTitle title="Taux d'occupation" subtitle="Appartements occupés aujourd'hui" />
              <div className="relative">
                <OccupancyGauge value={stats?.occupancy_rate ?? 0} />
              </div>
              <p className="mx-auto mt-2 max-w-sm text-center text-sm text-cream/60">
                {loading
                  ? "Chargement…"
                  : `${occupied.length} appartement(s) occupé(s) sur ${stats?.total_rooms ?? 0}.`}
              </p>

              {/* Séjours en cours : qui occupe quoi, jusqu'à quand */}
              <div className="mt-6 flex-1">
                <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-cream/45">En ce moment</p>
                {occupied.length === 0 ? (
                  <p className="rounded-xl border border-dashed border-gold/20 px-4 py-5 text-center text-sm text-cream/50">
                    Aucun appartement occupé.
                  </p>
                ) : (
                  <ul className="divide-y divide-gold/10">
                    {occupied.slice(0, 4).map((reservation) => (
                      <li key={reservation.id} className="flex items-center justify-between gap-3 py-2.5">
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium text-cream">{reservationTitle(reservation)}</p>
                          <p className="truncate text-xs text-cream/50">{reservation.user?.name || "Client"}</p>
                        </div>
                        <span className="shrink-0 text-xs text-cream/60">
                          Départ {formatDay(reservation.check_out, { day: "numeric", month: "short" })}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
                {occupied.length > 0 && (
                  <Link
                    href="/admin/reservations#occupation"
                    className="mt-2 inline-flex items-center gap-1.5 text-sm font-semibold text-gold-light hover:underline"
                  >
                    Gérer l'occupation <ArrowRight size={14} />
                  </Link>
                )}
              </div>
            </div>
            <div className="grid grid-cols-3 divide-x divide-gold/10 border-t border-gold/10 px-2 py-4 sm:py-5">
              <MiniStat label="Occupés" value={occupied.length} />
              <MiniStat label="Arrivées du jour" value={insights.arrivals} />
              <MiniStat label="Départs du jour" value={insights.departures} />
            </div>
          </AdminCard>
        </div>

        {/* Activité */}
        <div className="col-span-12">
          <AdminCard className="px-5 pb-5 pt-5 sm:px-6 sm:pt-6">
            <CardTitle
              title="Activité"
              subtitle={`Demandes reçues et séjours confirmés en ${year}`}
              action={<YearSelect years={years} value={year} onChange={setYear} />}
            />
            <ActivityChart requests={series.requests} confirmed={series.confirmed} />
          </AdminCard>
        </div>

        {/* Répartition par catégorie */}
        <div className="col-span-12 xl:col-span-5">
          <AdminCard className="h-full p-5 sm:p-6">
            <CardTitle title="Par catégorie" subtitle="Toutes réservations confondues" />
            <CategoryDonut
              labels={[categoryLabels.vip, categoryLabels.deux_chambres, categoryLabels.une_chambre]}
              values={insights.byCategory}
            />
            <ul className="mt-4 space-y-3">
              {(["vip", "deux_chambres", "une_chambre"] as const).map((type, index) => {
                const total = insights.byCategory.reduce((sum, value) => sum + value, 0) || 1;
                const value = insights.byCategory[index];
                const colors = ["bg-gold", "bg-olive-light", "bg-terracotta"];
                return (
                  <li key={type}>
                    <div className="mb-1.5 flex items-center justify-between text-sm">
                      <span className="text-cream/75">{categoryLabels[type]}</span>
                      <span className="font-semibold text-cream">{value}</span>
                    </div>
                    <div className="h-1.5 overflow-hidden rounded-full bg-white/10">
                      <div className={cn("h-full rounded-full", colors[index])} style={{ width: `${(value / total) * 100}%` }} />
                    </div>
                  </li>
                );
              })}
            </ul>
          </AdminCard>
        </div>

        {/* Réservations récentes */}
        <div className="col-span-12 xl:col-span-7">
          <AdminCard className="h-full overflow-hidden px-4 pb-3 pt-4 sm:px-6">
            <div className="mb-4 flex items-center justify-between gap-2">
              <h3 className="text-lg font-semibold text-cream">Réservations récentes</h3>
              <Link
                href="/admin/reservations"
                className="rounded-lg border border-gold/20 px-3.5 py-2 text-sm font-medium text-cream/75 transition hover:border-gold/50 hover:text-cream"
              >
                Tout voir
              </Link>
            </div>
            <div className="max-w-full overflow-x-auto">
              <table className="w-full min-w-[560px] text-left">
                <thead className="border-y border-gold/10">
                  <tr className="text-xs font-medium text-cream/50">
                    <th className="py-3 pr-3 font-medium">Appartement</th>
                    <th className="py-3 pr-3 font-medium">Client</th>
                    <th className="py-3 pr-3 font-medium">Arrivée</th>
                    <th className="py-3 font-medium">Statut</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gold/10">
                  {loading
                    ? [0, 1, 2, 3].map((index) => (
                        <tr key={index}>
                          <td colSpan={4} className="py-3">
                            <div className="h-10 animate-pulse rounded-lg bg-white/5" />
                          </td>
                        </tr>
                      ))
                    : insights.recent.map((reservation) => (
                        <tr key={reservation.id}>
                          <td className="py-3 pr-3">
                            <div className="flex items-center gap-3">
                              <div className="relative size-11 shrink-0 overflow-hidden rounded-lg bg-white/5">
                                <Image
                                  src={reservation.room?.images?.[0] || "/assets/rooms/room1.jpg"}
                                  alt=""
                                  fill
                                  sizes="44px"
                                  className="object-cover"
                                />
                              </div>
                              <div className="min-w-0 max-w-[160px] 2xl:max-w-[240px]">
                                <p className="truncate text-sm font-medium text-cream" title={reservationTitle(reservation)}>
                                  {reservationTitle(reservation)}
                                </p>
                                <span className="text-xs text-cream/50">Réf. #{reservation.id}</span>
                              </div>
                            </div>
                          </td>
                          <td className="whitespace-nowrap py-3 pr-3 text-sm text-cream/70">
                            {reservation.user?.name || "Non renseigné"}
                          </td>
                          <td className="whitespace-nowrap py-3 pr-3 text-sm text-cream/70">
                            {formatDay(reservation.check_in)}
                          </td>
                          <td className="py-3">
                            <span
                              className={cn(
                                "inline-flex whitespace-nowrap rounded-full border px-2.5 py-0.5 text-xs font-medium",
                                statusTone(reservation.status)
                              )}
                            >
                              {statusLabels[reservation.status]}
                            </span>
                          </td>
                        </tr>
                      ))}
                  {!loading && insights.recent.length === 0 && (
                    <tr>
                      <td colSpan={4} className="py-10 text-center text-sm text-cream/50">
                        Aucune réservation pour le moment.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </AdminCard>
        </div>
      </div>
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
    <AdminCard className="p-5 md:p-6">
      <div className="flex size-12 items-center justify-center rounded-xl bg-gold/15 text-gold-light">
        <Icon size={24} />
      </div>
      <div className="mt-5 flex flex-wrap items-end justify-between gap-x-3 gap-y-2">
        <div className="min-w-0">
          <span className="text-sm text-cream/55">{title}</span>
          <h4 className="mt-2 whitespace-nowrap font-display text-xl font-bold text-cream 2xl:text-2xl">{value}</h4>
        </div>
        {typeof change === "number" && Number.isFinite(change) && (
          <span
            className={cn(
              "inline-flex shrink-0 items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold",
              change >= 0 ? "bg-olive/15 text-olive-light" : "bg-terracotta/15 text-terracotta-light"
            )}
          >
            {change >= 0 ? <ArrowUpRight size={13} /> : <ArrowDownRight size={13} />}
            {Math.abs(change).toFixed(1)}%
          </span>
        )}
      </div>
    </AdminCard>
  );
}

function CardTitle({ title, subtitle, action }: { title: string; subtitle?: string; action?: ReactNode }) {
  return (
    <div className="mb-4 flex items-start justify-between gap-3">
      <div>
        <h3 className="text-lg font-semibold text-cream">{title}</h3>
        {subtitle && <p className="mt-0.5 text-sm text-cream/50">{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}

function YearSelect({ years, value, onChange }: { years: number[]; value: number; onChange: (year: number) => void }) {
  return (
    <select
      value={value}
      onChange={(event) => onChange(Number(event.target.value))}
      aria-label="Année"
      className="glass-input h-9 rounded-lg px-2.5 text-sm"
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
