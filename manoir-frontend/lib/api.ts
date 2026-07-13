const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api';

export class ApiError extends Error {
  constructor(
    message: string,
    public status: number
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

export type ReservationStatus =
  | 'EN_ATTENTE'
  | 'VALIDEE_PAIEMENT_REQUIS'
  | 'CONFIRMEE'
  | 'REFUSEE'
  | 'EXPIREE'
  | 'SEJOUR_PAYE'
  | 'ANNULEE'
  | 'REMBOURSEE';

export type RoomCategoryType = 'vip' | 'deux_chambres' | 'une_chambre';

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
  deposit_invoice_number?: string;
  stay_invoice_number?: string;
  cancellation_document_number?: string;
  deposit_invoice_downloaded?: boolean;
  stay_invoice_downloaded?: boolean;
  created_at: string;
  updated_at: string;
  room?: Room;
  user?: User;
  payments?: Payment[];
  notifications?: Notification[];
}

export interface Payment {
  id: number;
  reservation_id: number;
  payment_method: string;
  provider: string;
  transaction_id: string;
  payment_type?: 'deposit' | 'stay';
  invoice_number?: string;
  status: 'pending' | 'success' | 'failed';
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
  is_admin: boolean;
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
    if (typeof window !== 'undefined') {
      localStorage.setItem('auth_token', token);
    }
  }

  getToken(): string | null {
    if (!this.token && typeof window !== 'undefined') {
      this.token = localStorage.getItem('auth_token');
    }
    return this.token;
  }

  clearToken() {
    this.token = null;
    if (typeof window !== 'undefined') {
      localStorage.removeItem('auth_token');
    }
  }

  private async request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    const isFormData = typeof FormData !== 'undefined' && options.body instanceof FormData;
    const headers: HeadersInit = {
      ...(isFormData ? {} : { 'Content-Type': 'application/json' }),
      ...options.headers,
    };

    const token = this.getToken();
    if (token) {
      (headers as Record<string, string>)['Authorization'] = `Bearer ${token}`;
    }

    const response = await fetch(`${API_BASE_URL}${endpoint}`, {
      ...options,
      headers,
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ message: 'Une erreur est survenue' }));
      if (response.status === 401) {
        this.clearToken();
      }
      throw new ApiError(error.message || `Erreur ${response.status}`, response.status);
    }

    return response.json();
  }

  async getRooms(params?: { type?: string; min_price?: number; max_price?: number; check_in?: string; check_out?: string }): Promise<Room[]> {
    const queryParams = new URLSearchParams();
    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined) queryParams.append(key, String(value));
      });
    }
    const query = queryParams.toString();
    return this.request<Room[]>(`/rooms${query ? `?${query}` : ''}`);
  }

  async getRoom(slug: string): Promise<Room> {
    return this.request<Room>(`/rooms/${slug}`);
  }

  async checkAvailability(slug: string, checkIn: string, checkOut: string): Promise<{ available: boolean; price: number }> {
    return this.request<{ available: boolean; price: number }>(`/rooms/${slug}/check-availability`, {
      method: 'POST',
      body: JSON.stringify({ check_in: checkIn, check_out: checkOut }),
    });
  }

  async getRoomCategories(): Promise<RoomCategory[]> {
    return this.request<RoomCategory[]>('/room-categories');
  }

  async getRoomCategory(slugOrType: string): Promise<RoomCategory> {
    return this.request<RoomCategory>(`/room-categories/${slugOrType}`);
  }

  async checkCategoryAvailability(
    slugOrType: string,
    checkIn: string,
    checkOut: string,
    roomId?: number
  ): Promise<{ available: boolean; price: number; deposit_per_day: number; available_room?: Room | null }> {
    return this.request<{ available: boolean; price: number; deposit_per_day: number; available_room?: Room | null }>(`/room-categories/${slugOrType}/check-availability`, {
      method: 'POST',
      body: JSON.stringify({ check_in: checkIn, check_out: checkOut, room_id: roomId }),
    });
  }

  async createReservation(data: {
    category_type: RoomCategoryType;
    room_id?: number;
    check_in: string;
    check_out: string;
    special_requests?: string;
  }): Promise<{ message: string; reservation: Reservation }> {
    return this.request<{ message: string; reservation: Reservation }>('/reservations', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async getMyReservations(): Promise<Reservation[]> {
    return this.request<Reservation[]>('/reservations');
  }

  async getReservation(id: string): Promise<Reservation> {
    return this.request<Reservation>(`/reservations/${id}`);
  }

  async initiatePayment(reservationId: string, data: {
    payment_method: 'mobile_money' | 'card';
    provider: 'fedapay' | 'kkiapay';
    payment_type?: 'deposit' | 'stay';
    phone_number?: string;
  }): Promise<{ message: string; payment: Payment; payment_url: string }> {
    return this.request<{ message: string; payment: Payment; payment_url: string }>(
      `/reservations/${reservationId}/payments/initiate`,
      {
        method: 'POST',
        body: JSON.stringify(data),
      }
    );
  }

  async getPaymentStatus(paymentId: string): Promise<{ status: string; reservation_status: string; amount: number; payment_type?: string; invoice_number?: string }> {
    return this.request<{ status: string; reservation_status: string; amount: number; payment_type?: string; invoice_number?: string }>(`/payments/${paymentId}/status`);
  }

  async getReservationPayments(reservationId: string): Promise<Payment[]> {
    return this.request<Payment[]>(`/reservations/${reservationId}/payments`);
  }

  async cancelReservation(reservationId: string): Promise<{ message: string; reservation: Reservation; cancellation: CancellationDetails }> {
    return this.request<{ message: string; reservation: Reservation; cancellation: CancellationDetails }>(`/reservations/${reservationId}/cancel`, {
      method: 'POST',
    });
  }

  async markInvoiceDownloaded(reservationId: string, paymentType: 'deposit' | 'stay'): Promise<{ message: string; reservation: Reservation }> {
    return this.request<{ message: string; reservation: Reservation }>(`/reservations/${reservationId}/invoice-download`, {
      method: 'POST',
      body: JSON.stringify({ payment_type: paymentType }),
    });
  }

  async getInvoice(paymentId: string): Promise<{ invoice: Record<string, unknown> }> {
    return this.request<{ invoice: Record<string, unknown> }>(`/payments/${paymentId}/invoice`);
  }

  async login(email: string, password: string): Promise<{ token: string; user: User }> {
    const response = await this.request<{ token: string; user: User }>('/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
    this.setToken(response.token);
    return response;
  }

  async register(data: { name: string; email: string; phone: string; password: string }): Promise<{ token: string; user: User }> {
    const response = await this.request<{ token: string; user: User }>('/register', {
      method: 'POST',
      body: JSON.stringify(data),
    });
    this.setToken(response.token);
    return response;
  }

  async getCurrentUser(): Promise<User> {
    return this.request<User>('/user');
  }

  async updateProfile(data: { name: string }): Promise<{ message: string; user: User }> {
    return this.request<{ message: string; user: User }>('/user/profile', {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  async updatePassword(data: {
    current_password: string;
    password: string;
    password_confirmation: string;
  }): Promise<{ message: string }> {
    return this.request<{ message: string }>('/user/password', {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  async logout(): Promise<{ message: string }> {
    try {
      return await this.request<{ message: string }>('/logout', { method: 'POST' });
    } finally {
      this.clearToken();
    }
  }

  async getAdminReservations(params?: { status?: string; room_id?: number; category_type?: string }): Promise<{ data: Reservation[] }> {
    const queryParams = new URLSearchParams();
    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined) queryParams.append(key, String(value));
      });
    }
    const query = queryParams.toString();
    return this.request<{ data: Reservation[] }>(`/admin/reservations${query ? `?${query}` : ''}`);
  }

  async approveReservation(id: number, data: { admin_notes?: string }): Promise<{ message: string; reservation: Reservation }> {
    return this.request<{ message: string; reservation: Reservation }>(`/admin/reservations/${id}/approve`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async rejectReservation(id: number, data: { admin_notes: string }): Promise<{ message: string; reservation: Reservation }> {
    return this.request<{ message: string; reservation: Reservation }>(`/admin/reservations/${id}/reject`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async markReservationRefunded(id: number): Promise<{ message: string; reservation: Reservation }> {
    return this.request<{ message: string; reservation: Reservation }>(`/admin/reservations/${id}/mark-refunded`, {
      method: 'POST',
    });
  }

  async getAdminRoomCategories(): Promise<RoomCategory[]> {
    return this.request<RoomCategory[]>('/admin/room-categories');
  }

  async updateAdminRoomCategory(typeOrSlug: string, data: Partial<RoomCategory>): Promise<{ message: string; category: RoomCategory }> {
    return this.request<{ message: string; category: RoomCategory }>(`/admin/room-categories/${typeOrSlug}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  async uploadAdminRoomCategoryMedia(typeOrSlug: string, kind: 'images' | 'videos', file: File): Promise<{ message: string; url: string; category: RoomCategory }> {
    const formData = new FormData();
    formData.append('kind', kind);
    formData.append('file', file);

    return this.request<{ message: string; url: string; category: RoomCategory }>(`/admin/room-categories/${typeOrSlug}/media`, {
      method: 'POST',
      body: formData,
    });
  }

  async uploadAdminRoomMedia(roomId: number, kind: 'images' | 'videos', file: File): Promise<{ message: string; url: string; room: Room }> {
    const formData = new FormData();
    formData.append('kind', kind);
    formData.append('file', file);

    return this.request<{ message: string; url: string; room: Room }>(`/admin/rooms/${roomId}/media`, {
      method: 'POST',
      body: formData,
    });
  }

  async getAdminRooms(): Promise<Room[]> {
    return this.request<Room[]>('/admin/rooms');
  }

  async createAdminRoom(data: Omit<Room, 'id' | 'slug' | 'status' | 'created_at' | 'updated_at'>): Promise<{ message: string; room: Room }> {
    return this.request<{ message: string; room: Room }>('/admin/rooms', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async updateAdminRoom(id: number, data: Partial<Room>): Promise<{ message: string; room: Room }> {
    return this.request<{ message: string; room: Room }>(`/admin/rooms/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  async deleteAdminRoom(id: number): Promise<{ message: string }> {
    return this.request<{ message: string }>(`/admin/rooms/${id}`, {
      method: 'DELETE',
    });
  }

  async getAdminStats(): Promise<AdminStatsResponse> {
    return this.request<AdminStatsResponse>('/admin/stats');
  }

  async getAdminUsers(): Promise<User[]> {
    return this.request<User[]>('/admin/users');
  }

  async updateAdminUser(id: number, data: { name: string }): Promise<{ message: string; user: User }> {
    return this.request<{ message: string; user: User }>(`/admin/users/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  async toggleUserAdmin(id: number): Promise<{ message: string; user: User }> {
    return this.request<{ message: string; user: User }>(`/admin/users/${id}/toggle-admin`, {
      method: 'PUT',
    });
  }

  async deleteUser(id: number): Promise<{ message: string }> {
    return this.request<{ message: string }>(`/admin/users/${id}`, {
      method: 'DELETE',
    });
  }
}

export const api = new ApiClient();
