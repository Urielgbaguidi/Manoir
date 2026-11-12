"use client";

import { motion } from "framer-motion";
import { AlertCircle, ArrowRight, CalendarCheck2, FileText, Wallet } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState, type ComponentType, type ReactNode } from "react";
import EmailVerificationBanner from "@/components/ui/EmailVerificationBanner";
import { useAuth } from "@/context/AuthContext";
import { useToast } from "@/context/ToastContext";
import { api, type Reservation } from "@/lib/api";
import {
  availableDocuments,
  effectiveStatus,
  formatCurrency,
  formatDateTime,
  formatDay,
  isActiveReservation,
  parseDay,
  reservationHref,
  reservationTitle,
  stayAmountOf,
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

  // Anciens liens « /espace-client?payer=ID » : on renvoie vers le détail
  // de la réservation, où se trouve le paiement.
  useEffect(() => {
    const payer = new URLSearchParams(window.location.search).get("payer");
    if (payer) router.replace(reservationHref(encodeURIComponent(payer)));
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
    const active = withStatus.filter((item) => isActiveReservation(item.reservation, now));
    const toPay = active.filter((item) => item.status === "VALIDEE_PAIEMENT_REQUIS");
    const awaiting = active.filter((item) => item.status === "EN_ATTENTE");
    const totalPaid = reservations.reduce(
      (sum, reservation) =>
        sum +
        successfulPayments(reservation).reduce(
          (acc, payment) => acc + Number(payment.amount || 0),
          0
        ),
      0
    );
    const paymentsCount = reservations.reduce(
      (sum, reservation) => sum + successfulPayments(reservation).length,
      0
    );
    // Documents de paiement : Bons de Séjour émis + factures de l'ancien
    // parcours (acompte, séjour).
    const vouchers = reservations.reduce(
      (sum, reservation) => sum + (reservation.vouchers?.length ?? 0),
      0
    );
    const legacyInvoices = reservations
      .flatMap((reservation) => availableDocuments(reservation))
      .filter((kind) => kind === "deposit" || kind === "stay").length;

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const next = active
      .filter((item) => (parseDay(item.reservation.check_out)?.getTime() ?? 0) >= today.getTime())
      .sort(
        (a, b) =>
          (parseDay(a.reservation.check_in)?.getTime() ?? 0) -
          (parseDay(b.reservation.check_in)?.getTime() ?? 0)
      )[0];

    return {
      active,
      toPay,
      awaiting,
      totalPaid,
      paymentsCount,
      vouchers,
      legacyInvoices,
      bookings: reservations.length,
      next
    };
  }, [reservations]);

  if (!user) return null;

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

      {/* Chiffres clés : icône à gauche, puis libellé, chiffre et détail. */}
      <div className="grid gap-4 md:grid-cols-3">
        <StatCard
          icon={FileText}
          tone="gold"
          label="Bons de Séjour"
          value={loading ? "…" : String(summary.vouchers)}
          detail={
            loading
              ? "Chargement…"
              : summary.legacyInvoices > 0
                ? `+ ${summary.legacyInvoices} facture${summary.legacyInvoices > 1 ? "s" : ""} (ancien parcours)`
                : "Émis après chaque paiement"
          }
          href="/espace-client/factures"
        />
        <StatCard
          icon={Wallet}
          tone="olive"
          label="Total réglé (FCFA)"
          value={loading ? "…" : Number(summary.totalPaid || 0).toLocaleString("fr-FR")}
          detail={
            loading
              ? "Chargement…"
              : `${summary.paymentsCount} paiement${summary.paymentsCount > 1 ? "s" : ""} réussi${summary.paymentsCount > 1 ? "s" : ""}`
          }
          href="/espace-client/paiements"
        />
        <StatCard
          icon={CalendarCheck2}
          tone="terracotta"
          label="Réservations effectuées"
          value={loading ? "…" : String(summary.bookings)}
          detail={
            loading
              ? "Chargement…"
              : `${summary.active.length} en cours${summary.awaiting.length ? ` · ${summary.awaiting.length} en attente de validation` : ""}`
          }
          href="/espace-client/reservations"
        />
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
              <p className="font-semibold text-cream">
                Demande validée · paiement à effectuer : {reservationTitle(reservation)}
              </p>
              <p className="mt-1 text-sm text-cream/65">
                Séjour du {formatDay(reservation.check_in)} au {formatDay(reservation.check_out)}.
                {reservation.payment_deadline &&
                  ` À régler avant le ${formatDateTime(reservation.payment_deadline)}.`}
              </p>
            </div>
          </div>
          <Link
            href={reservationHref(reservation.id)}
            className="inline-flex shrink-0 items-center justify-center gap-2 rounded-full bg-gradient-to-br from-gold-light to-gold px-5 py-3 text-sm font-bold text-night transition hover:brightness-105"
          >
            Payer {formatCurrency(stayAmountOf(reservation))}
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
                  Vous avez{" "}
                  <strong className="text-cream">
                    {summary.active.length} réservation(s) en cours
                  </strong>
                  . Suivez leur avancement étape par étape, réglez votre séjour et téléchargez vos
                  Bons de Séjour <InlineLink href="/espace-client/reservations">ici</InlineLink>.
                </>
              ) : (
                <>
                  Vous n'avez aucune réservation en cours. Découvrez nos appartements et choisissez
                  vos dates <InlineLink href="/rooms">ici</InlineLink>.
                </>
              )}
            </InfoBlock>

            <InfoBlock index={2} title="Paiements">
              Votre demande est gratuite. Une fois validée par notre équipe (vous êtes prévenu par
              e-mail), vous réglez le séjour complet en ligne par Mobile Money ou carte bancaire.
              Retrouvez tous vos règlements{" "}
              <InlineLink href="/espace-client/paiements">ici</InlineLink>.
            </InfoBlock>

            <InfoBlock index={3} title="Documents de séjour">
              Votre Bon de Séjour est émis dès que le paiement est confirmé, et un nouveau bon pour
              chaque prolongation payée. Retrouvez-les sur votre réservation ou depuis la page{" "}
              <InlineLink href="/espace-client/factures">Factures</InlineLink>.
            </InfoBlock>

            <InfoBlock index={4} title="Prolongation et annulation">
              Pendant un séjour payé, après au moins une nuit sur place, vous pouvez demander une
              prolongation : elle est validée par notre équipe puis réglée en ligne. Une demande pas
              encore payée peut être annulée sans frais jusqu'au jour de l'arrivée.
            </InfoBlock>

            <InfoBlock index={5} title="Besoin d'aide ?">
              Notre équipe vous répond par e-mail à{" "}
              <a
                href={contactMailto("Question | Espace client")}
                className="font-semibold text-gold-light underline underline-offset-4"
              >
                {CONTACT_EMAIL}
              </a>
              .
            </InfoBlock>
          </div>
        </section>

        {/* Colonne latérale : prochain séjour */}
        <div>
          <NextStayCard loading={loading} next={summary.next} />
        </div>
      </div>
    </div>
  );
}

const statTones = {
  gold: "bg-gold/15 text-gold-light",
  olive: "bg-olive/15 text-olive-light",
  terracotta: "bg-terracotta/15 text-terracotta-light"
} as const;

/** Carte de stat : icône carrée colorée à gauche ; libellé, chiffre et détail empilés à droite. */
function StatCard({
  icon: Icon,
  tone,
  label,
  value,
  detail,
  href
}: {
  icon: ComponentType<{ size?: number; className?: string }>;
  tone: keyof typeof statTones;
  label: string;
  value: string;
  detail: string;
  href: string;
}) {
  return (
    <Link
      href={href}
      className="glass-warm glass-edge flex items-start gap-4 rounded-3xl p-5 lg:p-4 xl:p-6"
    >
      <span className={cn("grid size-12 shrink-0 place-items-center rounded-2xl", statTones[tone])}>
        <Icon size={22} />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-[12px] font-semibold uppercase leading-4 tracking-[0.08em] text-cream/60">
          {label}
        </p>
        <p
          className="mt-1.5 whitespace-nowrap font-display text-[1.75rem] font-bold leading-none text-cream md:text-xl xl:text-[1.75rem]"
          title={value}
        >
          {value}
        </p>
        <p className="mt-2 text-[13px] leading-5 text-cream/55">{detail}</p>
      </div>
    </Link>
  );
}

function InfoBlock({
  index,
  title,
  children
}: {
  index: number;
  title: string;
  children: ReactNode;
}) {
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
    <Link
      href={href}
      className="font-semibold text-gold-light underline underline-offset-4 hover:text-gold"
    >
      {children}
    </Link>
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
      href={reservationHref(reservation.id)}
      className="on-dark group relative block overflow-hidden rounded-3xl"
    >
      <div className="relative h-64">
        <Image
          src={image}
          alt=""
          fill
          sizes="340px"
          className="object-cover transition duration-700 group-hover:scale-105"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-night via-night/60 to-night/10" />
      </div>
      <div className="absolute inset-x-0 bottom-0 p-5">
        <div className="flex items-center justify-between gap-2">
          <span className="eyebrow">Prochain séjour</span>
          <span
            className={cn(
              "rounded-full border px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider",
              statusTone(status)
            )}
          >
            {statusLabels[status]}
          </span>
        </div>
        <p className="mt-2 font-display text-xl font-semibold leading-tight text-cream">
          {reservationTitle(reservation)}
        </p>
        <p className="mt-1 text-sm text-cream/75">
          {formatDay(reservation.check_in)} → {formatDay(reservation.check_out)}
        </p>
        {daysLeft !== null && (
          <p className="mt-3 text-sm font-semibold text-gold-light">
            {daysLeft > 1
              ? `Arrivée dans ${daysLeft} jours`
              : daysLeft === 1
                ? "Arrivée demain"
                : daysLeft === 0
                  ? "Arrivée aujourd'hui"
                  : "Séjour en cours"}
          </p>
        )}
      </div>
    </Link>
  );
}
