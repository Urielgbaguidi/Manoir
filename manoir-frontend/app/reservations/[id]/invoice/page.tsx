'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import Image from 'next/image';
import Link from 'next/link';
import { api, Payment, Reservation } from '@/lib/api';
import { useAuth } from '@/context/AuthContext';

type DocumentType = 'booking' | 'deposit' | 'stay-voucher' | 'stay' | 'cancellation';

const documentLabels: Record<DocumentType, string> = {
  booking: 'Bon de Réservation',
  deposit: 'Facture Caution',
  'stay-voucher': 'Bon du Séjour',
  stay: 'Facture Séjour',
  cancellation: "Bon d'Annulation",
};

const categoryLabels: Record<string, string> = {
  vip: 'Appartement VIP',
  deux_chambres: 'Appartement 2 Chambres',
  une_chambre: 'Appartement 1 Chambre',
};

const hotel = {
  name: 'LE MANOIR',
  tagline: 'Ce lieu a été façonné par des mains, porté par des cœurs...',
  address: 'Cotonou, Bénin',
  phone: '+229 01 00 00 00 00',
  email: 'contact@manoir.com',
};

const formatCurrency = (value = 0) => `${Number(value || 0).toLocaleString('fr-FR')} FCFA`;

const parseReservationDate = (value?: string) => {
  if (!value) return null;

  const datePart = value.slice(0, 10);
  if (/^\d{4}-\d{2}-\d{2}$/.test(datePart)) {
    const [year, month, day] = datePart.split('-').map(Number);
    return new Date(year, month - 1, day);
  }

  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
};

const formatReservationDate = (value?: string) =>
  parseReservationDate(value)?.toLocaleDateString('fr-FR') || 'Date indisponible';

const formatReservationDateTime = (value?: string) =>
  parseReservationDate(value)?.toLocaleString('fr-FR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }) || 'Date indisponible';

const diffDays = (from?: string, to?: string) => {
  const start = parseReservationDate(from);
  const end = parseReservationDate(to);

  if (!start || !end) return 0;

  return Math.max(0, Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)));
};

const countNights = (checkIn?: string, checkOut?: string) =>
  Math.max(1, diffDays(checkIn, checkOut));

const formatPaymentMethod = (payment?: Payment) => {
  if (!payment) return 'Non renseigné';

  const method = payment.payment_method === 'card' ? 'Carte bancaire' : 'Mobile Money';
  const provider = payment.provider === 'kkiapay' ? 'KKiaPay' : 'FedaPay';

  return `${method} (${provider})`;
};

const documentNumber = (reservation: Reservation, type: DocumentType, payment?: Payment) => {
  const year = parseReservationDate(reservation.created_at)?.getFullYear() || new Date().getFullYear();
  const sequence = reservation.id.toString().padStart(5, '0');

  if (type === 'deposit') {
    return reservation.deposit_invoice_number || payment?.invoice_number || `FAC-${year}-${sequence}`;
  }

  if (type === 'stay') {
    return reservation.stay_invoice_number || payment?.invoice_number || `FAC-SEJ-${year}-${sequence}`;
  }

  if (type === 'stay-voucher') {
    return `BON-SEJ-${year}-${sequence}`;
  }

  if (type === 'cancellation') {
    return reservation.cancellation_document_number || `ANN-${year}-${sequence}`;
  }

  return `BON-RES-${year}-${sequence}`;
};

const apartmentLabel = (reservation: Reservation) => {
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

export default function ReservationInvoicePage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const [reservation, setReservation] = useState<Reservation | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const requestedType = searchParams.get('type') as DocumentType | null;
  const documentType: DocumentType = requestedType && requestedType in documentLabels ? requestedType : 'booking';

  useEffect(() => {
    if (authLoading) return;

    if (!user) {
      router.push('/auth/login');
      return;
    }

    async function loadData() {
      try {
        const reservationId = Array.isArray(params.id) ? params.id[0] : params.id;

        if (!reservationId || typeof reservationId !== 'string') {
          throw new Error('ID de réservation manquant.');
        }

        const reservationData = await api.getReservation(reservationId);
        setReservation(reservationData);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Erreur lors du chargement du document.');
      } finally {
        setLoading(false);
      }
    }

    loadData();
  }, [authLoading, params.id, router, user]);

  if (authLoading || loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="mx-auto h-12 w-12 animate-spin rounded-full border-b-2 border-amber-600" />
          <p className="mt-4 text-gray-600">Chargement du document...</p>
        </div>
      </div>
    );
  }

  if (error || !reservation) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50">
        <div className="text-center">
          <p className="mb-4 text-red-600">{error || 'Document non trouvé.'}</p>
          <Link href="/reservations" className="text-amber-700 underline">
            Retour à mes réservations
          </Link>
        </div>
      </div>
    );
  }

  const title = apartmentLabel(reservation);
  const isDepositDocument = documentType === 'booking' || documentType === 'deposit';
  const isCancellationDocument = documentType === 'cancellation';
  const isInvoice = documentType === 'deposit' || documentType === 'stay';
  const paymentType = documentType === 'stay' ? 'stay' : 'deposit';
  const paidPayment = reservation.payments?.find((payment) => payment.payment_type === paymentType && payment.status === 'success');
  const nights = countNights(reservation.check_in, reservation.check_out);
  const depositAmount = reservation.deposit_amount ?? reservation.total_price;
  const depositRate = reservation.deposit_daily_rate ?? 0;
  const depositDays = depositRate > 0 ? Math.round(depositAmount / depositRate) : diffDays(reservation.created_at, reservation.check_in);
  const stayAmount = reservation.stay_amount ?? 0;
  const stayUnitPrice = nights > 0 ? stayAmount / nights : 0;
  const cancellationRefund = reservation.cancellation_refund_amount ?? 0;
  const cancellationRetained = reservation.cancellation_retained_amount ?? 0;
  const cancellationDays = reservation.cancellation_consumed_days ?? 0;
  const totalNet = isCancellationDocument ? cancellationRefund : isDepositDocument ? depositAmount : stayAmount;
  const lineDescription = isCancellationDocument
    ? 'Remboursement après annulation'
    : isDepositDocument
      ? 'Caution de réservation'
      : 'Frais de séjour';
  const calculation = isCancellationDocument
    ? `${cancellationDays} jour${cancellationDays > 1 ? 's' : ''} consommé${cancellationDays > 1 ? 's' : ''} - retenue ${formatCurrency(cancellationRetained)}`
    : isDepositDocument
      ? `${depositDays} jour${depositDays > 1 ? 's' : ''} x ${formatCurrency(depositRate)}`
      : `${nights} nuit${nights > 1 ? 's' : ''} x ${formatCurrency(stayUnitPrice)}`;
  const unitPrice = isCancellationDocument ? depositRate : isDepositDocument ? depositRate : stayUnitPrice;
  const quantity = isCancellationDocument ? cancellationDays : isDepositDocument ? depositDays : nights;
  const client = reservation.user || user;
  const generatedNumber = documentNumber(reservation, documentType, paidPayment);
  const fallbackInvoiceDate = documentType === 'stay' ? reservation.stay_paid_at : reservation.paid_at;
  const documentDate = isInvoice && paidPayment?.paid_at
    ? formatReservationDateTime(paidPayment.paid_at)
    : isInvoice
      ? formatReservationDateTime(fallbackInvoiceDate || new Date().toISOString())
      : formatReservationDate(isCancellationDocument ? reservation.cancelled_at || new Date().toISOString() : reservation.created_at);
  const isStayDocument = documentType === 'stay-voucher' || documentType === 'stay';
  const theme = isCancellationDocument
    ? {
        text: 'text-orange-700',
        hoverText: 'hover:text-orange-800',
        button: 'bg-orange-700 hover:bg-orange-800',
        border: 'border-orange-700',
        header: 'bg-gradient-to-r from-orange-50 to-amber-50',
        notice: 'border-orange-100 bg-orange-50',
        footer: 'bg-gradient-to-r from-orange-700 to-amber-700',
      }
    : {
        text: 'text-amber-700',
        hoverText: 'hover:text-amber-800',
        button: 'bg-amber-700 hover:bg-amber-800',
        border: 'border-amber-700',
        header: 'bg-gradient-to-r from-amber-50 to-orange-50',
        notice: 'border-amber-100 bg-amber-50',
        footer: 'bg-gradient-to-r from-amber-700 to-orange-700',
      };

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="mx-auto mb-4 max-w-4xl px-4 print:hidden">
        <div className="flex items-center justify-between">
          <Link href="/reservations" className={`flex items-center gap-2 ${theme.text} ${theme.hoverText}`}>
            Retour aux réservations
          </Link>
          <button
            onClick={() => window.print()}
            className={`rounded-lg px-6 py-2 text-white transition-colors ${theme.button}`}
          >
            Imprimer / PDF
          </button>
        </div>
      </div>

      <div className="mx-auto max-w-4xl bg-white shadow-lg print:shadow-none">
        <div className={`border-b-4 p-8 ${theme.border} ${theme.header}`}>
          <div className="flex flex-col gap-8 md:flex-row md:items-start md:justify-between">
            <div className="flex items-center gap-6">
              <div className="h-28 w-28 flex-shrink-0">
                <Image
                  src="/assets/logo.jpg"
                  alt="Logo Le Manoir"
                  width={112}
                  height={112}
                  className="h-full w-full object-contain"
                />
              </div>
              <div>
                <h1 className="mb-2 text-4xl font-bold text-gray-900">{hotel.name}</h1>
                <p className="mb-4 text-gray-600 italic">{hotel.tagline}</p>
                <div className="space-y-1 text-sm text-gray-700">
                  <p>{hotel.address}</p>
                  <p>{hotel.phone}</p>
                  <p>{hotel.email}</p>
                </div>
              </div>
            </div>

            <div className="md:text-right">
              <h2 className={`mb-3 text-3xl font-bold ${theme.text}`}>{documentLabels[documentType]}</h2>
              <div className="rounded-lg bg-white p-4 shadow-sm">
                <p className="text-sm text-gray-600">Numéro</p>
                <p className="text-lg font-bold text-gray-900">{generatedNumber}</p>
                <p className="mt-2 text-sm text-gray-600">{isInvoice ? 'Date et heure de délivrance' : 'Date'}</p>
                <p className="font-semibold text-gray-900">{documentDate}</p>
              </div>
            </div>
          </div>
        </div>

        <div className="grid gap-8 p-8 md:grid-cols-2">
          <div>
            <h3 className={`mb-4 border-b-2 pb-2 text-lg font-semibold text-gray-900 ${theme.border}`}>
              Client
            </h3>
            <div className="space-y-2 text-gray-700">
              <p className="text-xl font-bold text-gray-900">{client?.name || 'Client'}</p>
              <p>Téléphone : {client?.phone || 'Non renseigné'}</p>
              <p>Email : {client?.email || 'Non renseigné'}</p>
            </div>
          </div>

          <div>
            <h3 className={`mb-4 border-b-2 pb-2 text-lg font-semibold text-gray-900 ${theme.border}`}>
              Détails du séjour
            </h3>
            <div className="space-y-2 text-gray-700">
              <p className="text-lg font-semibold text-gray-900">{title}</p>
              <p>Arrivée : {formatReservationDate(reservation.check_in)}</p>
              <p>Départ : {formatReservationDate(reservation.check_out)}</p>
              <p>Durée : {nights} nuit{nights > 1 ? 's' : ''}</p>
              <p>Date de demande : {formatReservationDate(reservation.created_at)}</p>
              {isCancellationDocument && (
                <>
                  <p>Date d'annulation : {formatReservationDate(reservation.cancelled_at || new Date().toISOString())}</p>
                  <p>Caution initiale : {formatCurrency(depositAmount)}</p>
                  <p>Délai de remboursement : 48h à 72h</p>
                </>
              )}
            </div>
          </div>
        </div>

        <div className="px-8 pb-8">
          <h3 className={`mb-4 border-b-2 pb-2 text-lg font-semibold text-gray-900 ${theme.border}`}>
            Calcul
          </h3>

          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Description</th>
                  <th className="px-4 py-3 text-center text-sm font-semibold text-gray-700">
                    {isDepositDocument ? 'Nombre de jours' : isStayDocument ? 'Nombre de nuits' : 'Jours consommés'}
                  </th>
                  <th className="px-4 py-3 text-right text-sm font-semibold text-gray-700">Prix unitaire</th>
                  <th className="px-4 py-3 text-right text-sm font-semibold text-gray-700">Montant</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                <tr>
                  <td className="px-4 py-4 text-gray-900">
                    <p className="font-semibold">{lineDescription}</p>
                    <p className="mt-1 text-sm text-gray-500">{calculation}</p>
                  </td>
                  <td className="px-4 py-4 text-center text-gray-900">{quantity}</td>
                  <td className="px-4 py-4 text-right text-gray-900">{formatCurrency(unitPrice)}</td>
                  <td className="px-4 py-4 text-right font-semibold text-gray-900">{formatCurrency(totalNet)}</td>
                </tr>
              </tbody>
            </table>
          </div>

          <div className="mt-6 flex justify-end">
            <div className={`w-full border-t-2 pt-3 md:w-96 ${theme.border}`}>
              <div className="flex justify-between text-xl font-bold text-gray-900">
                <span>Total net</span>
                <span className={theme.text}>{formatCurrency(totalNet)}</span>
              </div>
            </div>
          </div>
        </div>

        {isInvoice && (
          <div className="border-t bg-gray-50 p-8">
            <h3 className="mb-4 text-lg font-semibold text-gray-900">Informations de paiement</h3>
            <div className="grid gap-4 text-sm md:grid-cols-3">
              <div>
                <p className="text-gray-600">Mode de paiement</p>
                <p className="font-semibold text-gray-900">{formatPaymentMethod(paidPayment)}</p>
              </div>
              <div>
                <p className="text-gray-600">Type de paiement</p>
                <p className="font-semibold text-gray-900">{documentType === 'deposit' ? 'Caution' : 'Séjour'}</p>
              </div>
              <div>
                <p className="text-gray-600">Transaction</p>
                <p className="font-semibold text-gray-900">{paidPayment?.transaction_id || 'Non renseignée'}</p>
              </div>
            </div>
          </div>
        )}

        {!isInvoice && (
          <div className="px-8 pb-8">
            <div className={`rounded-xl border-2 p-6 text-sm leading-relaxed text-gray-700 ${theme.notice}`}>
              {documentType === 'booking'
                ? 'Ce bon confirme que votre demande a été acceptée. Le paiement de la caution reste nécessaire pour confirmer définitivement la réservation.'
                : documentType === 'cancellation'
                  ? 'Ce bon confirme l annulation de votre reservation et le montant a rembourser dans un delai de 48h a 72h.'
                  : 'Ce bon présente le montant du séjour à régler depuis votre espace client.'}
            </div>
          </div>
        )}

        <div className={`p-6 text-center text-white ${theme.footer}`}>
          <p className="mb-2 text-sm">Merci de votre confiance.</p>
          <p className="text-xs opacity-90">{hotel.name} - {hotel.address} - {hotel.phone}</p>
          <p className="mt-1 text-xs opacity-90">{hotel.email}</p>
        </div>
      </div>

      <style jsx global>{`
        @media print {
          body {
            background: white;
          }
          .print\\:hidden {
            display: none !important;
          }
          .print\\:shadow-none {
            box-shadow: none !important;
          }
        }
      `}</style>
    </div>
  );
}
