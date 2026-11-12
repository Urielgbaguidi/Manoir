const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api";

/**
 * Nombre d'appels au serveur en cours, observable par l'interface.
 *
 * C'est ce compteur qui permet a la barre de progression de savoir quand une
 * action est reellement terminee. Sans lui, elle devrait deviner une duree :
 * elle s'arreterait trop tot sur les appels lents et trop tard sur les rapides.
 */
type EcouteurActivite = (appelsEnCours: number) => void;

const ecouteursActivite = new Set<EcouteurActivite>();
let appelsEnCours = 0;

function signalerActivite(delta: number): void {
  appelsEnCours = Math.max(0, appelsEnCours + delta);
  ecouteursActivite.forEach((ecouteur) => ecouteur(appelsEnCours));
}

/** S'abonne a l'activite reseau. Renvoie la fonction de desabonnement. */
export function surActiviteReseau(ecouteur: EcouteurActivite): () => void {
  ecouteursActivite.add(ecouteur);
  ecouteur(appelsEnCours);

  return () => {
    ecouteursActivite.delete(ecouteur);
  };
}

export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
    /** Corps JSON complet de l'erreur (reason, errors, payment...). */
    public data: Record<string, unknown> = {}
  ) {
    super(message);
    this.name = "ApiError";
  }

  /** Code metier renvoye par l'API (`email_not_verified`, `phone_required`...). */
  get reason(): string | undefined {
    return typeof this.data.reason === "string" ? this.data.reason : undefined;
  }
}

/**
 * Cle d'idempotence (UUID v4) : une par intention de l'utilisateur, reutilisee
 * telle quelle pour les nouvelles tentatives de la MEME action.
 */
export function newIdempotencyKey(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

type RequestOptions = RequestInit & {
  /** En-tete Idempotency-Key, exige par les routes de creation et de paiement. */
  idempotencyKey?: string;
  /** Ne pas tenter de renouveler la session sur un 401 (routes d'auth). */
  skipRefresh?: boolean;
};

export type ReservationStatus =
  | "EN_ATTENTE"
  | "VALIDEE_PAIEMENT_REQUIS"
  | "CONFIRMEE"
  | "REFUSEE"
  | "EXPIREE"
  | "SEJOUR_PAYE"
  | "ANNULEE"
  | "REMBOURSEE"
  | "LIBEREE";

export type RoomCategoryType = "vip" | "deux_chambres" | "une_chambre";

export interface Room {
  id: number;
  name: string;
  slug: string;
  description: string;
  max_occupants: number;
  apartment_number?: number | null;
  base_price: number;
  deposit?: number;
  type: string;
  images: string[];
  videos?: string[];
  equipments: string[];
  status: string;
  /** Present sur les appartements renvoyes dans une categorie. */
  availability?: RoomAvailability;
  created_at: string;
  updated_at: string;
}

export interface RoomCategory {
  id: number;
  type: RoomCategoryType;
  slug: string;
  label: string;
  rank_label: string;
  short_description: string;
  full_description: string;
  price_per_night: number;
  deposit_per_day: number;
  is_blocked: boolean;
  images: string[];
  videos: string[];
  units?: Room[];
  created_at: string;
  updated_at: string;
}

export interface Reservation {
  id: number;
  user_id: number;
  room_id: number;
  category_type?: RoomCategoryType;
  check_in: string;
  check_out: string;
  guests: number;
  total_price: number;
  deposit_daily_rate?: number;
  deposit_amount?: number;
  stay_amount?: number;
  cancellation_consumed_days?: number;
  cancellation_retained_amount?: number;
  cancellation_refund_amount?: number;
  status: ReservationStatus;
  admin_notes?: string;
  special_requests?: string;
  approved_at?: string;
  payment_deadline?: string;
  paid_at?: string;
  stay_paid_at?: string;
  cancelled_at?: string;
  refunded_at?: string;
  released_at?: string | null;
  released_by_admin_id?: number | null;
  release_notes?: string | null;
  deposit_invoice_number?: string;
  stay_invoice_number?: string;
  cancellation_document_number?: string;
  deposit_invoice_downloaded?: boolean;
  stay_invoice_downloaded?: boolean;
  /** Anciennes colonnes de prolongation (historique) : voir `extensions`. */
  extension_status?: "EN_ATTENTE" | "APPROUVEE" | "REFUSEE" | null;
  extension_previous_check_out?: string | null;
  extension_requested_check_out?: string | null;
  extension_requested_at?: string | null;
  extension_processed_at?: string | null;
  extension_admin_notes?: string | null;
  created_at: string;
  updated_at: string;
  room?: Room;
  user?: User;
  released_by_admin?: User;
  payments?: Payment[];
  notifications?: Notification[];
  /** Demandes de prolongation, de la plus recente a la plus ancienne. */
  extensions?: StayExtension[];
  /** Bons de Sejour emis apres paiement. */
  vouchers?: StayVoucher[];
}

export type StayExtensionStatus =
  "EN_ATTENTE" | "VALIDEE_PAIEMENT_REQUIS" | "PAYEE" | "REFUSEE" | "EXPIREE";

export interface StayExtension {
  id: number;
  reservation_id: number;
  user_id: number;
  previous_check_out: string;
  requested_check_out: string;
  nights: number;
  price_per_night: number;
  amount: number;
  status: StayExtensionStatus;
  admin_notes?: string | null;
  approved_at?: string | null;
  processed_at?: string | null;
  payment_deadline?: string | null;
  paid_at?: string | null;
  created_at: string;
  updated_at: string;
  reservation?: Reservation;
  user?: User;
  payments?: Payment[];
  voucher?: StayVoucher | null;
}

export interface StayVoucher {
  id: number;
  payment_id: number;
  reservation_id: number;
  stay_extension_id: number | null;
  number: string;
  transaction_reference: string;
  amount: number;
  issued_at: string;
}

export interface Payment {
  id: number;
  reservation_id: number;
  stay_extension_id?: number | null;
  payment_method: string;
  provider: string;
  channel?: string | null;
  transaction_id: string;
  provider_reference?: string | null;
  payment_type?: "deposit" | "stay" | "extension";
  invoice_number?: string;
  status: "pending" | "success" | "failed";
  failure_reason?: string | null;
  amount: number;
  paid_at?: string;
  created_at: string;
  updated_at: string;
}

/** Reponse des routes de paiement FeexPay. */
export interface PaymentResult {
  message: string;
  payment: {
    id: number;
    status: "pending" | "success" | "failed";
    provider_status: string | null;
    reservation_id?: number;
    stay_extension_id?: number | null;
    payment_method: string;
    channel: string | null;
    payment_type: "stay" | "extension" | "deposit";
    amount: number;
    reference: string | null;
    failure_reason: string | null;
    paid_at: string | null;
  };
  /** Configuration du checkout FeexPay, presente a la preparation d'un paiement ouvert. */
  checkout?: FeexPayCheckoutConfig | null;
  reservation_status?: ReservationStatus;
  extension_status?: StayExtensionStatus | null;
  voucher: { id: number; number: string } | null;
}

/** Parametres de `FeexPayButton.init` fournis par l'API. */
export interface FeexPayCheckoutConfig {
  sdk_url: string;
  id: string;
  token: string;
  mode: "SANDBOX" | "LIVE";
  amount: number;
  currency: string;
  custom_id: string;
  description: string;
  callback_info: Record<string, unknown>;
  first_name: string;
  email: string;
}

export interface PaymentChannel {
  key: string;
  label: string;
  method: "mobile_money" | "card";
}

/** Pagination Laravel, utilisee par les tableaux de l'administration. */
export interface Paginated<T> {
  data: T[];
  current_page: number;
  last_page: number;
  per_page: number;
  total: number;
  from: number | null;
  to: number | null;
}

/** Parametres communs des tableaux admin (filtrage cote serveur). */
export interface AdminTableQuery {
  page?: number;
  per_page?: number;
  search?: string;
  client?: string;
  /** Un ou plusieurs statuts. */
  status?: string | string[];
  room_id?: number;
  date_from?: string;
  date_to?: string;
  /** `stay` : chevauchement avec le sejour ; `created` : date de la demande. */
  date_field?: "stay" | "created";
  sort?: string;
  direction?: "asc" | "desc";
  is_admin?: boolean;
  category_type?: string;
}

export interface AuthSessionInfo {
  id: string;
  device_name: string;
  ip_address: string | null;
  last_used_at: string | null;
  created_at: string | null;
  current: boolean;
}

/** Resultat d'une connexion : session ouverte, ou code 2FA a saisir. */
export type LoginResult =
  { kind: "session"; user: User } | { kind: "two_factor"; challengeToken: string };

export interface Notification {
  id: number;
  user_id: number;
  reservation_id?: number;
  type: string;
  channel: string;
  status: string;
  content?: string;
  metadata?: Record<string, unknown>;
  sent_at?: string;
  created_at: string;
  updated_at: string;
}

export interface User {
  id: number;
  name: string;
  email: string;
  phone?: string;
  country?: string | null;
  is_admin: boolean;
  is_super_admin: boolean;
  email_verified_at?: string | null;
  /** Faux pour un compte cree via Google sans mot de passe. */
  has_password?: boolean;
  two_factor_enabled?: boolean;
  /** Telephone renseigne, ou compte administrateur (dispense). */
  profile_completed?: boolean;
  reservations_count?: number;
  created_at: string;
  updated_at: string;
}

export interface CancellationDetails {
  document_number?: string;
  consumed_days: number;
  retained_amount: number;
  refund_amount: number;
  cancelled_at?: string;
}

/** Etat d'occupation d'un appartement, calcule depuis l'agenda et les reservations. */
export interface RoomAvailability {
  status: "free" | "occupied" | "unavailable";
  /** Date a partir de laquelle il redevient libre (si occupe). */
  occupied_until: string | null;
  /** Date a laquelle la prochaine occupation commence (si libre). */
  free_until: string | null;
}

/** Creneau libre propose quand rien n'est disponible sur toute la duree voulue. */
export interface AvailabilitySuggestion {
  id: number;
  slug: string;
  apartment_number: number | null;
  category_label: string | null;
  category_slug: string | null;
  price_per_night: number;
  starts_on: string;
  ends_on: string;
  nights: number;
}

/** Creneau libre de l'appartement consulte, quand les dates voulues sont prises. */
export interface OwnFreeWindow {
  starts_on: string;
  ends_on: string;
  nights: number;
}

/** Appartement libre propose quand la demande initiale echoue. */
export interface AvailableAlternative {
  id: number;
  slug: string;
  apartment_number: number | null;
  type: string;
  category_label: string | null;
  category_slug: string | null;
  price_per_night: number;
  price: number;
  image: string | null;
}

export interface AdminStatsResponse {
  stats: {
    total_reservations: number;
    total_rooms: number;
    total_users: number;
    total_revenue: number;
    occupancy_rate: number;
    occupied_rooms_count: number;
  };
  recent_reservations: Reservation[];
  recent_payments: Payment[];
}

/**
 * Client de l'API Laravel.
 *
 * Securite : les jetons (JWT d'acces et refresh token) vivent UNIQUEMENT dans
 * des cookies HttpOnly poses par l'API. Ce code n'y a jamais acces et rien
 * n'est ecrit dans localStorage/sessionStorage. Seul le jeton anti-CSRF
 * (inutile sans les cookies) est garde en memoire et renvoye dans l'en-tete
 * X-CSRF-Token des requetes qui modifient des donnees.
 */
class ApiClient {
  private csrfToken: string | null = null;
  private refreshing: Promise<boolean> | null = null;

  setCsrfToken(token: string | null | undefined) {
    this.csrfToken = token ?? null;
  }

  clearSession() {
    this.csrfToken = null;
  }

  private async request<T>(endpoint: string, options: RequestOptions = {}): Promise<T> {
    signalerActivite(1);

    try {
      return await this.executer<T>(endpoint, options);
    } finally {
      signalerActivite(-1);
    }
  }

  private buildHeaders(options: RequestOptions): Record<string, string> {
    const isFormData = typeof FormData !== "undefined" && options.body instanceof FormData;
    const method = (options.method || "GET").toUpperCase();
    const headers: Record<string, string> = {
      // Sans cet en-tete, Laravel traite la requete comme une navigation web.
      Accept: "application/json",
      ...(isFormData ? {} : { "Content-Type": "application/json" }),
      ...((options.headers as Record<string, string>) || {})
    };

    if (method !== "GET" && method !== "HEAD" && this.csrfToken) {
      headers["X-CSRF-Token"] = this.csrfToken;
    }
    if (options.idempotencyKey) {
      headers["Idempotency-Key"] = options.idempotencyKey;
    }
    return headers;
  }

  private send(endpoint: string, options: RequestOptions): Promise<Response> {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { idempotencyKey, skipRefresh, ...init } = options;
    return fetch(`${API_BASE_URL}${endpoint}`, {
      ...init,
      headers: this.buildHeaders(options),
      // Envoie les cookies HttpOnly de l'API (meme site en production).
      credentials: "include"
    });
  }

  /**
   * Renouvelle la session a partir du cookie de refresh. Un seul appel a la
   * fois : plusieurs requetes qui expirent ensemble attendent le meme.
   */
  async refreshSession(): Promise<boolean> {
    if (!this.refreshing) {
      this.refreshing = (async () => {
        try {
          const response = await fetch(`${API_BASE_URL}/auth/refresh`, {
            method: "POST",
            headers: { Accept: "application/json" },
            credentials: "include"
          });
          // 409 : un autre onglet vient de renouveler, ses cookies sont en place.
          if (response.status === 409) return true;
          if (!response.ok) {
            this.clearSession();
            return false;
          }
          const data = await response.json();
          // Visiteur sans session : rien n'a été renouvelé.
          if (!data.user) {
            this.clearSession();
            return false;
          }
          this.setCsrfToken(data.csrf_token);
          return true;
        } catch {
          return false;
        } finally {
          window.setTimeout(() => {
            this.refreshing = null;
          }, 0);
        }
      })();
    }
    return this.refreshing;
  }

  private async fetchWithRefresh(endpoint: string, options: RequestOptions): Promise<Response> {
    let response = await this.send(endpoint, options);

    if (response.status === 401 && !options.skipRefresh && !endpoint.startsWith("/auth/")) {
      if (await this.refreshSession()) {
        response = await this.send(endpoint, options);
      }
    } else if (response.status === 419 && !options.skipRefresh) {
      // Jeton CSRF perdu (rechargement) : on le recupere et on rejoue une fois.
      if (await this.refreshSession()) {
        response = await this.send(endpoint, options);
      }
    }

    return response;
  }

  private async executer<T>(endpoint: string, options: RequestOptions = {}): Promise<T> {
    const response = await this.fetchWithRefresh(endpoint, options);

    if (!response.ok) {
      const error = await response.json().catch(() => ({ message: "Une erreur est survenue" }));
      if (response.status === 401 && !options.skipRefresh && typeof window !== "undefined") {
        this.clearSession();
        // Session expiree depuis un espace prive : retour discret a la
        // connexion, en gardant la page pour y revenir ensuite.
        const here = window.location.pathname;
        if (here.startsWith("/espace-client") || here.startsWith("/admin")) {
          window.location.href = `/auth/login?redirect=${encodeURIComponent(here + window.location.search)}`;
        }
      }
      throw new ApiError(error.message || `Erreur ${response.status}`, response.status, error);
    }

    return response.json();
  }

  /** Telechargement d'un fichier (PDF) avec la session courante. */
  private async download(
    endpoint: string,
    fallbackName: string,
    options: RequestOptions = {}
  ): Promise<{ blob: Blob; filename: string }> {
    const response = await this.fetchWithRefresh(endpoint, {
      ...options,
      headers: {
        ...((options.headers as Record<string, string>) || {}),
        Accept: "application/pdf, application/json"
      }
    });

    if (!response.ok) {
      const error = await response
        .json()
        .catch(() => ({ message: "Impossible de télécharger ce document." }));
      throw new ApiError(error.message || `Erreur ${response.status}`, response.status, error);
    }

    const disposition = response.headers.get("Content-Disposition") || "";
    const encodedFilename = disposition.match(/filename\*=UTF-8''([^;]+)/i)?.[1];
    const basicFilename = disposition.match(/filename="?([^";]+)"?/i)?.[1];
    const filename = encodedFilename
      ? decodeURIComponent(encodedFilename)
      : basicFilename || fallbackName;

    return { blob: await response.blob(), filename };
  }

  async getRooms(params?: {
    type?: string;
    min_price?: number;
    max_price?: number;
    check_in?: string;
    check_out?: string;
  }): Promise<Room[]> {
    const queryParams = new URLSearchParams();
    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined) queryParams.append(key, String(value));
      });
    }
    const query = queryParams.toString();
    return this.request<Room[]>(`/rooms${query ? `?${query}` : ""}`);
  }

  async getRoom(slug: string): Promise<Room> {
    return this.request<Room>(`/rooms/${slug}`);
  }

  async checkAvailability(
    slug: string,
    checkIn: string,
    checkOut: string
  ): Promise<{ available: boolean; price: number }> {
    return this.request<{ available: boolean; price: number }>(
      `/rooms/${slug}/check-availability`,
      {
        method: "POST",
        body: JSON.stringify({ check_in: checkIn, check_out: checkOut })
      }
    );
  }

  async getRoomCategories(): Promise<RoomCategory[]> {
    return this.request<RoomCategory[]>("/room-categories");
  }

  async getRoomCategory(slugOrType: string): Promise<RoomCategory> {
    return this.request<RoomCategory>(`/room-categories/${slugOrType}`);
  }

  async checkCategoryAvailability(
    slugOrType: string,
    checkIn: string,
    checkOut: string,
    roomId?: number
  ): Promise<{
    available: boolean;
    price: number;
    deposit_per_day: number;
    available_room?: Room | null;
    own_window?: OwnFreeWindow | null;
    alternatives?: AvailableAlternative[];
    suggestions?: AvailabilitySuggestion[];
  }> {
    return this.request<{
      available: boolean;
      price: number;
      deposit_per_day: number;
      available_room?: Room | null;
      own_window?: OwnFreeWindow | null;
      alternatives?: AvailableAlternative[];
      suggestions?: AvailabilitySuggestion[];
    }>(`/room-categories/${slugOrType}/check-availability`, {
      method: "POST",
      body: JSON.stringify({ check_in: checkIn, check_out: checkOut, room_id: roomId })
    });
  }

  /**
   * Demande de reservation : gratuite, soumise a validation par l'administration.
   * `idempotencyKey` : une par clic sur « Envoyer », reutilisee en cas de nouvel essai.
   */
  async createReservation(
    data: {
      category_type: RoomCategoryType;
      room_id?: number;
      check_in: string;
      check_out: string;
      guests?: number;
      special_requests?: string;
    },
    idempotencyKey: string
  ): Promise<{ message: string; reservation: Reservation }> {
    return this.request<{ message: string; reservation: Reservation }>("/reservations", {
      method: "POST",
      body: JSON.stringify(data),
      idempotencyKey
    });
  }

  async getMyReservations(): Promise<Reservation[]> {
    return this.request<Reservation[]>("/reservations");
  }

  async getReservation(id: string): Promise<Reservation> {
    return this.request<Reservation>(`/reservations/${id}`);
  }

  /* ----------------------------- Paiements FeexPay ----------------------------- */

  async getPaymentChannels(): Promise<{
    mode: string;
    available: boolean;
    channels: PaymentChannel[];
  }> {
    return this.request("/payments/channels");
  }

  /**
   * Prepare le paiement du sejour (ouvert seulement apres validation par
   * l'administration) et renvoie la configuration du checkout FeexPay.
   */
  async payReservation(
    reservationId: number | string,
    idempotencyKey: string
  ): Promise<PaymentResult> {
    return this.request<PaymentResult>(`/reservations/${reservationId}/payments`, {
      method: "POST",
      idempotencyKey
    });
  }

  /** Prepare le paiement d'une prolongation validee (checkout FeexPay). */
  async payExtension(extensionId: number | string, idempotencyKey: string): Promise<PaymentResult> {
    return this.request<PaymentResult>(`/extensions/${extensionId}/payments`, {
      method: "POST",
      idempotencyKey
    });
  }

  /**
   * Le serveur interroge FeexPay : seule source fiable du statut. La
   * reference renvoyee par le checkout n'est qu'un indice, controle par l'API.
   */
  async verifyPayment(
    paymentId: number | string,
    reference?: string | null,
    network?: string | null
  ): Promise<PaymentResult> {
    const body: Record<string, string> = {};
    if (reference) body.reference = reference;
    if (network) body.network = network;
    return this.request<PaymentResult>(`/payments/${paymentId}/verify`, {
      method: "POST",
      body: JSON.stringify(body)
    });
  }

  /**
   * En SANDBOX, le SDK FeexPay simule le paiement sans creer de transaction.
   * Le serveur accepte cette confirmation uniquement si le drapeau
   * FEEXPAY_SANDBOX_TRUST_SDK est active cote backend.
   */
  async confirmSandboxPayment(
    paymentId: number | string,
    callback: {
      description: string;
      callback_info: { payment_id: number };
      reseau?: string | null;
    }
  ): Promise<PaymentResult> {
    return this.request<PaymentResult>(`/payments/${paymentId}/sandbox-confirm`, {
      method: "POST",
      body: JSON.stringify(callback)
    });
  }

  /** Retour de la page carte FeexPay (`?ref=`). Le `status` de l'URL est ignore. */
  async verifyPaymentReference(reference: string): Promise<PaymentResult> {
    return this.request<PaymentResult>("/payments/verify-reference", {
      method: "POST",
      body: JSON.stringify({ reference })
    });
  }

  async getPaymentStatus(paymentId: string): Promise<PaymentResult> {
    return this.request<PaymentResult>(`/payments/${paymentId}/status`);
  }

  async getReservationPayments(reservationId: string): Promise<Payment[]> {
    return this.request<Payment[]>(`/reservations/${reservationId}/payments`);
  }

  /* ------------------------------- Prolongations ------------------------------- */

  async getReservationExtensions(reservationId: number | string): Promise<{
    extensions: StayExtension[];
    can_request: boolean;
    refusal_reason: string | null;
  }> {
    return this.request(`/reservations/${reservationId}/extensions`);
  }

  async requestStayExtension(
    reservationId: number | string,
    newCheckOut: string,
    idempotencyKey: string
  ): Promise<{ message: string; extension: StayExtension }> {
    return this.request<{ message: string; extension: StayExtension }>(
      `/reservations/${reservationId}/extensions`,
      {
        method: "POST",
        body: JSON.stringify({ new_check_out: newCheckOut }),
        idempotencyKey
      }
    );
  }

  /* ------------------------------- Bons de Sejour ------------------------------ */

  async getReservationVouchers(
    reservationId: number | string
  ): Promise<{ vouchers: StayVoucher[] }> {
    return this.request(`/reservations/${reservationId}/vouchers`);
  }

  async downloadVoucherPdf(voucherId: number): Promise<{ blob: Blob; filename: string }> {
    return this.download(`/vouchers/${voucherId}/pdf`, `bon-de-sejour-${voucherId}.pdf`);
  }

  /**
   * Retire une reservation terminee de l'historique du client.
   * Rien n'est supprime : elle reste en base et visible cote administration.
   */
  async hideReservation(reservationId: string): Promise<{ message: string }> {
    return this.request<{ message: string }>(`/reservations/${reservationId}/masquer`, {
      method: "POST"
    });
  }

  /** Masque d'un coup toutes les reservations terminees. */
  async clearReservationHistory(): Promise<{ message: string; hidden: number }> {
    return this.request<{ message: string; hidden: number }>("/reservations/vider-historique", {
      method: "POST"
    });
  }

  async cancelReservation(
    reservationId: string
  ): Promise<{ message: string; reservation: Reservation; cancellation: CancellationDetails }> {
    return this.request<{
      message: string;
      reservation: Reservation;
      cancellation: CancellationDetails;
    }>(`/reservations/${reservationId}/cancel`, {
      method: "POST"
    });
  }

  async markInvoiceDownloaded(
    reservationId: string,
    paymentType: "deposit" | "stay"
  ): Promise<{ message: string; reservation: Reservation }> {
    return this.request<{ message: string; reservation: Reservation }>(
      `/reservations/${reservationId}/invoice-download`,
      {
        method: "POST",
        body: JSON.stringify({ payment_type: paymentType })
      }
    );
  }

  async downloadReservationDocumentPdf(
    reservationId: string,
    type: "booking" | "deposit" | "stay-voucher" | "stay" | "cancellation"
  ): Promise<{ blob: Blob; filename: string }> {
    return this.download(
      `/reservations/${reservationId}/invoice-pdf?type=${type}`,
      `document-${reservationId}.pdf`
    );
  }

  async getInvoice(paymentId: string): Promise<{ invoice: Record<string, unknown> }> {
    return this.request<{ invoice: Record<string, unknown> }>(`/payments/${paymentId}/invoice`);
  }

  async getNotifications(): Promise<{ notifications: Notification[]; unread_count: number }> {
    return this.request<{ notifications: Notification[]; unread_count: number }>("/notifications");
  }

  async markNotificationRead(
    id: number
  ): Promise<{ notification: Notification; unread_count: number }> {
    return this.request<{ notification: Notification; unread_count: number }>(
      `/notifications/${id}/read`,
      {
        method: "POST"
      }
    );
  }

  async markAllNotificationsRead(): Promise<{ unread_count: number }> {
    return this.request<{ unread_count: number }>("/notifications/read-all", {
      method: "POST"
    });
  }

  /* ------------------------------- Authentification ---------------------------- */

  private applySession<T extends { csrf_token?: string | null }>(response: T): T {
    this.setCsrfToken(response.csrf_token);
    return response;
  }

  /**
   * Etat de la session au chargement : utilisateur + jeton CSRF. Si le jeton
   * d'acces a expire, tente un renouvellement via le cookie de refresh.
   */
  async restoreSession(): Promise<User | null> {
    const attempt = async () => {
      const response = await this.send("/auth/session", {});
      if (!response.ok) return null;
      const data = await response.json();
      this.setCsrfToken(data.csrf_token);
      return data.user as User;
    };

    try {
      const user = await attempt();
      if (user) return user;
      if (await this.refreshSession()) return await attempt();
    } catch {
      /* hors ligne : session inconnue */
    }
    this.clearSession();
    return null;
  }

  /** Connexion : renvoie la session ouverte, ou la demande d'un code 2FA. */
  async login(email: string, password: string): Promise<LoginResult> {
    const response = await this.request<{
      user?: User;
      csrf_token?: string;
      two_factor_required?: boolean;
      challenge_token?: string;
    }>("/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password }),
      skipRefresh: true
    });

    if (response.two_factor_required && response.challenge_token) {
      return { kind: "two_factor", challengeToken: response.challenge_token };
    }
    this.applySession(response);
    return { kind: "session", user: response.user as User };
  }

  async completeTwoFactorLogin(
    challengeToken: string,
    code: { code?: string; recovery_code?: string }
  ): Promise<User> {
    const response = await this.request<{ user: User; csrf_token: string }>(
      "/auth/two-factor/challenge",
      {
        method: "POST",
        body: JSON.stringify({ challenge_token: challengeToken, ...code }),
        skipRefresh: true
      }
    );
    return this.applySession(response).user;
  }

  /**
   * Connexion / inscription avec Google : le jeton d'identite (Google
   * Identity Services) est verifie par l'API, qui pose les cookies de session.
   */
  async loginWithGoogle(credential: string): Promise<LoginResult> {
    const response = await this.request<{
      user?: User;
      csrf_token?: string;
      two_factor_required?: boolean;
      challenge_token?: string;
    }>("/auth/google", {
      method: "POST",
      body: JSON.stringify({ credential }),
      skipRefresh: true
    });

    if (response.two_factor_required && response.challenge_token) {
      return { kind: "two_factor", challengeToken: response.challenge_token };
    }
    this.applySession(response);
    return { kind: "session", user: response.user as User };
  }

  /** Inscription : n'ouvre PAS de session, un code est envoye par email. */
  async register(data: {
    name: string;
    email: string;
    phone: string;
    password: string;
    country: string;
  }): Promise<{ message: string; email: string }> {
    return this.request<{ message: string; email: string }>("/auth/register", {
      method: "POST",
      body: JSON.stringify(data),
      skipRefresh: true
    });
  }

  /** Confirme l'adresse avec le code recu et ouvre la session. */
  async verifyEmailCode(email: string, code: string): Promise<User> {
    const response = await this.request<{ user: User; csrf_token: string }>("/auth/email/verify", {
      method: "POST",
      body: JSON.stringify({ email, code }),
      skipRefresh: true
    });
    return this.applySession(response).user;
  }

  async resendEmailVerification(email: string): Promise<{ message: string }> {
    return this.request<{ message: string }>("/auth/email/resend", {
      method: "POST",
      body: JSON.stringify({ email }),
      skipRefresh: true
    });
  }

  async getCurrentUser(): Promise<User> {
    return this.request<User>("/user");
  }

  /** Telephone obligatoire (comptes Google) : finalise l'inscription. */
  async completePhone(phone: string, country: string): Promise<{ message: string; user: User }> {
    return this.request<{ message: string; user: User }>("/user/phone", {
      method: "POST",
      body: JSON.stringify({ phone, country })
    });
  }

  async updateProfile(data: { name: string }): Promise<{ message: string; user: User }> {
    return this.request<{ message: string; user: User }>("/user/profile", {
      method: "PUT",
      body: JSON.stringify(data)
    });
  }

  /** Confirme l'identite avant une action sensible (10 minutes). */
  async reauthenticate(proof: {
    password?: string;
    code?: string;
    credential?: string;
  }): Promise<{ message: string }> {
    return this.request<{ message: string }>("/auth/reauthenticate", {
      method: "POST",
      body: JSON.stringify(proof)
    });
  }

  async updatePassword(data: {
    current_password?: string;
    password: string;
    password_confirmation: string;
  }): Promise<{ message: string; user: User }> {
    return this.request<{ message: string; user: User }>("/user/password", {
      method: "PUT",
      body: JSON.stringify(data)
    });
  }

  async requestEmailChange(email: string): Promise<{ message: string }> {
    return this.request<{ message: string }>("/user/email", {
      method: "POST",
      body: JSON.stringify({ email })
    });
  }

  async confirmEmailChange(code: string): Promise<{ message: string; user: User }> {
    return this.request<{ message: string; user: User }>("/user/email/confirm", {
      method: "POST",
      body: JSON.stringify({ code })
    });
  }

  async getSessions(): Promise<{ sessions: AuthSessionInfo[] }> {
    return this.request<{ sessions: AuthSessionInfo[] }>("/auth/sessions");
  }

  async revokeSession(sessionId: string): Promise<{ message: string }> {
    return this.request<{ message: string }>(`/auth/sessions/${sessionId}`, { method: "DELETE" });
  }

  async revokeOtherSessions(): Promise<{ message: string; revoked: number }> {
    return this.request<{ message: string; revoked: number }>("/auth/sessions/revoke-others", {
      method: "POST"
    });
  }

  async beginTwoFactorSetup(): Promise<{ secret: string; otpauth_url: string }> {
    return this.request<{ secret: string; otpauth_url: string }>("/auth/two-factor/setup", {
      method: "POST"
    });
  }

  async confirmTwoFactorSetup(
    code: string
  ): Promise<{ message: string; recovery_codes: string[]; user: User }> {
    return this.request("/auth/two-factor/confirm", {
      method: "POST",
      body: JSON.stringify({ code })
    });
  }

  async disableTwoFactor(): Promise<{ message: string; user: User }> {
    return this.request<{ message: string; user: User }>("/auth/two-factor", { method: "DELETE" });
  }

  async regenerateRecoveryCodes(): Promise<{ recovery_codes: string[] }> {
    return this.request<{ recovery_codes: string[] }>("/auth/two-factor/recovery-codes", {
      method: "POST"
    });
  }

  async forgotPassword(email: string): Promise<{ message: string }> {
    return this.request<{ message: string }>("/auth/forgot-password", {
      method: "POST",
      body: JSON.stringify({ email }),
      skipRefresh: true
    });
  }

  async resetPassword(data: {
    token: string;
    email: string;
    password: string;
    password_confirmation: string;
  }): Promise<{ message: string }> {
    return this.request<{ message: string }>("/auth/reset-password", {
      method: "POST",
      body: JSON.stringify(data),
      skipRefresh: true
    });
  }

  /**
   * Deconnexion « sans attente » : la revocation part en arriere-plan
   * (keepalive : elle survit au changement de page). Le serveur efface les
   * cookies et revoque la session de cet appareil.
   */
  logout(): void {
    this.clearSession();
    if (typeof fetch === "undefined") return;

    fetch(`${API_BASE_URL}/auth/logout`, {
      method: "POST",
      keepalive: true,
      credentials: "include",
      headers: { Accept: "application/json" }
    }).catch(() => {
      /* hors ligne : la session expirera d'elle-meme */
    });
  }

  /* -------------------------------- Administration ------------------------------ */

  private tableQuery(params?: AdminTableQuery): string {
    const query = new URLSearchParams();
    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        if (value === undefined || value === null || value === "") return;
        if (Array.isArray(value)) {
          if (value.length) query.append(key, value.join(","));
          return;
        }
        if (typeof value === "boolean") {
          query.append(key, value ? "1" : "0");
          return;
        }
        query.append(key, String(value));
      });
    }
    const built = query.toString();
    return built ? `?${built}` : "";
  }

  /** Demandes de reservation, filtrees et paginees cote serveur. */
  async getAdminReservations(params?: AdminTableQuery): Promise<Paginated<Reservation>> {
    return this.request<Paginated<Reservation>>(`/admin/reservations${this.tableQuery(params)}`);
  }

  /** Demandes de prolongation, filtrees et paginees cote serveur. */
  async getAdminExtensions(params?: AdminTableQuery): Promise<Paginated<StayExtension>> {
    return this.request<Paginated<StayExtension>>(`/admin/extensions${this.tableQuery(params)}`);
  }

  async approveExtension(
    id: number,
    data: { admin_notes?: string }
  ): Promise<{ message: string; extension: StayExtension }> {
    return this.request(`/admin/extensions/${id}/approve`, {
      method: "POST",
      body: JSON.stringify(data)
    });
  }

  async rejectExtension(
    id: number,
    data: { admin_notes: string }
  ): Promise<{ message: string; extension: StayExtension }> {
    return this.request(`/admin/extensions/${id}/reject`, {
      method: "POST",
      body: JSON.stringify(data)
    });
  }

  async downloadAdminReservationsReport(data: {
    reservation_ids: number[];
    filter_label: string;
    search?: string;
    date_from?: string;
    date_to?: string;
  }): Promise<{ blob: Blob; filename: string }> {
    return this.download(
      "/admin/reservations/report",
      `rapport-reservations-${new Date().toISOString().slice(0, 10)}.pdf`,
      {
        method: "POST",
        body: JSON.stringify(data),
        headers: { "Content-Type": "application/json" }
      }
    );
  }

  async getOccupiedRooms(): Promise<{ data: Reservation[] }> {
    return this.request<{ data: Reservation[] }>("/admin/occupied-rooms");
  }

  async approveReservation(
    id: number,
    data: { admin_notes?: string }
  ): Promise<{ message: string; reservation: Reservation }> {
    return this.request<{ message: string; reservation: Reservation }>(
      `/admin/reservations/${id}/approve`,
      {
        method: "POST",
        body: JSON.stringify(data)
      }
    );
  }

  async rejectReservation(
    id: number,
    data: { admin_notes: string }
  ): Promise<{ message: string; reservation: Reservation }> {
    return this.request<{ message: string; reservation: Reservation }>(
      `/admin/reservations/${id}/reject`,
      {
        method: "POST",
        body: JSON.stringify(data)
      }
    );
  }

  async markReservationRefunded(
    id: number
  ): Promise<{ message: string; reservation: Reservation }> {
    return this.request<{ message: string; reservation: Reservation }>(
      `/admin/reservations/${id}/mark-refunded`,
      {
        method: "POST"
      }
    );
  }

  async releaseOccupiedRoom(
    id: number,
    data: { release_notes?: string }
  ): Promise<{ message: string; reservation: Reservation }> {
    return this.request<{ message: string; reservation: Reservation }>(
      `/admin/reservations/${id}/release-room`,
      {
        method: "POST",
        body: JSON.stringify(data)
      }
    );
  }

  async getAdminRoomCategories(): Promise<RoomCategory[]> {
    return this.request<RoomCategory[]>("/admin/room-categories");
  }

  async updateAdminRoomCategory(
    typeOrSlug: string,
    data: Partial<RoomCategory>
  ): Promise<{ message: string; category: RoomCategory }> {
    return this.request<{ message: string; category: RoomCategory }>(
      `/admin/room-categories/${typeOrSlug}`,
      {
        method: "PUT",
        body: JSON.stringify(data)
      }
    );
  }

  async uploadAdminRoomCategoryMedia(
    typeOrSlug: string,
    kind: "images" | "videos",
    file: File
  ): Promise<{ message: string; url: string; category: RoomCategory }> {
    const formData = new FormData();
    formData.append("kind", kind);
    formData.append("file", file);

    return this.request<{ message: string; url: string; category: RoomCategory }>(
      `/admin/room-categories/${typeOrSlug}/media`,
      { method: "POST", body: formData }
    );
  }

  async uploadAdminRoomMedia(
    roomId: number,
    kind: "images" | "videos",
    file: File
  ): Promise<{ message: string; url: string; room: Room }> {
    const formData = new FormData();
    formData.append("kind", kind);
    formData.append("file", file);

    return this.request<{ message: string; url: string; room: Room }>(
      `/admin/rooms/${roomId}/media`,
      {
        method: "POST",
        body: formData
      }
    );
  }

  async getAdminRooms(): Promise<Room[]> {
    return this.request<Room[]>("/admin/rooms");
  }

  async createAdminRoom(
    data: Omit<Room, "id" | "slug" | "status" | "created_at" | "updated_at"> & { status?: string }
  ): Promise<{ message: string; room: Room }> {
    return this.request<{ message: string; room: Room }>("/admin/rooms", {
      method: "POST",
      body: JSON.stringify(data)
    });
  }

  async updateAdminRoom(id: number, data: Partial<Room>): Promise<{ message: string; room: Room }> {
    return this.request<{ message: string; room: Room }>(`/admin/rooms/${id}`, {
      method: "PUT",
      body: JSON.stringify(data)
    });
  }

  async deleteAdminRoom(id: number): Promise<{ message: string }> {
    return this.request<{ message: string }>(`/admin/rooms/${id}`, {
      method: "DELETE"
    });
  }

  async getAdminStats(): Promise<AdminStatsResponse> {
    return this.request<AdminStatsResponse>("/admin/stats");
  }

  /** Utilisateurs : liste paginee, triable et filtrable cote serveur. Aucune suppression possible. */
  async getAdminUsers(params?: AdminTableQuery): Promise<Paginated<User>> {
    return this.request<Paginated<User>>(`/admin/users${this.tableQuery(params)}`);
  }

  async updateAdminUser(
    id: number,
    data: { name: string }
  ): Promise<{ message: string; user: User }> {
    return this.request<{ message: string; user: User }>(`/admin/users/${id}`, {
      method: "PUT",
      body: JSON.stringify(data)
    });
  }

  async toggleUserAdmin(id: number): Promise<{ message: string; user: User }> {
    return this.request<{ message: string; user: User }>(`/admin/users/${id}/toggle-admin`, {
      method: "PUT"
    });
  }
}

export const api = new ApiClient();
