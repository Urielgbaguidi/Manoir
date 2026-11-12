import type {
  Payment,
  Reservation,
  ReservationStatus,
  StayExtension,
  StayExtensionStatus,
  StayVoucher
} from "@/lib/api";

export const categoryLabels: Record<string, string> = {
  vip: "Appartement VIP",
  deux_chambres: "Appartement 2 Chambres",
  une_chambre: "Appartement 1 Chambre"
};

export const statusLabels: Record<ReservationStatus, string> = {
  EN_ATTENTE: "En attente de validation",
  VALIDEE_PAIEMENT_REQUIS: "Paiement à effectuer",
  CONFIRMEE: "Confirmée (acompte versé)",
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

export const extensionStatusLabels: Record<StayExtensionStatus, string> = {
  EN_ATTENTE: "En attente de validation",
  VALIDEE_PAIEMENT_REQUIS: "Paiement à effectuer",
  PAYEE: "Payée",
  REFUSEE: "Refusée",
  EXPIREE: "Délai expiré"
};

export function extensionStatusTone(status: StayExtensionStatus): string {
  switch (status) {
    case "EN_ATTENTE":
    case "VALIDEE_PAIEMENT_REQUIS":
      return "border-gold/40 bg-gold/15 text-gold-light";
    case "PAYEE":
      return "border-olive/40 bg-olive/15 text-olive-light";
    default:
      return "border-terracotta/40 bg-terracotta/15 text-terracotta-light";
  }
}

/** Statuts « en cours » hors séjour payé (voir `isActiveReservation`). */
export const ACTIVE_STATUSES: ReservationStatus[] = [
  "EN_ATTENTE",
  "VALIDEE_PAIEMENT_REQUIS",
  "CONFIRMEE"
];

/** Séjour réglé : intégralement (nouveau parcours) ou par acompte (ancien parcours). */
export const isPaidStatus = (status: ReservationStatus) =>
  status === "SEJOUR_PAYE" || status === "CONFIRMEE";

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
  parseDay(value)?.toLocaleDateString(
    "fr-FR",
    options ?? { day: "numeric", month: "short", year: "numeric" }
  ) || "Date à préciser";

/** Date courte jj/mm/aa (ex. 12/11/26). */
export const formatShortDay = (value?: string | null) =>
  parseDay(value)?.toLocaleDateString("fr-FR", {
    day: "2-digit",
    month: "2-digit",
    year: "2-digit"
  }) || "—";

/** Période de séjour : « 12/11/26 au 12/12/26 ». */
export const formatStayPeriod = (reservation: Pick<Reservation, "check_in" | "check_out">) =>
  `${formatShortDay(reservation.check_in)} au ${formatShortDay(reservation.check_out)}`;

/**
 * Référence lisible d'une réservation : « MN » + jour, mois et année (2
 * chiffres) de la demande. Ex. demande du 12/11/2026 → MN121126.
 */
export function reservationRef(reservation: Pick<Reservation, "created_at">): string {
  const date = new Date(reservation.created_at);
  if (Number.isNaN(date.getTime())) return "MN";
  const pad = (value: number) => String(value).padStart(2, "0");
  return `MN${pad(date.getDate())}${pad(date.getMonth() + 1)}${pad(date.getFullYear() % 100)}`;
}

export const formatDateTime = (value?: string | null) => {
  if (!value) return "Date à préciser";
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? "Date à préciser"
    : date.toLocaleString("fr-FR", {
        day: "numeric",
        month: "short",
        hour: "2-digit",
        minute: "2-digit"
      });
};

export const countNights = (checkIn: string, checkOut: string) => {
  const start = parseDay(checkIn);
  const end = parseDay(checkOut);
  if (!start || !end) return 0;
  return Math.max(1, Math.round((end.getTime() - start.getTime()) / 86_400_000));
};

/** Date locale du jour au format AAAA-MM-JJ. */
export const todayIso = (nowMs = Date.now()) => {
  const now = new Date(nowMs);
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
};

export const addDaysIso = (value: string, days: number) => {
  const date = parseDay(value);
  if (!date) return "";
  date.setDate(date.getDate() + days);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
};

/** Statut affiché : un paiement dont le délai est dépassé est considéré expiré. */
export function effectiveStatus(reservation: Reservation, nowMs = Date.now()): ReservationStatus {
  if (reservation.status !== "VALIDEE_PAIEMENT_REQUIS") return reservation.status;

  const deadline = reservation.payment_deadline
    ? new Date(reservation.payment_deadline).getTime()
    : NaN;
  const arrival = parseDay(reservation.check_in);
  const today = new Date(nowMs);
  today.setHours(0, 0, 0, 0);

  const deadlinePassed = !Number.isNaN(deadline) && deadline <= nowMs;
  const arrivalPassed = arrival ? arrival.getTime() < today.getTime() : false;
  return deadlinePassed || arrivalPassed ? "EXPIREE" : reservation.status;
}

/**
 * Réservation « en cours » : demande à l'étude, paiement attendu, ou séjour
 * payé qui n'est pas encore terminé (il peut encore être prolongé).
 */
export function isActiveReservation(reservation: Reservation, nowMs = Date.now()): boolean {
  const status = effectiveStatus(reservation, nowMs);
  if (status === "EN_ATTENTE" || status === "VALIDEE_PAIEMENT_REQUIS") return true;
  if (isPaidStatus(status)) return reservation.check_out.slice(0, 10) >= todayIso(nowMs);
  return false;
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

/** Montant du séjour (prolongations payées comprises). */
export const stayAmountOf = (reservation: Reservation) =>
  Number(reservation.stay_amount ?? reservation.total_price ?? 0);

export const successfulPayments = (reservation: Reservation): Payment[] =>
  (reservation.payments || []).filter((payment) => payment.status === "success");

export function paymentLabel(payment: Payment): string {
  switch (payment.payment_type) {
    case "stay":
      return "Paiement du séjour";
    case "extension":
      return "Prolongation de séjour";
    default:
      return "Acompte de réservation";
  }
}

const channelLabels: Record<string, string> = {
  mtn: "MTN Mobile Money",
  moov: "Moov Money",
  celtiis: "Celtiis Cash",
  celtiis_bj: "Celtiis Cash",
  orange: "Orange Money",
  wave: "Wave",
  togocom: "Mixx by Yas",
  free: "Free Money",
  bmo: "B-MO",
  coris: "Coris Money",
  card: "Carte bancaire"
};

/**
 * Moyen de paiement réellement utilisé (MTN, Moov, carte…), tel que
 * renvoyé par l'API. « Mobile Money » seulement si l'opérateur est inconnu.
 */
export function paymentMethodLabel(payment: Payment): string {
  if (payment.channel && channelLabels[payment.channel]) return channelLabels[payment.channel];
  if (payment.payment_method === "card") return "Carte bancaire";
  return "Mobile Money";
}

/* --------------------------------- Bons de Séjour --------------------------------- */

export const reservationVouchers = (reservation: Reservation): StayVoucher[] =>
  [...(reservation.vouchers || [])].sort(
    (a, b) => new Date(a.issued_at).getTime() - new Date(b.issued_at).getTime()
  );

export function voucherLabel(voucher: StayVoucher): string {
  return voucher.stay_extension_id ? "Bon de Séjour · prolongation" : "Bon de Séjour";
}

/** Bon émis pour une prolongation donnée. */
export const extensionVoucher = (
  reservation: Reservation,
  extension: StayExtension
): StayVoucher | null =>
  extension.voucher ??
  reservation.vouchers?.find((voucher) => voucher.stay_extension_id === extension.id) ??
  null;

/** Enregistre un fichier téléchargé (PDF) sur l'appareil du client. */
export function saveBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/* ------------------------- Documents de l'ancien parcours ------------------------- */

export type DocumentKind = "booking" | "deposit" | "stay-voucher" | "stay" | "cancellation";

export const documentLabels: Record<DocumentKind, string> = {
  booking: "Bon de réservation",
  deposit: "Facture d'acompte",
  "stay-voucher": "Bon du séjour",
  stay: "Facture du séjour",
  cancellation: "Bon d'annulation"
};

/**
 * Documents « historiques » consultables via la page facture. Le Bon de Séjour
 * du nouveau parcours n'en fait pas partie : il est servi par `vouchers`.
 */
export function availableDocuments(reservation: Reservation): DocumentKind[] {
  const docs: DocumentKind[] = [];
  const payments = successfulPayments(reservation);
  const hasVoucher = (reservation.vouchers?.length ?? 0) > 0;
  const hasDeposit = Boolean(
    reservation.deposit_invoice_number ||
    payments.some((payment) => payment.payment_type === "deposit")
  );
  const hasStayInvoice = Boolean(
    reservation.stay_invoice_number || payments.some((payment) => payment.payment_type === "stay")
  );

  if (hasDeposit) docs.push("deposit");
  if (hasStayInvoice && !hasVoucher) docs.push("stay");
  if (reservation.status === "ANNULEE" || reservation.status === "REMBOURSEE")
    docs.push("cancellation");
  return docs;
}

export const documentHref = (reservation: Reservation, kind: DocumentKind) =>
  `/reservations/invoice?id=${reservation.id}&type=${kind}`;

/** Lien vers le détail d'une réservation dans l'espace client. */
export const reservationHref = (reservationId: number | string) =>
  `/espace-client/reservations?reservation=${reservationId}`;
