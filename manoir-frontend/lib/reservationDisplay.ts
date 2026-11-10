import type { Payment, Reservation, ReservationStatus } from "@/lib/api";

export const categoryLabels: Record<string, string> = {
  vip: "Appartement VIP",
  deux_chambres: "Appartement 2 Chambres",
  une_chambre: "Appartement 1 Chambre"
};

export const statusLabels: Record<ReservationStatus, string> = {
  EN_ATTENTE: "En cours d'examen",
  VALIDEE_PAIEMENT_REQUIS: "Acompte à régler",
  CONFIRMEE: "Confirmée",
  REFUSEE: "Refusée",
  EXPIREE: "Délai expiré",
  SEJOUR_PAYE: "Séjour payé",
  ANNULEE: "Annulée",
  REMBOURSEE: "Remboursée",
  LIBEREE: "Appartement libéré"
};

/** Classes de pastille par statut (compatibles thèmes clair et sombre). */
export function statusTone(status: ReservationStatus): string {
  switch (status) {
    case "VALIDEE_PAIEMENT_REQUIS":
    case "EN_ATTENTE":
      return "border-gold/40 bg-gold/15 text-gold-light";
    case "CONFIRMEE":
    case "SEJOUR_PAYE":
      return "border-olive/40 bg-olive/15 text-olive-light";
    case "REMBOURSEE":
    case "LIBEREE":
      return "border-gold/20 bg-white/5 text-cream/70";
    default:
      return "border-terracotta/40 bg-terracotta/15 text-terracotta-light";
  }
}

export const ACTIVE_STATUSES: ReservationStatus[] = ["EN_ATTENTE", "VALIDEE_PAIEMENT_REQUIS", "CONFIRMEE"];

export const formatCurrency = (value = 0) => `${Number(value || 0).toLocaleString("fr-FR")} FCFA`;

export const parseDay = (value?: string | null) => {
  if (!value) return null;
  const datePart = value.slice(0, 10);
  if (/^\d{4}-\d{2}-\d{2}$/.test(datePart)) {
    const [year, month, day] = datePart.split("-").map(Number);
    return new Date(year, month - 1, day);
  }
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
};

export const formatDay = (value?: string | null, options?: Intl.DateTimeFormatOptions) =>
  parseDay(value)?.toLocaleDateString("fr-FR", options ?? { day: "numeric", month: "short", year: "numeric" }) ||
  "Date à préciser";

export const countNights = (checkIn: string, checkOut: string) => {
  const start = parseDay(checkIn);
  const end = parseDay(checkOut);
  if (!start || !end) return 0;
  return Math.max(1, Math.round((end.getTime() - start.getTime()) / 86_400_000));
};

/** Statut affiché : un acompte dont le délai est dépassé est considéré expiré. */
export function effectiveStatus(reservation: Reservation, nowMs = Date.now()): ReservationStatus {
  if (reservation.status !== "VALIDEE_PAIEMENT_REQUIS") return reservation.status;

  const deadline = reservation.payment_deadline ? new Date(reservation.payment_deadline).getTime() : NaN;
  const arrival = parseDay(reservation.check_in);
  const today = new Date(nowMs);
  today.setHours(0, 0, 0, 0);

  const deadlinePassed = !Number.isNaN(deadline) && deadline <= nowMs;
  const arrivalPassed = arrival ? arrival.getTime() < today.getTime() : false;
  return deadlinePassed || arrivalPassed ? "EXPIREE" : reservation.status;
}

export function reservationTitle(reservation: Reservation): string {
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
    return `Appartement N°${room.apartment_number} · ${label}`;
  }
  return categoryLabels[reservation.category_type || ""] || room?.name || "Appartement";
}

export const successfulPayments = (reservation: Reservation): Payment[] =>
  (reservation.payments || []).filter((payment) => payment.status === "success");

export function paymentLabel(payment: Payment): string {
  return payment.payment_type === "stay" ? "Solde du séjour" : "Acompte de réservation";
}

export function paymentMethodLabel(payment: Payment): string {
  const method = payment.payment_method === "card" ? "Carte bancaire" : "Mobile Money";
  const provider = payment.provider === "kkiapay" ? "KKiaPay" : "FedaPay";
  return `${method} · ${provider}`;
}

export type DocumentKind = "booking" | "deposit" | "stay-voucher" | "stay" | "cancellation";

export const documentLabels: Record<DocumentKind, string> = {
  booking: "Bon de réservation",
  deposit: "Facture d'acompte",
  "stay-voucher": "Bon du séjour",
  stay: "Facture du séjour",
  cancellation: "Bon d'annulation"
};

/** Documents consultables pour une réservation, selon son avancement. */
export function availableDocuments(reservation: Reservation): DocumentKind[] {
  const docs: DocumentKind[] = [];
  const payments = successfulPayments(reservation);
  const hasDeposit = Boolean(
    reservation.deposit_invoice_number || payments.some((payment) => payment.payment_type === "deposit")
  );
  const hasStay = Boolean(
    reservation.stay_invoice_number || payments.some((payment) => payment.payment_type === "stay")
  );

  if (reservation.status === "VALIDEE_PAIEMENT_REQUIS" && !hasDeposit) docs.push("booking");
  if (hasDeposit) docs.push("deposit");
  if (reservation.status === "CONFIRMEE" && !hasStay) docs.push("stay-voucher");
  if (hasStay) docs.push("stay");
  if (reservation.status === "ANNULEE" || reservation.status === "REMBOURSEE") docs.push("cancellation");
  return docs;
}

export const documentHref = (reservation: Reservation, kind: DocumentKind) =>
  `/reservations/invoice?id=${reservation.id}&type=${kind}`;
