"use client";

import { motion } from "framer-motion";
import {
  AlertCircle,
  ArrowRight,
  BadgeCheck,
  CalendarDays,
  Hash,
  Moon,
  UserRound,
  Wallet
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState, type ComponentType, type ReactNode } from "react";
import EmailVerificationBanner from "@/components/ui/EmailVerificationBanner";
import { useAuth } from "@/context/AuthContext";
import { useToast } from "@/context/ToastContext";
import { api, type Reservation } from "@/lib/api";
import {
  ACTIVE_STATUSES,
  countNights,
  effectiveStatus,
  formatCurrency,
  formatDay,
  parseDay,
  reservationTitle,
  statusLabels,
  statusTone,
  successfulPayments
} from "@/lib/reservationDisplay";
import { CONTACT_EMAIL, contactMailto } from "@/lib/site";
import { cn } from "@/lib/utils";

export default function EspaceClientAccueil() {
  const { user } = useAuth();
  const { showToast } = useToast();
  const router = useRouter();
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [loading, setLoading] = useState(true);

  // Anciens liens « /espace-client?payer=ID » : on renvoie vers la page
  // des réservations qui ouvre directement le paiement.
  useEffect(() => {
    const payer = new URLSearchParams(window.location.search).get("payer");
    if (payer) router.replace(`/espace-client/reservations?payer=${encodeURIComponent(payer)}`);
  }, [router]);

  useEffect(() => {
    if (!user) return;
    api
      .getMyReservations()
      .then(setReservations)
      .catch(() => showToast("Impossible de charger vos réservations.", "error"))
      .finally(() => setLoading(false));
  }, [user, showToast]);

  const summary = useMemo(() => {
    const now = Date.now();
    const withStatus = reservations.map((reservation) => ({
      reservation,
      status: effectiveStatus(reservation, now)
    }));
    const active = withStatus.filter((item) => ACTIVE_STATUSES.includes(item.status));
    const toPay = active.filter((item) => item.status === "VALIDEE_PAIEMENT_REQUIS");
    const completed = withStatus.filter((item) => item.status === "SEJOUR_PAYE").length;
    const totalPaid = reservations.reduce(
      (sum, reservation) =>
        sum + successfulPayments(reservation).reduce((acc, payment) => acc + Number(payment.amount || 0), 0),
      0
    );
    const nights = withStatus
      .filter((item) => item.status === "SEJOUR_PAYE" || item.status === "CONFIRMEE")
      .reduce((sum, item) => sum + countNights(item.reservation.check_in, item.reservation.check_out), 0);

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const next = active
      .filter((item) => (parseDay(item.reservation.check_out)?.getTime() ?? 0) >= today.getTime())
      .sort(
        (a, b) =>
          (parseDay(a.reservation.check_in)?.getTime() ?? 0) - (parseDay(b.reservation.check_in)?.getTime() ?? 0)
      )[0];

    return { active, toPay, completed, totalPaid, nights, next };
  }, [reservations]);

  if (!user) return null;

  const clientNumber = `LM-${String(user.id).padStart(5, "0")}`;
  const memberSince = formatDay(user.created_at, { month: "long", year: "numeric" });

  return (
    <div className="space-y-8">
      <motion.h1
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="text-balance pt-2 text-center font-display text-[clamp(1.6rem,3.6vw,2.5rem)] font-semibold leading-tight tracking-[-0.02em] text-gradient-gold"
      >
        Bienvenue sur votre Espace Client du Manoir
      </motion.h1>

      <EmailVerificationBanner user={user} />

      {/* Cartes d'identité */}
      <div className="grid gap-4 sm:grid-cols-3">
        <IdentityCard icon={UserRound} label="Nom" value={user.name} />
        <IdentityCard icon={Hash} label="N° client" value={clientNumber} />
        <IdentityCard icon={CalendarDays} label="Membre depuis" value={memberSince} />
      </div>

      {/* Action requise */}
      {summary.toPay.map(({ reservation }) => (
        <motion.div
          key={reservation.id}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex flex-col gap-4 rounded-2xl border border-gold/40 bg-gold/10 p-5 sm:flex-row sm:items-center sm:justify-between"
        >
          <div className="flex gap-3">
            <AlertCircle className="mt-0.5 shrink-0 text-gold-light" size={22} />
            <div>
              <p className="font-semibold text-cream">Acompte à régler : {reservationTitle(reservation)}</p>
              <p className="mt-1 text-sm text-cream/65">
                Séjour du {formatDay(reservation.check_in)} au {formatDay(reservation.check_out)}.
                {reservation.payment_deadline &&
                  ` Appartement retenu jusqu'au ${new Date(reservation.payment_deadline).toLocaleString("fr-FR", {
                    day: "numeric",
                    month: "short",
                    hour: "2-digit",
                    minute: "2-digit"
                  })}.`}
              </p>
            </div>
          </div>
          <Link
            href={`/espace-client/reservations?payer=${reservation.id}`}
            className="inline-flex shrink-0 items-center justify-center gap-2 rounded-full bg-gradient-to-br from-gold-light to-gold px-5 py-3 text-sm font-bold text-night transition hover:brightness-105"
          >
            Payer {formatCurrency(reservation.deposit_amount ?? reservation.total_price)}
            <ArrowRight size={16} />
          </Link>
        </motion.div>
      ))}

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
        {/* Informations — façon « annonces » */}
        <section className="glass-warm glass-edge rounded-3xl p-6 sm:p-8">
          <div className="space-y-7 text-[15px] leading-7 text-cream/75">
            <InfoBlock index={1} title="Réservations">
              {loading ? (
                <span className="inline-block h-4 w-64 animate-pulse rounded bg-white/10" />
              ) : summary.active.length > 0 ? (
                <>
                  Vous avez <strong className="text-cream">{summary.active.length} réservation(s) en cours</strong>.
                  Suivez leur avancement, téléchargez vos bons et gérez vos dates{" "}
                  <InlineLink href="/espace-client/reservations">ici</InlineLink>.
                </>
              ) : (
                <>
                  Vous n'avez aucune réservation en cours. Découvrez nos appartements et choisissez vos dates{" "}
                  <InlineLink href="/rooms">ici</InlineLink>.
                </>
              )}
            </InfoBlock>

            <InfoBlock index={2} title="Paiements">
              L'acompte se règle en ligne par Mobile Money ou carte bancaire, le solde au plus tard à
              votre arrivée. Retrouvez tous vos règlements{" "}
              <InlineLink href="/espace-client/paiements">ici</InlineLink>.
            </InfoBlock>

            <InfoBlock index={3} title="Documents de séjour">
              Bons de réservation, bons de séjour et factures sont disponibles en téléchargement dès
              que chaque étape est franchie, depuis la page{" "}
              <InlineLink href="/espace-client/paiements">Paiements & factures</InlineLink>.
            </InfoBlock>

            <InfoBlock index={4} title="Prolongation et annulation">
              Un séjour confirmé peut être prolongé pendant votre présence, ou annulé jusqu'au jour
              de l'arrivée. Le montant remboursable est calculé automatiquement avant validation.
            </InfoBlock>

            <InfoBlock index={5} title="Besoin d'aide ?">
              Notre équipe vous répond par e-mail à{" "}
              <a href={contactMailto("Question | Espace client")} className="font-semibold text-gold-light underline underline-offset-4">
                {CONTACT_EMAIL}
              </a>
              .
            </InfoBlock>
          </div>
        </section>

        {/* Colonne latérale : prochain séjour + chiffres */}
        <div className="space-y-6">
          <NextStayCard loading={loading} next={summary.next} />

          <div className="glass-warm glass-edge grid grid-cols-1 divide-y divide-gold/15 rounded-3xl py-2">
            <Stat icon={BadgeCheck} value={loading ? "…" : String(summary.completed)} label="Séjours effectués" />
            <Stat icon={Moon} value={loading ? "…" : String(summary.nights)} label="Nuits réservées" />
            <Stat icon={Wallet} value={loading ? "…" : formatCurrency(summary.totalPaid)} label="Total réglé" />
          </div>
        </div>
      </div>
    </div>
  );
}

function IdentityCard({
  icon: Icon,
  label,
  value
}: {
  icon: ComponentType<{ size?: number; className?: string }>;
  label: string;
  value: string;
}) {
  return (
    <div className="glass-warm glass-edge flex items-center justify-between gap-3 rounded-2xl px-4 py-3.5 sm:flex-col sm:justify-center sm:px-5 sm:py-6 sm:text-center">
      <div className="flex shrink-0 items-center gap-3">
        <span className="grid size-10 place-items-center rounded-xl bg-gold/15 text-gold-light">
          <Icon size={20} />
        </span>
        <span className="text-[15px] font-bold text-cream sm:text-[17px]">{label} :</span>
      </div>
      <p className="min-w-0 truncate text-right text-[15px] text-cream/80 sm:w-full sm:text-center sm:text-[17px]" title={value}>
        {value}
      </p>
    </div>
  );
}

function InfoBlock({ index, title, children }: { index: number; title: string; children: ReactNode }) {
  return (
    <div>
      <h2 className="mb-1.5 text-[17px] font-bold text-cream">
        {index}-{title}
      </h2>
      <p>{children}</p>
    </div>
  );
}

function InlineLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <Link href={href} className="font-semibold text-gold-light underline underline-offset-4 hover:text-gold">
      {children}
    </Link>
  );
}

function Stat({
  icon: Icon,
  value,
  label
}: {
  icon: ComponentType<{ size?: number; className?: string }>;
  value: string;
  label: string;
}) {
  return (
    <div className="flex items-center gap-4 px-5 py-3.5 text-left sm:px-6 sm:py-4">
      <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-gold/15 text-gold-light">
        <Icon size={18} />
      </span>
      <div className="min-w-0">
        <p className="truncate font-display text-lg font-semibold text-cream sm:text-xl">{value}</p>
        <p className="text-[11px] uppercase tracking-[0.14em] text-cream/50">{label}</p>
      </div>
    </div>
  );
}

function NextStayCard({
  loading,
  next
}: {
  loading: boolean;
  next?: { reservation: Reservation; status: Reservation["status"] };
}) {
  if (loading) {
    return <div className="glass-warm h-64 animate-pulse rounded-3xl" />;
  }

  if (!next) {
    return (
      <div className="glass-warm glass-edge rounded-3xl p-6 text-center">
        <p className="eyebrow">Prochain séjour</p>
        <p className="mt-3 text-sm leading-6 text-cream/65">Aucun séjour à venir pour le moment.</p>
        <Link
          href="/rooms"
          className="mt-5 inline-flex items-center gap-2 rounded-full bg-gradient-to-br from-gold-light to-gold px-5 py-2.5 text-sm font-bold text-night transition hover:brightness-105"
        >
          Voir nos appartements <ArrowRight size={15} />
        </Link>
      </div>
    );
  }

  const { reservation, status } = next;
  const arrival = parseDay(reservation.check_in);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const daysLeft = arrival ? Math.round((arrival.getTime() - today.getTime()) / 86_400_000) : null;
  const image = reservation.room?.images?.[0] || "/assets/rooms/room1.jpg";

  return (
    <Link
      href="/espace-client/reservations"
      className="on-dark group relative block overflow-hidden rounded-3xl"
    >
      <div className="relative h-64">
        <Image src={image} alt="" fill sizes="340px" className="object-cover transition duration-700 group-hover:scale-105" />
        <div className="absolute inset-0 bg-gradient-to-t from-night via-night/60 to-night/10" />
      </div>
      <div className="absolute inset-x-0 bottom-0 p-5">
        <div className="flex items-center justify-between gap-2">
          <span className="eyebrow">Prochain séjour</span>
          <span className={cn("rounded-full border px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider", statusTone(status))}>
            {statusLabels[status]}
          </span>
        </div>
        <p className="mt-2 font-display text-xl font-semibold leading-tight text-cream">{reservationTitle(reservation)}</p>
        <p className="mt-1 text-sm text-cream/75">
          {formatDay(reservation.check_in)} → {formatDay(reservation.check_out)}
        </p>
        {daysLeft !== null && (
          <p className="mt-3 text-sm font-semibold text-gold-light">
            {daysLeft > 1 ? `Arrivée dans ${daysLeft} jours` : daysLeft === 1 ? "Arrivée demain" : daysLeft === 0 ? "Arrivée aujourd'hui" : "Séjour en cours"}
          </p>
        )}
      </div>
    </Link>
  );
}
