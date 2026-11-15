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
  LIBEREE: "Séjour terminé"
};

/**
 * Couleur de statut (palette Bootstrap, classes `status-*` de globals.css) :
 * vert = confirmé / payé, jaune = en attente (validation ou paiement),
 * rouge = refusé / annulé, gris = clos (expiré, remboursé, terminé).
 */
const cnBorderless = (className: string) => `${className} border-transparent`;

export type StatusColor = "success" | "warning" | "error" | "info" | "neutral";

export const reservationStatusColor: Record<ReservationStatus, StatusColor> = {
  EN_ATTENTE: "warning",
  VALIDEE_PAIEMENT_REQUIS: "warning",
  CONFIRMEE: "success",
  SEJOUR_PAYE: "success",
  REFUSEE: "error",
  ANNULEE: "error",
  EXPIREE: "neutral",
  REMBOURSEE: "neutral",
  LIBEREE: "neutral"
};

export const extensionStatusColor: Record<StayExtensionStatus, StatusColor> = {
  EN_ATTENTE: "warning",
  VALIDEE_PAIEMENT_REQUIS: "warning",
  PAYEE: "success",
  REFUSEE: "error",
  EXPIREE: "neutral"
};

const statusColorClass: Record<StatusColor, string> = {
  success: "status-success",
  warning: "status-warning",
  error: "status-danger",
  info: "status-info",
  neutral: "status-neutral"
};

/** Classes de pastille par statut de réservation. */
export function statusTone(status: ReservationStatus): string {
  return cnBorderless(statusColorClass[reservationStatusColor[status] ?? "neutral"]);
}

export const extensionStatusLabels: Record<StayExtensionStatus, string> = {
  EN_ATTENTE: "En attente de validation",
  VALIDEE_PAIEMENT_REQUIS: "Paiement à effectuer",
  PAYEE: "Payée",
  REFUSEE: "Refusée",
  EXPIREE: "Délai expiré"
};

export function extensionStatusTone(status: StayExtensionStatus): string {
  return cnBorderless(statusColorClass[extensionStatusColor[status] ?? "neutral"]);
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

const pad2 = (value: number) => String(value).padStart(2, "0");

/**
 * Référence lisible d'une réservation : « MN » + jour, mois et année (2
 * chiffres) de la demande. Ex. demande du 12/11/2026 → MN121126.
 */
export function reservationRef(reservation: Pick<Reservation, "created_at">): string {
  const date = new Date(reservation.created_at);
  if (Number.isNaN(date.getTime())) return "MN";
  return `MN${pad2(date.getDate())}${pad2(date.getMonth() + 1)}${pad2(date.getFullYear() % 100)}`;
}

/**
 * Jour de demande (AAAA-MM-JJ) désigné par une référence saisie dans une
 * recherche (« MN121126 », « mn 121126 »), ou null si le texte n'en est pas une.
 * L'API ne connaît pas ces références : les tableaux les traduisent en filtre
 * sur la date de la demande.
 */
export function reservationRefDay(text: string): string | null {
  const match = /^MN\s*(\d{2})(\d{2})(\d{2})$/i.exec(text.trim());
  if (!match) return null;
  const [, day, month, shortYear] = match;
  const year = 2000 + Number(shortYear);
  const date = new Date(year, Number(month) - 1, Number(day));
  if (date.getMonth() !== Number(month) - 1 || date.getDate() !== Number(day)) return null;
  return `${year}-${month}-${day}`;
}

/** Date et heure locales : « 13/11/2026 à 16:18 ». */
export const formatDateTime = (value?: string | null, fallback = "Date à préciser") => {
  if (!value) return fallback;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return fallback;
  return `${pad2(date.getDate())}/${pad2(date.getMonth() + 1)}/${date.getFullYear()} à ${pad2(date.getHours())}:${pad2(date.getMinutes())}`;
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
  airtel: "Airtel Money",
  vodafone: "Vodafone Cash",
  card: "Carte bancaire"
};

/**
 * Canal de paiement réellement utilisé (MTN, Moov, carte…), tel que
 * renvoyé par l'API. « — » tant qu'il n'est pas connu (paiement non abouti).
 */
export function paymentMethodLabel(payment: Payment): string {
  if (payment.channel && channelLabels[payment.channel]) return channelLabels[payment.channel];
  if (payment.payment_method === "card") return "Carte bancaire";
  return "—";
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
