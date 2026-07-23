"use client";

import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { useToast } from "@/context/ToastContext";
import { useRouter } from "next/navigation";
import { api, Reservation, type AdminStatsResponse } from "@/lib/api";
import { motion, AnimatePresence } from "framer-motion";
import {
  BedDouble,
  Calendar,
  Check,
  DollarSign,
  DoorOpen,
  Download,
  Mail,
  Phone,
  RefreshCcw,
  Search,
  Sparkles,
  TrendingUp,
  Users,
  X
} from "lucide-react";
import Link from "next/link";

type AdminStats = AdminStatsResponse["stats"] & { revenue_this_month?: number };

const statusLabels: Record<string, string> = {
  EN_ATTENTE: "En attente",
  VALIDEE_PAIEMENT_REQUIS: "Caution requise",
  CONFIRMEE: "Confirmee",
  REFUSEE: "Refusee",
  EXPIREE: "Expiree",
  SEJOUR_PAYE: "Sejour paye",
  ANNULEE: "Annulee",
  REMBOURSEE: "Remboursee",
  LIBEREE: "Appartement libere"
};

const categoryLabels: Record<string, string> = {
  vip: "Appartement VIP",
  deux_chambres: "Appartement 2 Chambres",
  une_chambre: "Appartement 1 Chambre"
};

const statusClasses = (status: string) => {
  if (status === "EN_ATTENTE") return "bg-gold/10 text-gold-light border-gold/25";
  if (status === "VALIDEE_PAIEMENT_REQUIS") return "bg-sky-500/10 text-sky-300 border-sky-500/30";
  if (status === "CONFIRMEE" || status === "SEJOUR_PAYE")
    return "bg-olive/15 text-olive-light border-olive/40";
  if (status === "REFUSEE") return "bg-terracotta/15 text-terracotta-light border-terracotta/40";
  if (status === "ANNULEE") return "bg-orange-500/10 text-orange-300 border-orange-500/30";
  if (status === "REMBOURSEE") return "bg-purple-500/10 text-purple-300 border-purple-500/30";
  if (status === "LIBEREE") return "bg-sky-500/10 text-sky-300 border-sky-500/30";
  return "bg-white/10 text-cream/60 border-white/15";
};

const reservationApartmentLabel = (reservation: Reservation) => {
  const room = reservation.room;

  if (room?.apartment_number) {
    const label =
      reservation.category_type === "vip"
        ? room.name
        : reservation.category_type === "deux_chambres"
          ? "2 Chambres"
          : reservation.category_type === "une_chambre"
            ? "1 Chambre"
            : room.name;

    return `Appartement N°${room.apartment_number} — ${label}`;
  }

  return categoryLabels[reservation.category_type || ""] || room?.name || "Appartement";
};

const parseAdminDate = (value?: string) => {
  if (!value) return null;

  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
};

const formatAdminDate = (value?: string) =>
  parseAdminDate(value)?.toLocaleDateString("fr-FR") || "Non renseigne";

const formatAdminDateTime = (value?: string) =>
  parseAdminDate(value)?.toLocaleString("fr-FR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  }) || "Non renseigne";

// Partie "YYYY-MM-DD" d'une date ISO, pour comparer aux valeurs des champs <input type="date">.
const isoDatePart = (value?: string) => (value ? value.slice(0, 10) : "");

// Echappe une cellule CSV (delimiteur ";", compatible Excel FR).
const csvCell = (value: unknown) => {
  const str = value === null || value === undefined ? "" : String(value);
  return /[";\n\r]/.test(str) ? `"${str.replace(/"/g, '""')}"` : str;
};

const countStayDays = (reservation: Reservation) => {
  const start = parseAdminDate(reservation.check_in);
  const end = parseAdminDate(reservation.check_out);

  if (!start || !end) return 0;

  return Math.max(1, Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)));
};

const occupiedSinceDays = (reservation: Reservation) => {
  const start = parseAdminDate(reservation.check_in);
  if (!start) return 0;

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  start.setHours(0, 0, 0, 0);

  return Math.max(1, Math.floor((today.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1);
};

export default function AdminDashboard() {
  const { user, loading: authLoading } = useAuth();
  const { showToast } = useToast();
  const router = useRouter();

  const [stats, setStats] = useState<AdminStats | null>(null);
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [occupiedRooms, setOccupiedRooms] = useState<Reservation[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState("EN_ATTENTE");
  const [selectedRes, setSelectedRes] = useState<Reservation | null>(null);
  const [actionType, setActionType] = useState<
    "approve" | "reject" | "extension-approve" | "extension-reject" | null
  >(null);
  const [releaseTarget, setReleaseTarget] = useState<Reservation | null>(null);
  const [releaseNotes, setReleaseNotes] = useState("");
  const [adminNotes, setAdminNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  useEffect(() => {
    if (!authLoading) {
      if (!user) {
        router.push("/auth/login");
      } else if (!user.is_admin) {
        router.push("/");
      }
    }
  }, [user, authLoading, router]);

  const loadDashboardData = useCallback(async () => {
    setLoading(true);
    try {
      const [statsData, resData, occupiedData] = await Promise.all([
        api.getAdminStats(),
        api.getAdminReservations(),
        api.getOccupiedRooms()
      ]);
      setStats(statsData.stats);
      setReservations(resData.data);
      setOccupiedRooms(occupiedData.data);
    } catch (error) {
      console.error("Erreur lors du chargement du back-office:", error);
      showToast("Impossible de charger les donnees administrateur.", "error");
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  useEffect(() => {
    if (user && user.is_admin) {
      loadDashboardData();
    }
  }, [user, loadDashboardData]);

  const handleOpenAction = (
    reservation: Reservation,
    type: "approve" | "reject" | "extension-approve" | "extension-reject"
  ) => {
    setSelectedRes(reservation);
    setActionType(type);
    setAdminNotes("");
    setError("");
  };

  const handleSubmitAction = async () => {
    if (!selectedRes || !actionType) return;
    const isRejectAction = actionType === "reject" || actionType === "extension-reject";

    if (isRejectAction && !adminNotes.trim()) {
      setError("Un motif est obligatoire pour refuser une demande.");
      return;
    }

    setSubmitting(true);
    setError("");

    try {
      if (actionType === "approve") {
        await api.approveReservation(selectedRes.id, { admin_notes: adminNotes });
        showToast("Demande confirmee. Le client peut payer la caution de réservation.", "success");
      } else if (actionType === "reject") {
        await api.rejectReservation(selectedRes.id, { admin_notes: adminNotes });
        showToast("Demande refusee. Le client sera notifie.", "success");
      } else if (actionType === "extension-approve") {
        await api.approveReservationExtension(selectedRes.id, { admin_notes: adminNotes });
        showToast("Prolongation acceptee. Le bon du sejour est mis a jour.", "success");
      } else {
        await api.rejectReservationExtension(selectedRes.id, { admin_notes: adminNotes });
        showToast("Prolongation refusee avec motif.", "success");
      }
      setSelectedRes(null);
      setActionType(null);
      loadDashboardData();
    } catch (err) {
      const message = err instanceof Error ? err.message : "L'action a echoue.";
      setError(message);
      showToast(message, "error");
    } finally {
      setSubmitting(false);
    }
  };

  const handleMarkRefunded = async (reservation: Reservation) => {
    setSubmitting(true);
    setError("");

    try {
      await api.markReservationRefunded(reservation.id);
      showToast("Remboursement marque comme effectue. Le client sera notifie.", "success");
      loadDashboardData();
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Le remboursement n'a pas pu etre confirme.";
      setError(message);
      showToast(message, "error");
    } finally {
      setSubmitting(false);
    }
  };

  const handleOpenRelease = (reservation: Reservation) => {
    setReleaseTarget(reservation);
    setReleaseNotes("");
    setError("");
  };

  const handleReleaseRoom = async () => {
    if (!releaseTarget) return;

    setSubmitting(true);
    setError("");

    try {
      await api.releaseOccupiedRoom(releaseTarget.id, { release_notes: releaseNotes });
      showToast("Appartement libere. Il est de nouveau disponible.", "success");
      setReleaseTarget(null);
      setReleaseNotes("");
      loadDashboardData();
    } catch (err) {
      const message = err instanceof Error ? err.message : "L'appartement n'a pas pu etre libere.";
      setError(message);
      showToast(message, "error");
    } finally {
      setSubmitting(false);
    }
  };

  const filtersList = [
    {
      key: "all",
      label: "Toutes",
      description: "Voir toutes les demandes, tous statuts confondus."
    },
    {
      key: "EN_ATTENTE",
      label: "En attente",
      description:
        "Voir les demandes envoyees par les clients qui attendent encore la decision de l'administration."
    },
    {
      key: "VALIDEE_PAIEMENT_REQUIS",
      label: "Caution requise",
      description:
        "Voir les demandes acceptees par l'administration, en attente du paiement de la caution de reservation."
    },
    {
      key: "CONFIRMEE",
      label: "Confirmees",
      description: "Voir les reservations dont la caution de reservation a ete payee avec succes."
    },
    {
      key: "EXTENSION_EN_ATTENTE",
      label: "Prolongations",
      description:
        "Voir les demandes de prolongation de sejour qui attendent une reponse administrateur."
    },
    {
      key: "REFUSEE",
      label: "Refusees",
      description: "Voir les demandes rejetees avec le motif indique au client."
    },
    {
      key: "EXPIREE",
      label: "Expirees",
      description: "Voir les demandes dont le delai de paiement de caution a depasse 24h."
    },
    {
      key: "SEJOUR_PAYE",
      label: "Sejours payes",
      description: "Voir les reservations dont les frais de sejour ont ete regles."
    },
    {
      key: "ANNULEE",
      label: "Annulees",
      description: "Voir les reservations annulees par les clients avant le debut de leur sejour."
    },
    {
      key: "REMBOURSEE",
      label: "Remboursees",
      description:
        "Voir les annulations pour lesquelles l'administration a confirme le remboursement."
    },
    {
      key: "LIBEREE",
      label: "Liberees",
      description: "Voir les occupations terminees manuellement par l'administration."
    }
  ];

  const normalizedSearch = searchQuery.trim().toLowerCase();

  const filteredReservations = reservations.filter((reservation) => {
    // Filtre par statut (onglets existants)
    if (statusFilter === "EXTENSION_EN_ATTENTE") {
      if (reservation.extension_status !== "EN_ATTENTE") return false;
    } else if (statusFilter !== "all" && reservation.status !== statusFilter) {
      return false;
    }

    // Recherche texte : nom, email, telephone ou n de reservation
    if (normalizedSearch) {
      const haystack = [
        reservation.user?.name,
        reservation.user?.email,
        reservation.user?.phone,
        String(reservation.id),
        `#${reservation.id}`,
        reservation.deposit_invoice_number,
        reservation.stay_invoice_number
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      if (!haystack.includes(normalizedSearch)) return false;
    }

    // Filtre plage de dates sur check_in
    const checkInDay = isoDatePart(reservation.check_in);
    if (dateFrom && checkInDay < dateFrom) return false;
    if (dateTo && checkInDay > dateTo) return false;

    return true;
  });

  const handleExportCsv = () => {
    const headers = [
      "Ref",
      "Client",
      "Email",
      "Telephone",
      "Categorie",
      "Arrivee",
      "Depart",
      "Statut",
      "Caution (FCFA)",
      "Sejour (FCFA)",
      "Total (FCFA)"
    ];

    const rows = filteredReservations.map((reservation) => [
      `#${reservation.id}`,
      reservation.user?.name ?? "",
      reservation.user?.email ?? "",
      reservation.user?.phone ?? "",
      reservationApartmentLabel(reservation),
      formatAdminDate(reservation.check_in),
      formatAdminDate(reservation.check_out),
      statusLabels[reservation.status] || reservation.status,
      reservation.deposit_amount ?? reservation.total_price ?? 0,
      reservation.stay_amount ?? 0,
      reservation.total_price ?? 0
    ]);

    const csv = [headers, ...rows].map((row) => row.map(csvCell).join(";")).join("\r\n");

    // BOM en tete pour qu'Excel lise correctement l'UTF-8 (accents).
    const bom = String.fromCharCode(0xfeff);
    const blob = new Blob([bom + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `reservations-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  if (authLoading || loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-night">
        <div className="h-12 w-12 animate-spin rounded-full border-4 border-gold border-t-transparent" />
      </div>
    );
  }

  return (
    <main className="relative min-h-screen px-6 py-32 text-cream md:px-10">
      <div className="mx-auto max-w-7xl">
        <div className="mb-12 flex flex-col items-start justify-between gap-6 border-b border-gold/15 pb-8 md:flex-row md:items-center">
          <div>
            <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-gold/25 bg-white/5 px-4 py-2 backdrop-blur-md">
              <Sparkles className="h-4 w-4 text-gold-light" />
              <span className="text-[10px] font-semibold uppercase tracking-widest text-cream/85">
                Portail Administrateur
              </span>
            </div>
            <h1 className="font-display text-4xl font-semibold uppercase tracking-tight text-cream md:text-5xl">
              Tableau de <span className="text-gradient-gold">Bord</span>
            </h1>
          </div>

          <div className="flex flex-wrap gap-4 text-xs font-black uppercase tracking-wider">
            <Link
              href="/admin"
              className="border border-gold bg-gradient-to-br from-gold-light to-gold px-5 py-3 text-night transition"
            >
              Reservations
            </Link>
            <Link
              href="/admin/rooms"
              className="border border-gold/20 px-5 py-3 text-gold/80 transition hover:border-gold hover:text-gold-light"
            >
              Appartements
            </Link>
            <Link
              href="/admin/users"
              className="border border-gold/20 px-5 py-3 text-gold/80 transition hover:border-gold hover:text-gold-light"
            >
              Utilisateurs
            </Link>
          </div>
        </div>

        {stats && (
          <div className="mb-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {[
              {
                label: "Taux d'occupation",
                value: `${stats.occupancy_rate}%`,
                icon: TrendingUp,
                note: `${stats.occupied_rooms_count} appartements occupes`
              },
              {
                label: "Chiffre d'affaires",
                value: `${Number(stats.total_revenue || 0).toLocaleString("fr-FR")} F`,
                icon: DollarSign,
                note: "Paiements valides"
              },
              {
                label: "CA du mois",
                value: `${Number(stats.revenue_this_month || 0).toLocaleString("fr-FR")} F`,
                icon: Calendar,
                note: "Paiements valides ce mois"
              },
              {
                label: "Reservations",
                value: stats.total_reservations,
                icon: Calendar,
                note: "Demandes recues"
              },
              {
                label: "Utilisateurs",
                value: stats.total_users,
                icon: Users,
                note: "Profils clients"
              }
            ].map((item) => (
              <div key={item.label} className="glass-warm glass-edge space-y-4 rounded-3xl p-6">
                <div className="flex items-center justify-between text-gold/70">
                  <span className="text-[10px] font-semibold uppercase tracking-widest">
                    {item.label}
                  </span>
                  <item.icon size={16} />
                </div>
                <p className="font-display text-4xl font-bold text-cream">{item.value}</p>
                <p className="text-[10px] text-cream/45">{item.note}</p>
              </div>
            ))}
          </div>
        )}

        <section className="glass-dark glass-edge mb-12 rounded-3xl p-6 md:p-8">
          <div className="mb-6 flex flex-col justify-between gap-4 border-b border-gold/15 pb-6 md:flex-row md:items-end">
            <div>
              <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-gold/20 bg-white/5 px-3 py-1.5 text-[10px] font-bold uppercase tracking-widest text-gold-light">
                <BedDouble size={14} />
                Occupation actuelle
              </div>
              <h2 className="font-display text-2xl font-bold uppercase tracking-wider text-cream">
                Appartements occupes
              </h2>
              <p className="mt-2 max-w-2xl text-sm leading-relaxed text-cream/60">
                Cette liste concerne uniquement les sejours en cours : de la date d'arrivee jusqu'a
                la date de depart. La periode entre la demande et l'arrivee reste une reservation,
                pas une occupation.
              </p>
            </div>
            <div className="glass-warm glass-edge rounded-2xl px-5 py-4 text-center">
              <p className="text-[10px] font-bold uppercase tracking-widest text-gold/70">
                Occupes
              </p>
              <p className="font-display text-4xl font-bold text-cream">{occupiedRooms.length}</p>
            </div>
          </div>

          {occupiedRooms.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-gold/20 bg-white/5 py-12 text-center">
              <DoorOpen className="mx-auto mb-4 h-10 w-10 text-gold/40" />
              <p className="font-semibold text-cream">
                Aucun appartement n'est occupe actuellement.
              </p>
              <p className="mt-1 text-sm text-cream/50">
                Les sejours actifs apparaitront ici automatiquement.
              </p>
            </div>
          ) : (
            <div className="grid gap-5 lg:grid-cols-2">
              {occupiedRooms.map((reservation) => (
                <article key={reservation.id} className="glass-warm glass-edge rounded-2xl p-5">
                  <div className="mb-4 flex flex-col justify-between gap-3 border-b border-gold/15 pb-4 sm:flex-row sm:items-start">
                    <div>
                      <p className="font-display text-xl font-bold uppercase text-cream">
                        {reservationApartmentLabel(reservation)}
                      </p>
                      <p className="mt-1 text-[10px] font-bold uppercase tracking-widest text-cream/45">
                        Reservation #{reservation.id}
                      </p>
                    </div>
                    <span className="w-fit rounded-full border border-olive/40 bg-olive/15 px-3 py-1 text-[10px] font-black uppercase tracking-widest text-olive-light">
                      Occupe
                    </span>
                  </div>

                  <div className="grid gap-4 text-sm md:grid-cols-2">
                    <div className="rounded-xl border border-gold/15 bg-white/5 p-4">
                      <p className="mb-3 text-[10px] font-black uppercase tracking-widest text-gold/70">
                        Client occupant
                      </p>
                      <p className="font-semibold text-cream">
                        {reservation.user?.name || "Client non renseigne"}
                      </p>
                      <p className="mt-2 flex items-center gap-2 text-cream/65">
                        <Mail size={13} />
                        {reservation.user?.email || "Email non renseigne"}
                      </p>
                      <p className="mt-1 flex items-center gap-2 text-cream/65">
                        <Phone size={13} />
                        {reservation.user?.phone || "Telephone non renseigne"}
                      </p>
                    </div>

                    <div className="rounded-xl border border-gold/15 bg-white/5 p-4">
                      <p className="mb-3 text-[10px] font-black uppercase tracking-widest text-gold/70">
                        Occupation
                      </p>
                      <p className="text-cream/70">
                        Demande :{" "}
                        <strong className="text-cream">
                          {formatAdminDateTime(reservation.created_at)}
                        </strong>
                      </p>
                      <p className="mt-1 text-cream/70">
                        Arrivee :{" "}
                        <strong className="text-cream">
                          {formatAdminDate(reservation.check_in)}
                        </strong>
                      </p>
                      <p className="mt-1 text-cream/70">
                        Depart prevu :{" "}
                        <strong className="text-cream">
                          {formatAdminDate(reservation.check_out)}
                        </strong>
                      </p>
                    </div>
                  </div>

                  <div className="mt-4 grid gap-3 text-xs sm:grid-cols-3">
                    <div className="rounded-xl bg-white/5 p-3">
                      <span className="block text-[9px] font-bold uppercase tracking-widest text-cream/45">
                        Duree totale
                      </span>
                      <strong className="mt-1 block text-cream">
                        {countStayDays(reservation)} nuit(s)
                      </strong>
                    </div>
                    <div className="rounded-xl bg-white/5 p-3">
                      <span className="block text-[9px] font-bold uppercase tracking-widest text-cream/45">
                        Jour actuel
                      </span>
                      <strong className="mt-1 block text-cream">
                        {occupiedSinceDays(reservation)}e jour
                      </strong>
                    </div>
                    <div className="rounded-xl bg-white/5 p-3">
                      <span className="block text-[9px] font-bold uppercase tracking-widest text-cream/45">
                        Statut
                      </span>
                      <strong className="mt-1 block text-cream">
                        {statusLabels[reservation.status] || reservation.status}
                      </strong>
                    </div>
                  </div>

                  {reservation.special_requests && (
                    <div className="mt-4 rounded-xl border border-gold/15 bg-white/5 p-3 text-xs leading-relaxed text-cream/65">
                      <span className="mb-1 block text-[9px] font-bold uppercase tracking-widest text-gold/70">
                        Demande speciale
                      </span>
                      {reservation.special_requests}
                    </div>
                  )}

                  <button
                    type="button"
                    onClick={() => handleOpenRelease(reservation)}
                    className="mt-5 flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-br from-gold-light to-gold px-5 py-3 text-[10px] font-black uppercase tracking-[0.2em] text-night transition hover:brightness-105"
                  >
                    <DoorOpen size={14} />
                    Liberer l'appartement
                  </button>
                </article>
              ))}
            </div>
          )}
        </section>

        <div className="space-y-6">
          <div className="flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
            <h2 className="font-display text-2xl font-bold uppercase tracking-wider text-cream">
              Demandes de sejour
            </h2>
          </div>

          <div className="glass-warm glass-edge rounded-3xl p-5 md:p-6">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
              <div className="flex flex-1 flex-col gap-4 sm:flex-row sm:items-end">
                <label className="block sm:flex-1">
                  <span className="mb-2 block text-[10px] font-semibold uppercase tracking-wider text-gold/80">
                    Recherche
                  </span>
                  <div className="relative">
                    <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-cream/40" />
                    <input
                      type="search"
                      value={searchQuery}
                      onChange={(event) => setSearchQuery(event.target.value)}
                      placeholder="Nom, email, telephone, n de reservation..."
                      className="glass-input w-full rounded-xl py-3 pl-11 pr-4 text-sm outline-none"
                    />
                  </div>
                </label>

                <label className="block">
                  <span className="mb-2 block text-[10px] font-semibold uppercase tracking-wider text-gold/80">
                    Arrivee du
                  </span>
                  <input
                    type="date"
                    value={dateFrom}
                    max={dateTo || undefined}
                    onChange={(event) => setDateFrom(event.target.value)}
                    className="glass-input w-full rounded-xl px-4 py-3 text-sm outline-none"
                  />
                </label>

                <label className="block">
                  <span className="mb-2 block text-[10px] font-semibold uppercase tracking-wider text-gold/80">
                    Arrivee au
                  </span>
                  <input
                    type="date"
                    value={dateTo}
                    min={dateFrom || undefined}
                    onChange={(event) => setDateTo(event.target.value)}
                    className="glass-input w-full rounded-xl px-4 py-3 text-sm outline-none"
                  />
                </label>
              </div>

              <div className="flex items-center gap-3">
                {(searchQuery || dateFrom || dateTo) && (
                  <button
                    type="button"
                    onClick={() => {
                      setSearchQuery("");
                      setDateFrom("");
                      setDateTo("");
                    }}
                    className="rounded-full border border-gold/15 px-4 py-3 text-[10px] font-bold uppercase tracking-widest text-cream/60 transition hover:border-gold/40 hover:text-gold-light"
                  >
                    Reinitialiser
                  </button>
                )}
                <button
                  type="button"
                  onClick={handleExportCsv}
                  disabled={filteredReservations.length === 0}
                  className="flex items-center gap-2 rounded-full bg-gradient-to-br from-gold-light to-gold px-5 py-3 text-[10px] font-black uppercase tracking-widest text-night transition hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <Download size={14} />
                  Export CSV
                </button>
              </div>
            </div>

            <p className="mt-4 text-[11px] uppercase tracking-widest text-cream/45">
              {filteredReservations.length} resultat(s) affiche(s)
            </p>
          </div>

          <div className="flex flex-wrap gap-2 border-b border-gold/10 pb-7 text-xs font-semibold uppercase tracking-wider">
            {filtersList.map((filter) => (
              <div key={filter.key} className="group relative">
                <button
                  type="button"
                  onClick={() => setStatusFilter(filter.key)}
                  aria-describedby={`admin-filter-help-${filter.key}`}
                  className={`rounded-full border px-4 py-2 transition ${
                    statusFilter === filter.key
                      ? "border-gold bg-gradient-to-br from-gold-light to-gold text-night"
                      : "border-gold/15 bg-transparent text-cream/60 hover:border-gold/40 hover:text-gold-light"
                  }`}
                >
                  {filter.label}
                </button>
                <div
                  id={`admin-filter-help-${filter.key}`}
                  role="tooltip"
                  className="pointer-events-none absolute left-1/2 top-[calc(100%+0.5rem)] z-40 w-72 -translate-x-1/2 rounded-2xl border border-gold/20 bg-night-700 px-4 py-3 text-left text-[11px] font-semibold normal-case leading-relaxed tracking-normal text-cream opacity-0 shadow-2xl shadow-black/50 transition-opacity duration-150 delay-0 group-hover:delay-1000 group-hover:opacity-100 group-focus-within:delay-1000 group-focus-within:opacity-100"
                >
                  <span className="absolute -top-1.5 left-1/2 h-3 w-3 -translate-x-1/2 rotate-45 border-l border-t border-gold/20 bg-night-700" />
                  {filter.description}
                </div>
              </div>
            ))}
          </div>

          {filteredReservations.length === 0 ? (
            <div className="glass-dark glass-edge rounded-3xl py-20 text-center">
              <p className="text-sm text-cream/45">Aucune demande ne correspond a ce filtre.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {filteredReservations.map((reservation) => (
                <div
                  key={reservation.id}
                  className="glass-dark glass-edge flex flex-col justify-between gap-6 rounded-3xl p-6 transition-all duration-300 hover:border-gold/30 md:p-8 lg:flex-row"
                >
                  <div className="flex-1 space-y-4">
                    <div className="flex flex-wrap items-center gap-3">
                      <span className="font-display text-lg font-bold uppercase text-cream">
                        {reservationApartmentLabel(reservation)}
                      </span>
                      <span className="text-[10px] uppercase tracking-widest text-cream/45">
                        Ref #{reservation.id}
                      </span>
                      <span
                        className={`rounded border px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider ${statusClasses(reservation.status)}`}
                      >
                        {statusLabels[reservation.status] || reservation.status}
                      </span>
                    </div>

                    <div className="grid gap-6 border-t border-gold/10 pt-2 text-xs text-cream/60 sm:grid-cols-3">
                      <div>
                        <span className="mb-1 block text-[9px] uppercase tracking-widest text-cream/40">
                          Client
                        </span>
                        <p className="font-semibold text-cream">{reservation.user?.name}</p>
                        <p className="text-cream/55">{reservation.user?.email}</p>
                      </div>
                      <div>
                        <span className="mb-1 block text-[9px] uppercase tracking-widest text-cream/40">
                          Dates
                        </span>
                        <p className="font-semibold text-cream">
                          Du {new Date(reservation.check_in).toLocaleDateString("fr-FR")} au{" "}
                          {new Date(reservation.check_out).toLocaleDateString("fr-FR")}
                        </p>
                        <p className="text-cream/55">
                          {reservation.room?.type || reservation.category_type}
                        </p>
                      </div>
                      <div>
                        <span className="mb-1 block text-[9px] uppercase tracking-widest text-cream/40">
                          Caution / sejour
                        </span>
                        <p className="text-sm font-bold text-cream">
                          {(reservation.deposit_amount ?? reservation.total_price).toLocaleString(
                            "fr-FR"
                          )}{" "}
                          FCFA
                        </p>
                        <p className="text-cream/55">
                          {(reservation.stay_amount ?? 0).toLocaleString("fr-FR")} FCFA sejour
                        </p>
                        {(reservation.status === "ANNULEE" ||
                          reservation.status === "REMBOURSEE") && (
                          <p className="mt-1 font-semibold text-orange-300">
                            A rembourser :{" "}
                            {(reservation.cancellation_refund_amount ?? 0).toLocaleString("fr-FR")}{" "}
                            FCFA
                          </p>
                        )}
                      </div>
                    </div>

                    {reservation.special_requests && (
                      <div className="rounded-xl border border-gold/10 bg-white/5 p-3 text-xs text-cream/60">
                        <span className="mb-1 block text-[9px] font-bold uppercase tracking-wider text-gold/70">
                          Demande client
                        </span>
                        {reservation.special_requests}
                      </div>
                    )}

                    {reservation.extension_status && (
                      <div className="rounded-xl border border-gold/15 bg-white/5 p-3 text-xs leading-relaxed text-cream/70">
                        <span className="mb-1 block text-[9px] font-bold uppercase tracking-wider text-gold/80">
                          Prolongation du séjour
                        </span>
                        <p>
                          Statut :{" "}
                          <strong>
                            {reservation.extension_status === "EN_ATTENTE"
                              ? "En attente"
                              : reservation.extension_status === "APPROUVEE"
                                ? "Acceptée"
                                : "Refusée"}
                          </strong>
                        </p>
                        {reservation.extension_previous_check_out && (
                          <p>
                            Départ initial :{" "}
                            {new Date(reservation.extension_previous_check_out).toLocaleDateString(
                              "fr-FR"
                            )}
                          </p>
                        )}
                        {reservation.extension_requested_check_out && (
                          <p>
                            Nouveau départ demandé :{" "}
                            {new Date(reservation.extension_requested_check_out).toLocaleDateString(
                              "fr-FR"
                            )}
                          </p>
                        )}
                        {reservation.extension_admin_notes && (
                          <p>Note admin : {reservation.extension_admin_notes}</p>
                        )}
                      </div>
                    )}
                  </div>

                  <div className="flex min-w-[180px] flex-row items-center justify-end gap-3 border-gold/10 lg:flex-col lg:border-l lg:pl-6">
                    {reservation.status === "EN_ATTENTE" ? (
                      <>
                        <button
                          type="button"
                          onClick={() => handleOpenAction(reservation, "approve")}
                          className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-br from-gold-light to-gold py-3 text-[10px] font-black uppercase tracking-widest text-night transition hover:brightness-105"
                        >
                          <Check size={14} />
                          Confirmer
                        </button>
                        <button
                          type="button"
                          onClick={() => handleOpenAction(reservation, "reject")}
                          className="flex w-full items-center justify-center gap-2 rounded-xl border border-terracotta/40 py-3 text-[10px] font-black uppercase tracking-widest text-terracotta-light transition hover:bg-terracotta/15"
                        >
                          <X size={14} />
                          Rejeter
                        </button>
                      </>
                    ) : reservation.extension_status === "EN_ATTENTE" ? (
                      <>
                        <button
                          type="button"
                          onClick={() => handleOpenAction(reservation, "extension-approve")}
                          className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-br from-gold-light to-gold py-3 text-[10px] font-black uppercase tracking-widest text-night transition hover:brightness-105"
                        >
                          <Check size={14} />
                          Accepter prolongation
                        </button>
                        <button
                          type="button"
                          onClick={() => handleOpenAction(reservation, "extension-reject")}
                          className="flex w-full items-center justify-center gap-2 rounded-xl border border-terracotta/40 py-3 text-[10px] font-black uppercase tracking-widest text-terracotta-light transition hover:bg-terracotta/15"
                        >
                          <X size={14} />
                          Rejeter prolongation
                        </button>
                      </>
                    ) : reservation.status === "ANNULEE" ? (
                      <button
                        type="button"
                        disabled={submitting}
                        onClick={() => handleMarkRefunded(reservation)}
                        className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-br from-gold-light to-gold py-3 text-[10px] font-black uppercase tracking-widest text-night transition hover:brightness-105 disabled:opacity-50"
                      >
                        <RefreshCcw size={14} />
                        Remboursement effectue
                      </button>
                    ) : (
                      <div className="py-4 text-xs italic text-cream/35">Traitee</div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <AnimatePresence>
        {selectedRes && actionType && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => !submitting && setSelectedRes(null)}
              className="absolute inset-0 bg-night/80 backdrop-blur-md"
            />

            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="glass-dark glass-edge relative w-full max-w-lg rounded-3xl p-8 shadow-2xl text-cream"
            >
              <div className="space-y-6">
                <div>
                  <h3 className="font-display text-2xl font-bold uppercase tracking-wide text-cream">
                    {actionType === "approve"
                      ? "Confirmer la demande"
                      : actionType === "reject"
                        ? "Rejeter la demande"
                        : actionType === "extension-approve"
                          ? "Accepter la prolongation"
                          : "Rejeter la prolongation"}
                  </h3>
                  <p className="mt-1 text-[10px] uppercase tracking-widest text-cream/50">
                    Reservation #{selectedRes.id} - {selectedRes.user?.name}
                  </p>
                </div>

                <div className="space-y-2 rounded-2xl border border-gold/10 bg-white/5 p-4 text-xs text-cream/70">
                  <p>
                    <strong>Appartement :</strong> {reservationApartmentLabel(selectedRes)}
                  </p>
                  <p>
                    <strong>Dates :</strong> du {selectedRes.check_in} au {selectedRes.check_out}
                  </p>
                  {(actionType === "extension-approve" || actionType === "extension-reject") &&
                    selectedRes.extension_requested_check_out && (
                      <p>
                        <strong>Nouveau départ demandé :</strong>{" "}
                        {selectedRes.extension_requested_check_out}
                      </p>
                    )}
                  <p>
                    <strong>Caution :</strong>{" "}
                    {(selectedRes.deposit_amount ?? selectedRes.total_price).toLocaleString(
                      "fr-FR"
                    )}{" "}
                    FCFA
                  </p>
                </div>

                <label className="block">
                  <span className="mb-2 block text-[10px] font-semibold uppercase tracking-wider text-gold/80">
                    {actionType === "approve" || actionType === "extension-approve"
                      ? "Notes facultatives"
                      : "Motif du rejet obligatoire"}
                  </span>
                  <textarea
                    rows={4}
                    value={adminNotes}
                    onChange={(event) => setAdminNotes(event.target.value)}
                    className="glass-input w-full resize-none rounded-xl p-4 text-sm outline-none"
                  />
                </label>

                {error && <p className="text-xs font-semibold text-red-400">{error}</p>}

                <div className="flex gap-3 border-t border-gold/10 pt-4">
                  <button
                    type="button"
                    disabled={submitting}
                    onClick={() => setSelectedRes(null)}
                    className="flex-1 rounded-xl border border-gold/15 py-4 text-xs font-bold uppercase tracking-wider text-cream/70 transition hover:bg-white/5 disabled:opacity-50"
                  >
                    Annuler
                  </button>
                  <button
                    type="button"
                    disabled={submitting}
                    onClick={handleSubmitAction}
                    className={`flex-1 rounded-xl py-4 text-xs font-black uppercase tracking-[0.2em] transition disabled:opacity-50 ${
                      actionType === "approve" || actionType === "extension-approve"
                        ? "bg-gradient-to-br from-gold-light to-gold text-night hover:brightness-105"
                        : "bg-terracotta text-cream hover:brightness-110"
                    }`}
                  >
                    {submitting ? "Envoi..." : "Confirmer"}
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {releaseTarget && (
          <div className="fixed inset-0 z-[110] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => !submitting && setReleaseTarget(null)}
              className="absolute inset-0 bg-night/80 backdrop-blur-md"
            />

            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="glass-dark glass-edge relative w-full max-w-xl rounded-3xl p-8 text-cream shadow-2xl"
            >
              <button
                type="button"
                disabled={submitting}
                onClick={() => setReleaseTarget(null)}
                className="absolute right-5 top-5 flex h-10 w-10 items-center justify-center rounded-full border border-gold/20 bg-white/5 text-cream transition hover:border-gold hover:text-gold-light disabled:opacity-50"
                aria-label="Fermer"
              >
                <X size={16} />
              </button>

              <div className="space-y-6">
                <div className="pr-12">
                  <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-gold/20 bg-white/5 px-3 py-1.5 text-[10px] font-bold uppercase tracking-widest text-gold-light">
                    <DoorOpen size={14} />
                    Liberation manuelle
                  </div>
                  <h3 className="font-display text-2xl font-bold uppercase tracking-wide text-cream">
                    Liberer l'appartement
                  </h3>
                  <p className="mt-2 text-sm leading-relaxed text-cream/60">
                    Cette action marque l'occupation comme terminee et rend l'appartement disponible
                    pour d'autres clients. L'historique de la reservation reste conserve.
                  </p>
                </div>

                <div className="space-y-2 rounded-2xl border border-gold/15 bg-white/5 p-4 text-sm text-cream/70">
                  <p>
                    <strong>Appartement :</strong> {reservationApartmentLabel(releaseTarget)}
                  </p>
                  <p>
                    <strong>Client :</strong> {releaseTarget.user?.name || "Client non renseigne"}
                  </p>
                  <p>
                    <strong>Demande :</strong> {formatAdminDateTime(releaseTarget.created_at)}
                  </p>
                  <p>
                    <strong>Occupation :</strong> du {formatAdminDate(releaseTarget.check_in)} au{" "}
                    {formatAdminDate(releaseTarget.check_out)}
                  </p>
                </div>

                <label className="block">
                  <span className="mb-2 block text-[10px] font-semibold uppercase tracking-wider text-gold/80">
                    Note interne facultative
                  </span>
                  <textarea
                    rows={4}
                    value={releaseNotes}
                    onChange={(event) => setReleaseNotes(event.target.value)}
                    placeholder="Ex: depart anticipe, chambre remise a disposition..."
                    className="glass-input w-full resize-none rounded-xl p-4 text-sm outline-none"
                  />
                </label>

                {error && <p className="text-xs font-semibold text-red-400">{error}</p>}

                <div className="flex flex-col gap-3 border-t border-gold/15 pt-4 sm:flex-row">
                  <button
                    type="button"
                    disabled={submitting}
                    onClick={() => setReleaseTarget(null)}
                    className="flex-1 rounded-xl border border-gold/15 py-4 text-xs font-bold uppercase tracking-wider text-cream/70 transition hover:bg-white/5 disabled:opacity-50"
                  >
                    Retour
                  </button>
                  <button
                    type="button"
                    disabled={submitting}
                    onClick={handleReleaseRoom}
                    className="flex-1 rounded-xl bg-gradient-to-br from-gold-light to-gold py-4 text-xs font-black uppercase tracking-[0.2em] text-night transition hover:brightness-105 disabled:opacity-50"
                  >
                    {submitting ? "Liberation..." : "Liberer l'appartement"}
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </main>
  );
}
