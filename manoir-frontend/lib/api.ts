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
    public status: number
  ) {
    super(message);
    this.name = "ApiError";
  }
}

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
}

export interface Payment {
  id: number;
  reservation_id: number;
  payment_method: string;
  provider: string;
  transaction_id: string;
  payment_type?: "deposit" | "stay";
  invoice_number?: string;
  status: "pending" | "success" | "failed";
  amount: number;
  metadata?: Record<string, unknown>;
  paid_at?: string;
  created_at: string;
  updated_at: string;
}

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

class ApiClient {
  private token: string | null = null;

  setToken(token: string) {
    this.token = token;
    if (typeof window !== "undefined") {
      localStorage.setItem("auth_token", token);
    }
  }

  getToken(): string | null {
    if (!this.token && typeof window !== "undefined") {
      this.token = localStorage.getItem("auth_token");
    }
    return this.token;
  }

  clearToken() {
    this.token = null;
    if (typeof window !== "undefined") {
      localStorage.removeItem("auth_token");
    }
  }

  private async request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    signalerActivite(1);

    try {
      return await this.executer<T>(endpoint, options);
    } finally {
      signalerActivite(-1);
    }
  }

  private async executer<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    const isFormData = typeof FormData !== "undefined" && options.body instanceof FormData;
    const headers: HeadersInit = {
      // Sans cet en-tete, Laravel traite la requete comme une navigation web :
      // une session expiree provoquait un 500 au lieu d'un 401, et
      // l'interception plus bas ne pouvait pas deconnecter proprement.
      Accept: "application/json",
      ...(isFormData ? {} : { "Content-Type": "application/json" }),
      ...options.headers
    };

    const token = this.getToken();
    if (token) {
      (headers as Record<string, string>)["Authorization"] = `Bearer ${token}`;
    }

    const response = await fetch(`${API_BASE_URL}${endpoint}`, {
      ...options,
      headers
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ message: "Une erreur est survenue" }));
      if (response.status === 401) {
        const hadToken = Boolean(token);
        this.clearToken();
        // Session expirée sur un appel authentifié : on renvoie discrètement
        // vers la connexion (sans message alarmant) uniquement depuis un
        // espace privé, en gardant la page pour y revenir ensuite.
        const isAuthEndpoint =
          endpoint.startsWith("/login") ||
          endpoint.startsWith("/register") ||
          endpoint.startsWith("/auth/");
        if (hadToken && !isAuthEndpoint && typeof window !== "undefined") {
          const here = window.location.pathname;
          if (here.startsWith("/espace-client") || here.startsWith("/admin")) {
            window.location.href = `/auth/login?redirect=${encodeURIComponent(here + window.location.search)}`;
          }
        }
      }
      throw new ApiError(error.message || `Erreur ${response.status}`, response.status);
    }

    return response.json();
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

  async createReservation(data: {
    category_type: RoomCategoryType;
    room_id?: number;
    check_in: string;
    check_out: string;
    guests?: number;
    special_requests?: string;
  }): Promise<{ message: string; reservation: Reservation }> {
    return this.request<{ message: string; reservation: Reservation }>("/reservations", {
      method: "POST",
      body: JSON.stringify(data)
    });
  }

  async getMyReservations(): Promise<Reservation[]> {
    return this.request<Reservation[]>("/reservations");
  }

  async getReservation(id: string): Promise<Reservation> {
    return this.request<Reservation>(`/reservations/${id}`);
  }

  async initiatePayment(
    reservationId: string,
    data: {
      payment_method: "mobile_money" | "card";
      provider: "fedapay" | "kkiapay";
      payment_type?: "deposit" | "stay";
      phone_number?: string;
    }
  ): Promise<{ message: string; payment: Payment; payment_url: string }> {
    return this.request<{ message: string; payment: Payment; payment_url: string }>(
      `/reservations/${reservationId}/payments/initiate`,
      {
        method: "POST",
        body: JSON.stringify(data)
      }
    );
  }

  async getPaymentStatus(paymentId: string): Promise<{
    status: string;
    reservation_status: string;
    amount: number;
    payment_type?: string;
    invoice_number?: string;
  }> {
    return this.request<{
      status: string;
      reservation_status: string;
      amount: number;
      payment_type?: string;
      invoice_number?: string;
    }>(`/payments/${paymentId}/status`);
  }

  async getReservationPayments(reservationId: string): Promise<Payment[]> {
    return this.request<Payment[]>(`/reservations/${reservationId}/payments`);
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
    return this.request<{ message: string; hidden: number }>(
      "/reservations/vider-historique",
      { method: "POST" }
    );
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

  async requestStayExtension(
    reservationId: string,
    newCheckOut: string
  ): Promise<{ message: string; reservation: Reservation }> {
    return this.request<{ message: string; reservation: Reservation }>(
      `/reservations/${reservationId}/extension`,
      {
        method: "POST",
        body: JSON.stringify({ new_check_out: newCheckOut })
      }
    );
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
    const headers: HeadersInit = {};
    const token = this.getToken();
    if (token) {
      (headers as Record<string, string>).Authorization = `Bearer ${token}`;
    }

    const response = await fetch(
      `${API_BASE_URL}/reservations/${reservationId}/invoice-pdf?type=${type}`,
      { headers }
    );

    if (!response.ok) {
      const error = await response.json().catch(() => ({
        message: "Impossible de télécharger cette facture."
      }));
      throw new ApiError(error.message || `Erreur ${response.status}`, response.status);
    }

    const disposition = response.headers.get("Content-Disposition") || "";
    const encodedFilename = disposition.match(/filename\*=UTF-8''([^;]+)/i)?.[1];
    const basicFilename = disposition.match(/filename="?([^";]+)"?/i)?.[1];
    const filename = encodedFilename
      ? decodeURIComponent(encodedFilename)
      : basicFilename || `facture-${reservationId}.pdf`;

    return { blob: await response.blob(), filename };
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
      { method: "POST" }
    );
  }

  async markAllNotificationsRead(): Promise<{ unread_count: number }> {
    return this.request<{ unread_count: number }>("/notifications/read-all", {
      method: "POST"
    });
  }

  async login(email: string, password: string): Promise<{ token: string; user: User }> {
    const response = await this.request<{ token: string; user: User }>("/login", {
      method: "POST",
      body: JSON.stringify({ email, password })
    });
    this.setToken(response.token);
    return response;
  }

  /**
   * Connexion / inscription avec Google : envoie le jeton d'identite obtenu
   * via Google Identity Services. Le serveur le verifie aupres de Google,
   * cree le compte au besoin et renvoie un jeton Sanctum.
   * Endpoint attendu cote API : POST /auth/google { credential }.
   */
  async loginWithGoogle(credential: string): Promise<{ token: string; user: User }> {
    const response = await this.request<{ token: string; user: User }>("/auth/google", {
      method: "POST",
      body: JSON.stringify({ credential })
    });
    this.setToken(response.token);
    return response;
  }

  async register(data: {
    name: string;
    email: string;
    phone: string;
    password: string;
    country: string;
  }): Promise<{ token: string; user: User }> {
    const response = await this.request<{ token: string; user: User }>("/register", {
      method: "POST",
      body: JSON.stringify(data)
    });
    this.setToken(response.token);
    return response;
  }

  async getCurrentUser(): Promise<User> {
    return this.request<User>("/user");
  }

  async updateProfile(data: { name: string; phone?: string }): Promise<{ message: string; user: User }> {
    return this.request<{ message: string; user: User }>("/user/profile", {
      method: "PUT",
      body: JSON.stringify(data)
    });
  }

  async updatePassword(data: {
    current_password: string;
    password: string;
    password_confirmation: string;
  }): Promise<{ message: string }> {
    return this.request<{ message: string }>("/user/password", {
      method: "PUT",
      body: JSON.stringify(data)
    });
  }

  async forgotPassword(email: string): Promise<{ message: string }> {
    return this.request<{ message: string }>("/forgot-password", {
      method: "POST",
      body: JSON.stringify({ email })
    });
  }

  async resetPassword(data: {
    token: string;
    email: string;
    password: string;
    password_confirmation: string;
  }): Promise<{ message: string }> {
    return this.request<{ message: string }>("/reset-password", {
      method: "POST",
      body: JSON.stringify(data)
    });
  }

  async getEmailVerificationStatus(): Promise<{
    verified: boolean;
    email: string;
    code_pending: boolean;
  }> {
    return this.request("/email/status");
  }

  async verifyEmailCode(code: string): Promise<{ message: string; verified: boolean }> {
    return this.request<{ message: string; verified: boolean }>("/email/verify-code", {
      method: "POST",
      body: JSON.stringify({ code })
    });
  }

  async resendEmailVerification(): Promise<{ message: string }> {
    return this.request<{ message: string }>("/email/resend", { method: "POST" });
  }

  /**
   * Déconnexion « sans attente » : la session locale est vidée tout de suite
   * et la révocation du jeton part en arrière-plan (keepalive : elle survit au
   * changement de page). Un échec côté serveur est sans conséquence pour
   * l'utilisateur, le jeton n'étant plus stocké.
   */
  logout(): void {
    const token = this.getToken();
    this.clearToken();
    if (!token || typeof fetch === "undefined") return;

    fetch(`${API_BASE_URL}/logout`, {
      method: "POST",
      keepalive: true,
      headers: { Accept: "application/json", Authorization: `Bearer ${token}` }
    }).catch(() => {
      /* hors ligne ou jeton déjà expiré : rien à faire */
    });
  }

  async getAdminReservations(params?: {
    status?: string;
    room_id?: number;
    category_type?: string;
    per_page?: number;
  }): Promise<{ data: Reservation[] }> {
    const queryParams = new URLSearchParams();
    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined) queryParams.append(key, String(value));
      });
    }
    const query = queryParams.toString();
    return this.request<{ data: Reservation[] }>(`/admin/reservations${query ? `?${query}` : ""}`);
  }

  async downloadAdminReservationsReport(data: {
    reservation_ids: number[];
    filter_label: string;
    search?: string;
    date_from?: string;
    date_to?: string;
  }): Promise<{ blob: Blob; filename: string }> {
    const headers: HeadersInit = { "Content-Type": "application/json" };
    const token = this.getToken();
    if (token) {
      (headers as Record<string, string>).Authorization = `Bearer ${token}`;
    }

    const response = await fetch(`${API_BASE_URL}/admin/reservations/report`, {
      method: "POST",
      headers,
      body: JSON.stringify(data)
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ message: "Impossible de générer le PDF." }));
      throw new ApiError(error.message || `Erreur ${response.status}`, response.status);
    }

    const disposition = response.headers.get("Content-Disposition") || "";
    const encodedFilename = disposition.match(/filename\*=UTF-8''([^;]+)/i)?.[1];
    const basicFilename = disposition.match(/filename="?([^";]+)"?/i)?.[1];
    const filename = encodedFilename
      ? decodeURIComponent(encodedFilename)
      : basicFilename || `rapport-reservations-${new Date().toISOString().slice(0, 10)}.pdf`;

    return { blob: await response.blob(), filename };
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

  async approveReservationExtension(
    id: number,
    data: { admin_notes?: string }
  ): Promise<{ message: string; reservation: Reservation }> {
    return this.request<{ message: string; reservation: Reservation }>(
      `/admin/reservations/${id}/extension/approve`,
      {
        method: "POST",
        body: JSON.stringify(data)
      }
    );
  }

  async rejectReservationExtension(
    id: number,
    data: { admin_notes: string }
  ): Promise<{ message: string; reservation: Reservation }> {
    return this.request<{ message: string; reservation: Reservation }>(
      `/admin/reservations/${id}/extension/reject`,
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
      {
        method: "POST",
        body: formData
      }
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
    data: Omit<Room, "id" | "slug" | "status" | "created_at" | "updated_at">
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

  async getAdminUsers(): Promise<User[]> {
    return this.request<User[]>("/admin/users");
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

  async deleteUser(id: number): Promise<{ message: string }> {
    return this.request<{ message: string }>(`/admin/users/${id}`, {
      method: "DELETE"
    });
  }
}

export const api = new ApiClient();
