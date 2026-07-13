'use client';

import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/context/ToastContext';
import { useRouter } from 'next/navigation';
import { api, Reservation, type AdminStatsResponse } from '@/lib/api';
import { motion, AnimatePresence } from 'framer-motion';
import { Calendar, Check, DollarSign, Filter, RefreshCcw, Sparkles, TrendingUp, Users, X } from 'lucide-react';
import Link from 'next/link';

const statusLabels: Record<string, string> = {
  EN_ATTENTE: 'En attente',
  VALIDEE_PAIEMENT_REQUIS: 'Caution requise',
  CONFIRMEE: 'Confirmee',
  REFUSEE: 'Refusee',
  EXPIREE: 'Expiree',
  SEJOUR_PAYE: 'Sejour paye',
  ANNULEE: 'Annulee',
  REMBOURSEE: 'Remboursee',
};

const categoryLabels: Record<string, string> = {
  vip: 'Appartement VIP',
  deux_chambres: 'Appartement 2 Chambres',
  une_chambre: 'Appartement 1 Chambre',
};

const statusClasses = (status: string) => {
  if (status === 'EN_ATTENTE') return 'bg-yellow-600/10 text-yellow-800 border-yellow-600/20';
  if (status === 'VALIDEE_PAIEMENT_REQUIS') return 'bg-blue-600/10 text-blue-800 border-blue-600/20';
  if (status === 'CONFIRMEE' || status === 'SEJOUR_PAYE') return 'bg-emerald-600/10 text-emerald-800 border-emerald-600/20';
  if (status === 'REFUSEE') return 'bg-red-600/10 text-red-800 border-red-600/20';
  if (status === 'ANNULEE') return 'bg-orange-600/10 text-orange-800 border-orange-600/20';
  if (status === 'REMBOURSEE') return 'bg-purple-600/10 text-purple-800 border-purple-600/20';
  return 'bg-neutral-600/10 text-neutral-800 border-neutral-600/20';
};

const reservationApartmentLabel = (reservation: Reservation) => {
  const room = reservation.room;

  if (room?.apartment_number) {
    const label =
      reservation.category_type === 'vip'
        ? room.name
        : reservation.category_type === 'deux_chambres'
          ? '2 Chambres'
          : reservation.category_type === 'une_chambre'
            ? '1 Chambre'
            : room.name;

    return `Appartement N°${room.apartment_number} — ${label}`;
  }

  return categoryLabels[reservation.category_type || ''] || room?.name || 'Appartement';
};

export default function AdminDashboard() {
  const { user, loading: authLoading } = useAuth();
  const { showToast } = useToast();
  const router = useRouter();

  const [stats, setStats] = useState<AdminStatsResponse['stats'] | null>(null);
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('EN_ATTENTE');
  const [selectedRes, setSelectedRes] = useState<Reservation | null>(null);
  const [actionType, setActionType] = useState<'approve' | 'reject' | null>(null);
  const [adminNotes, setAdminNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!authLoading) {
      if (!user) {
        router.push('/auth/login');
      } else if (!user.is_admin) {
        router.push('/');
      }
    }
  }, [user, authLoading, router]);

  const loadDashboardData = useCallback(async () => {
    setLoading(true);
    try {
      const statsData = await api.getAdminStats();
      const resData = await api.getAdminReservations();
      setStats(statsData.stats);
      setReservations(resData.data);
    } catch (error) {
      console.error('Erreur lors du chargement du back-office:', error);
      showToast('Impossible de charger les donnees administrateur.', 'error');
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  useEffect(() => {
    if (user && user.is_admin) {
      loadDashboardData();
    }
  }, [user, loadDashboardData]);

  const handleOpenAction = (reservation: Reservation, type: 'approve' | 'reject') => {
    setSelectedRes(reservation);
    setActionType(type);
    setAdminNotes('');
    setError('');
  };

  const handleSubmitAction = async () => {
    if (!selectedRes || !actionType) return;
    if (actionType === 'reject' && !adminNotes.trim()) {
      setError('Un motif est obligatoire pour refuser une demande.');
      return;
    }

    setSubmitting(true);
    setError('');

    try {
      if (actionType === 'approve') {
        await api.approveReservation(selectedRes.id, { admin_notes: adminNotes });
        showToast('Demande confirmee. Le client peut payer la caution.', 'success');
      } else {
        await api.rejectReservation(selectedRes.id, { admin_notes: adminNotes });
        showToast('Demande refusee. Le client sera notifie.', 'success');
      }
      setSelectedRes(null);
      setActionType(null);
      loadDashboardData();
    } catch (err) {
      const message = err instanceof Error ? err.message : "L'action a echoue.";
      setError(message);
      showToast(message, 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const handleMarkRefunded = async (reservation: Reservation) => {
    setSubmitting(true);
    setError('');

    try {
      await api.markReservationRefunded(reservation.id);
      showToast('Remboursement marque comme effectue. Le client sera notifie.', 'success');
      loadDashboardData();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Le remboursement n'a pas pu etre confirme.";
      setError(message);
      showToast(message, 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const filtersList = [
    { key: 'all', label: 'Toutes' },
    { key: 'EN_ATTENTE', label: 'En attente' },
    { key: 'VALIDEE_PAIEMENT_REQUIS', label: 'Caution requise' },
    { key: 'CONFIRMEE', label: 'Confirmees' },
    { key: 'REFUSEE', label: 'Refusees' },
    { key: 'EXPIREE', label: 'Expirees' },
    { key: 'SEJOUR_PAYE', label: 'Sejours payes' },
    { key: 'ANNULEE', label: 'Annulees' },
    { key: 'REMBOURSEE', label: 'Remboursees' },
  ];

  const filteredReservations = reservations.filter((reservation) =>
    statusFilter === 'all' ? true : reservation.status === statusFilter
  );

  if (authLoading || loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-cream">
        <div className="h-12 w-12 animate-spin rounded-full border-4 border-bark border-t-transparent" />
      </div>
    );
  }

  return (
    <main className="min-h-screen bg-cream px-6 py-28 text-charcoal md:px-10 grain-layer">
      <div className="mx-auto max-w-7xl">
        <div className="mb-12 flex flex-col items-start justify-between gap-6 border-b border-bark/10 pb-8 md:flex-row md:items-center">
          <div>
            <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-bark/10 bg-bark/5 px-4 py-2 backdrop-blur-md">
              <Sparkles className="h-4 w-4 text-bark" />
              <span className="text-[10px] font-semibold uppercase tracking-widest text-bark">
                Portail Administrateur
              </span>
            </div>
            <h1 className="font-display text-4xl font-bold uppercase tracking-tight text-bark md:text-5xl">
              Tableau de Bord
            </h1>
          </div>

          <div className="flex flex-wrap gap-4 text-xs font-black uppercase tracking-wider">
            <Link href="/admin" className="border border-bark bg-bark px-5 py-3 text-cream transition">
              Reservations
            </Link>
            <Link href="/admin/rooms" className="border border-bark/20 px-5 py-3 text-bark/70 transition hover:border-bark hover:text-bark">
              Appartements
            </Link>
            <Link href="/admin/users" className="border border-bark/20 px-5 py-3 text-bark/70 transition hover:border-bark hover:text-bark">
              Utilisateurs
            </Link>
          </div>
        </div>

        {stats && (
          <div className="mb-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {[
              { label: "Taux d'occupation", value: `${stats.occupancy_rate}%`, icon: TrendingUp, note: `${stats.occupied_rooms_count} appartements occupes` },
              { label: "Chiffre d'affaires", value: `${Number(stats.total_revenue || 0).toLocaleString('fr-FR')} F`, icon: DollarSign, note: 'Paiements valides' },
              { label: 'Reservations', value: stats.total_reservations, icon: Calendar, note: 'Demandes recues' },
              { label: 'Utilisateurs', value: stats.total_users, icon: Users, note: 'Profils clients' },
            ].map((item) => (
              <div key={item.label} className="space-y-4 rounded-3xl border border-bark/10 bg-white p-6 shadow-sm">
                <div className="flex items-center justify-between text-charcoal/50">
                  <span className="text-[10px] font-semibold uppercase tracking-widest">{item.label}</span>
                  <item.icon size={16} />
                </div>
                <p className="font-display text-4xl font-bold text-bark">{item.value}</p>
                <p className="text-[10px] text-charcoal/40">{item.note}</p>
              </div>
            ))}
          </div>
        )}

        <div className="space-y-6">
          <div className="flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
            <h2 className="font-display text-2xl font-bold uppercase tracking-wider text-bark">Demandes de sejour</h2>
            <div className="flex items-center gap-2 rounded-xl border border-bark/10 bg-bark/5 px-3 py-1.5 text-xs text-charcoal/60">
              <Filter size={14} />
              <span>Filtres</span>
            </div>
          </div>

          <div className="flex gap-2 overflow-x-auto border-b border-bark/5 pb-4 text-xs font-semibold uppercase tracking-wider">
            {filtersList.map((filter) => (
              <button
                key={filter.key}
                onClick={() => setStatusFilter(filter.key)}
                className={`flex-shrink-0 rounded-full border px-4 py-2 transition ${
                  statusFilter === filter.key
                    ? 'border-bark bg-bark text-cream'
                    : 'border-bark/10 bg-transparent text-charcoal/50 hover:border-bark/20'
                }`}
              >
                {filter.label}
              </button>
            ))}
          </div>

          {filteredReservations.length === 0 ? (
            <div className="rounded-3xl border border-bark/10 bg-white py-20 text-center shadow-sm">
              <p className="text-sm text-charcoal/40">Aucune demande ne correspond a ce filtre.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {filteredReservations.map((reservation) => (
                <div key={reservation.id} className="flex flex-col justify-between gap-6 rounded-3xl border border-bark/10 bg-white p-6 transition-all duration-300 hover:border-bark/20 md:p-8 lg:flex-row shadow-sm">
                  <div className="flex-1 space-y-4">
                    <div className="flex flex-wrap items-center gap-3">
                      <span className="font-display text-lg font-bold uppercase text-bark">
                        {reservationApartmentLabel(reservation)}
                      </span>
                      <span className="text-[10px] uppercase tracking-widest text-charcoal/40">Ref #{reservation.id}</span>
                      <span className={`rounded border px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider ${statusClasses(reservation.status)}`}>
                        {statusLabels[reservation.status] || reservation.status}
                      </span>
                    </div>

                    <div className="grid gap-6 border-t border-bark/5 pt-2 text-xs text-charcoal/60 sm:grid-cols-3">
                      <div>
                        <span className="mb-1 block text-[9px] uppercase tracking-widest text-charcoal/30">Client</span>
                        <p className="font-semibold text-bark">{reservation.user?.name}</p>
                        <p className="text-charcoal/55">{reservation.user?.email}</p>
                      </div>
                      <div>
                        <span className="mb-1 block text-[9px] uppercase tracking-widest text-charcoal/30">Dates</span>
                        <p className="font-semibold text-bark">
                          Du {new Date(reservation.check_in).toLocaleDateString('fr-FR')} au {new Date(reservation.check_out).toLocaleDateString('fr-FR')}
                        </p>
                        <p className="text-charcoal/55">{reservation.room?.type || reservation.category_type}</p>
                      </div>
                      <div>
                        <span className="mb-1 block text-[9px] uppercase tracking-widest text-charcoal/30">Caution / sejour</span>
                        <p className="text-sm font-bold text-bark">{(reservation.deposit_amount ?? reservation.total_price).toLocaleString('fr-FR')} FCFA</p>
                        <p className="text-charcoal/55">{(reservation.stay_amount ?? 0).toLocaleString('fr-FR')} FCFA sejour</p>
                        {(reservation.status === 'ANNULEE' || reservation.status === 'REMBOURSEE') && (
                          <p className="mt-1 font-semibold text-orange-700">
                            A rembourser : {(reservation.cancellation_refund_amount ?? 0).toLocaleString('fr-FR')} FCFA
                          </p>
                        )}
                      </div>
                    </div>

                    {reservation.special_requests && (
                      <div className="rounded-xl border border-bark/5 bg-bark/5 p-3 text-xs text-charcoal/60">
                        <span className="mb-1 block text-[9px] font-bold uppercase tracking-wider text-charcoal/70">Demande client</span>
                        {reservation.special_requests}
                      </div>
                    )}
                  </div>

                  <div className="flex min-w-[180px] flex-row items-center justify-end gap-3 border-bark/5 lg:flex-col lg:border-l lg:pl-6">
                    {reservation.status === 'EN_ATTENTE' ? (
                      <>
                        <button
                          type="button"
                          onClick={() => handleOpenAction(reservation, 'approve')}
                          className="flex w-full items-center justify-center gap-2 bg-bark py-3 text-[10px] font-black uppercase tracking-widest text-cream transition hover:bg-bark/95 rounded-xl"
                        >
                          <Check size={14} />
                          Confirmer
                        </button>
                        <button
                          type="button"
                          onClick={() => handleOpenAction(reservation, 'reject')}
                          className="flex w-full items-center justify-center gap-2 border border-red-600/20 py-3 text-[10px] font-black uppercase tracking-widest text-red-600 transition hover:bg-red-600/10 rounded-xl"
                        >
                          <X size={14} />
                          Rejeter
                        </button>
                      </>
                    ) : reservation.status === 'ANNULEE' ? (
                      <button
                        type="button"
                        disabled={submitting}
                        onClick={() => handleMarkRefunded(reservation)}
                        className="flex w-full items-center justify-center gap-2 rounded-xl bg-bark py-3 text-[10px] font-black uppercase tracking-widest text-cream transition hover:bg-bark/95 disabled:opacity-50"
                      >
                        <RefreshCcw size={14} />
                        Remboursement effectue
                      </button>
                    ) : (
                      <div className="py-4 text-xs italic text-charcoal/30">Traitee</div>
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
              className="absolute inset-0 bg-bark/60 backdrop-blur-md"
            />

            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative w-full max-w-lg rounded-3xl border border-bark/10 bg-cream p-8 shadow-2xl text-charcoal"
            >
              <div className="space-y-6">
                <div>
                  <h3 className="font-display text-2xl font-bold uppercase tracking-wide text-bark">
                    {actionType === 'approve' ? 'Confirmer la demande' : 'Rejeter la demande'}
                  </h3>
                  <p className="mt-1 text-[10px] uppercase tracking-widest text-charcoal/50">
                    Reservation #{selectedRes.id} - {selectedRes.user?.name}
                  </p>
                </div>

                <div className="space-y-2 rounded-2xl border border-bark/5 bg-bark/5 p-4 text-xs text-charcoal/70">
                  <p><strong>Appartement :</strong> {reservationApartmentLabel(selectedRes)}</p>
                  <p><strong>Dates :</strong> du {selectedRes.check_in} au {selectedRes.check_out}</p>
                  <p><strong>Caution :</strong> {(selectedRes.deposit_amount ?? selectedRes.total_price).toLocaleString('fr-FR')} FCFA</p>
                </div>

                <label className="block">
                  <span className="mb-2 block text-[10px] font-semibold uppercase tracking-wider text-bark/60">
                    {actionType === 'approve' ? 'Notes facultatives' : 'Motif du rejet obligatoire'}
                  </span>
                  <textarea
                    rows={4}
                    value={adminNotes}
                    onChange={(event) => setAdminNotes(event.target.value)}
                    className="w-full resize-none rounded-xl border border-bark/15 bg-transparent p-4 text-sm text-charcoal outline-none transition-all placeholder:text-charcoal/20 focus:border-bark"
                  />
                </label>

                {error && <p className="text-xs font-semibold text-red-600">{error}</p>}

                <div className="flex gap-3 border-t border-bark/5 pt-4">
                  <button
                    type="button"
                    disabled={submitting}
                    onClick={() => setSelectedRes(null)}
                    className="flex-1 rounded-xl border border-bark/10 py-4 text-xs font-bold uppercase tracking-wider text-charcoal/70 transition hover:bg-bark/5 disabled:opacity-50"
                  >
                    Annuler
                  </button>
                  <button
                    type="button"
                    disabled={submitting}
                    onClick={handleSubmitAction}
                    className={`flex-1 rounded-xl py-4 text-xs font-black uppercase tracking-[0.2em] transition disabled:opacity-50 ${
                      actionType === 'approve'
                        ? 'bg-bark text-cream hover:bg-bark/90'
                        : 'bg-red-600 text-white hover:bg-red-500'
                    }`}
                  >
                    {submitting ? 'Envoi...' : 'Confirmer'}
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
