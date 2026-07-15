'use client';

import { useCallback, useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Calendar,
  Check,
  Clock,
  Download,
  FileText,
  Settings,
  Sparkles,
  XCircle,
} from 'lucide-react';
import { ApiError, api, Reservation } from '@/lib/api';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/context/ToastContext';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

type PaymentType = 'deposit' | 'stay';
type PaymentStep = 'processing' | 'success' | 'failed';

const categoryLabels: Record<string, string> = {
  vip: 'Appartement VIP',
  deux_chambres: 'Appartement 2 Chambres',
  une_chambre: 'Appartement 1 Chambre',
};

const statusLabels: Record<string, string> = {
  EN_ATTENTE: 'Votre demande est en cours d\'examen',
  VALIDEE_PAIEMENT_REQUIS: 'Caution a regler',
  CONFIRMEE: 'Reservation confirmee',
  REFUSEE: 'Demande refusee',
  EXPIREE: 'Delai de paiement expire',
  SEJOUR_PAYE: 'Sejour paye',
  ANNULEE: 'Reservation annulee',
  REMBOURSEE: 'Remboursement effectue',
  LIBEREE: 'Appartement libere par l\'administration',
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

const formatReservationDate = (value: string) =>
  parseReservationDate(value)?.toLocaleDateString('fr-FR') || 'Date indisponible';

const formatReservationDateTime = (value?: string) =>
  parseReservationDate(value)?.toLocaleString('fr-FR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }) || 'Date indisponible';

const countNights = (checkIn: string, checkOut: string) => {
  const start = parseReservationDate(checkIn);
  const end = parseReservationDate(checkOut);

  if (!start || !end) return 0;

  return Math.max(1, Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)));
};

const diffDays = (from?: string, to?: string) => {
  const start = parseReservationDate(from);
  const end = parseReservationDate(to);

  if (!start || !end) return 0;

  return Math.max(0, Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)));
};

const todayDateString = () => {
  const today = new Date();
  return `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
};

const dateInputValue = (date: Date) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;

const addDays = (date: Date, days: number) => {
  const nextDate = new Date(date);
  nextDate.setDate(nextDate.getDate() + days);
  return nextDate;
};

const paymentCountdown = (deadline?: string, approvedAt?: string, nowMs = Date.now()) => {
  if (!deadline) return null;

  const deadlineMs = new Date(deadline).getTime();
  if (Number.isNaN(deadlineMs)) return null;

  const approvedMs = approvedAt ? new Date(approvedAt).getTime() : deadlineMs - 24 * 60 * 60 * 1000;
  const totalMs = Math.max(1, deadlineMs - (Number.isNaN(approvedMs) ? deadlineMs - 24 * 60 * 60 * 1000 : approvedMs));
  const remainingMs = Math.max(0, deadlineMs - nowMs);
  const totalSeconds = Math.floor(remainingMs / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  const percent = Math.max(0, Math.min(100, (remainingMs / totalMs) * 100));

  return {
    expired: remainingMs <= 0,
    hours,
    minutes,
    seconds,
    percent,
    isUrgent: remainingMs > 0 && remainingMs <= 2 * 60 * 60 * 1000,
  };
};

const hasArrivalDateReached = (reservation: Reservation, nowMs = Date.now()) => {
  const arrivalDate = parseReservationDate(reservation.check_in);

  return Boolean(arrivalDate && nowMs >= arrivalDate.getTime());
};

const isDepositPaymentExpired = (reservation: Reservation, nowMs = Date.now()) =>
  reservation.status === 'VALIDEE_PAIEMENT_REQUIS'
  && (
    Boolean(paymentCountdown(reservation.payment_deadline, reservation.approved_at, nowMs)?.expired)
    || hasArrivalDateReached(reservation, nowMs)
  );

const effectiveReservationStatus = (reservation: Reservation, nowMs = Date.now()): Reservation['status'] =>
  isDepositPaymentExpired(reservation, nowMs) ? 'EXPIREE' : reservation.status;

export default function ReservationsPage() {
  const { user, loading: authLoading } = useAuth();
  const { showToast } = useToast();
  const router = useRouter();
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'active' | 'history'>('active');
  const [activeReservation, setActiveReservation] = useState<Reservation | null>(null);
  const [activePaymentType, setActivePaymentType] = useState<PaymentType>('deposit');
  const [paymentStep, setPaymentStep] = useState<PaymentStep>('processing');
  const [paymentError, setPaymentError] = useState('');
  const [processingText, setProcessingText] = useState('');
  const [cancellingReservation, setCancellingReservation] = useState<Reservation | null>(null);
  const [cancelling, setCancelling] = useState(false);
  const [extensionReservation, setExtensionReservation] = useState<Reservation | null>(null);
  const [extensionDate, setExtensionDate] = useState('');
  const [requestingExtension, setRequestingExtension] = useState(false);
  const [extensionError, setExtensionError] = useState('');
  const [nowMs, setNowMs] = useState(() => Date.now());

  useEffect(() => {
    if (!authLoading && !user) {
      router.push('/auth/login');
    }
  }, [user, authLoading, router]);

  const loadReservations = useCallback(async () => {
    try {
      const data = await api.getMyReservations();
      setReservations(data);
    } catch (error) {
      if (error instanceof ApiError && error.status === 401) {
        router.push('/auth/login?message=session-expired&redirect=/espace-client');
        return;
      }
      showToast('Impossible de charger vos reservations.', 'error');
    } finally {
      setLoading(false);
    }
  }, [router, showToast]);

  useEffect(() => {
    if (user) {
      loadReservations();
    }
  }, [user, loadReservations]);

  useEffect(() => {
    const timer = window.setInterval(() => {
      setNowMs(Date.now());
    }, 1000);

    return () => window.clearInterval(timer);
  }, []);

  const getReservationTitle = (reservation: Reservation) => {
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

  const getPaymentAmount = (reservation: Reservation, type: PaymentType) =>
    type === 'deposit'
      ? reservation.deposit_amount ?? reservation.total_price
      : reservation.stay_amount ?? 0;

  const cancellationPreview = (reservation: Reservation) => {
    const depositAmount = reservation.status === 'CONFIRMEE' ? reservation.deposit_amount ?? reservation.total_price : 0;
    const dailyRate = reservation.deposit_daily_rate ?? 0;
    const cancellationDate = todayDateString();
    const consumedDays = diffDays(reservation.created_at, cancellationDate);

    if (reservation.status !== 'CONFIRMEE') {
      return {
        depositAmount: 0,
        consumedDays: 0,
        retainedAmount: 0,
        refundAmount: 0,
        cancellationDate,
      };
    }

    if (diffDays(reservation.check_in, cancellationDate) > 0 || cancellationDate >= reservation.check_in.slice(0, 10)) {
      return {
        depositAmount,
        consumedDays,
        retainedAmount: depositAmount,
        refundAmount: 0,
        cancellationDate,
      };
    }

    const retainedAmount = Math.min(depositAmount, consumedDays * dailyRate);

    return {
      depositAmount,
      consumedDays,
      retainedAmount,
      refundAmount: Math.max(0, depositAmount - retainedAmount),
      cancellationDate,
    };
  };

  const canCancelReservation = (reservation: Reservation) => {
    const statusAllowsCancellation = ['EN_ATTENTE', 'VALIDEE_PAIEMENT_REQUIS', 'CONFIRMEE'].includes(effectiveReservationStatus(reservation, nowMs));
    const arrivalDate = reservation.check_in.slice(0, 10);

    return statusAllowsCancellation && todayDateString() < arrivalDate;
  };

  const extensionMinimumDate = (reservation: Reservation) => {
    const checkoutDate = parseReservationDate(reservation.check_out);
    return checkoutDate ? dateInputValue(addDays(checkoutDate, 1)) : '';
  };

  const canRequestStayExtension = (reservation: Reservation) => {
    if (reservation.status !== 'CONFIRMEE' || hasStayInvoice(reservation) || reservation.extension_status === 'EN_ATTENTE') {
      return false;
    }

    const checkIn = parseReservationDate(reservation.check_in);
    const checkOut = parseReservationDate(reservation.check_out);

    if (!checkIn || !checkOut) return false;

    const today = todayDateString();
    const firstEligibleDay = dateInputValue(addDays(checkIn, 1));
    const checkoutDay = dateInputValue(checkOut);

    return today >= firstEligibleDay && today < checkoutDay;
  };

  const extensionPreview = (reservation: Reservation, nextCheckOut = extensionDate) => {
    const currentNights = countNights(reservation.check_in, reservation.check_out);
    const newNights = nextCheckOut ? countNights(reservation.check_in, nextCheckOut) : currentNights;
    const pricePerNight = Number(reservation.room?.base_price || (currentNights ? (reservation.stay_amount || 0) / currentNights : 0));

    return {
      currentNights,
      newNights,
      additionalNights: Math.max(0, newNights - currentNights),
      newStayAmount: Math.max(0, newNights * pricePerNight),
    };
  };

  const openExtensionModal = (reservation: Reservation) => {
    const minimumDate = extensionMinimumDate(reservation);
    setExtensionReservation(reservation);
    setExtensionDate(minimumDate);
    setExtensionError('');
  };

  const handleSubmitExtension = async () => {
    if (!extensionReservation) return;

    if (!extensionDate || extensionDate <= extensionReservation.check_out.slice(0, 10)) {
      setExtensionError('Choisissez une nouvelle date de depart apres la date actuelle.');
      return;
    }

    setRequestingExtension(true);
    setExtensionError('');

    try {
      const response = await api.requestStayExtension(extensionReservation.id.toString(), extensionDate);
      setReservations((currentReservations) =>
        currentReservations.map((reservation) =>
          reservation.id === response.reservation.id ? response.reservation : reservation
        )
      );
      showToast('Votre demande de prolongation a ete envoyee a l\'administrateur.', 'success');
      setExtensionReservation(null);
    } catch (error) {
      setExtensionError(error instanceof Error ? error.message : 'La demande de prolongation a echoue.');
    } finally {
      setRequestingExtension(false);
    }
  };

  const handleConfirmCancellation = async () => {
    if (!cancellingReservation) return;

    setCancelling(true);
    try {
      const response = await api.cancelReservation(cancellingReservation.id.toString());
      setReservations((currentReservations) =>
        currentReservations.map((reservation) =>
          reservation.id === response.reservation.id ? response.reservation : reservation
        )
      );
      showToast('Votre reservation a ete annulee.', 'success');
      setCancellingReservation(null);
    } catch (error) {
      showToast(error instanceof Error ? error.message : "L'annulation a echoue.", 'error');
    } finally {
      setCancelling(false);
    }
  };

  const successfulPayment = (reservation: Reservation, type: PaymentType) =>
    reservation.payments?.find((payment) => payment.payment_type === type && payment.status === 'success');

  const hasDepositInvoice = (reservation: Reservation) =>
    Boolean(reservation.deposit_invoice_number || successfulPayment(reservation, 'deposit')?.invoice_number);

  const hasStayInvoice = (reservation: Reservation) =>
    Boolean(reservation.stay_invoice_number || successfulPayment(reservation, 'stay')?.invoice_number);

  const invoiceNumber = (reservation: Reservation, type: PaymentType) => {
    const year = parseReservationDate(reservation.created_at)?.getFullYear() || new Date().getFullYear();
    const sequence = reservation.id.toString().padStart(5, '0');

    if (type === 'stay') {
      return reservation.stay_invoice_number || successfulPayment(reservation, 'stay')?.invoice_number || `FAC-SEJ-${year}-${sequence}`;
    }

    return reservation.deposit_invoice_number || successfulPayment(reservation, 'deposit')?.invoice_number || `FAC-${year}-${sequence}`;
  };

  const svgEscape = (value: string) =>
    value
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');

  const fetchAssetDataUrl = async (src: string) => {
    const response = await fetch(src);
    const blob = await response.blob();

    return new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result));
      reader.onerror = () => reject(reader.error);
      reader.readAsDataURL(blob);
    });
  };

  const loadImage = (src: string) =>
    new Promise<HTMLImageElement>((resolve, reject) => {
      const image = new Image();
      image.onload = () => resolve(image);
      image.onerror = reject;
      image.src = src;
    });

  const dataUrlToBytes = (dataUrl: string) => {
    const base64 = dataUrl.split(',')[1] || '';
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);

    for (let index = 0; index < binary.length; index += 1) {
      bytes[index] = binary.charCodeAt(index);
    }

    return bytes;
  };

  const createPdfFromJpeg = (jpegBytes: Uint8Array, width: number, height: number) => {
    const encoder = new TextEncoder();
    const parts: BlobPart[] = [];
    const offsets: number[] = [];
    let size = 0;

    const addBytes = (bytes: Uint8Array) => {
      const copy = new Uint8Array(bytes.byteLength);
      copy.set(bytes);
      parts.push(copy);
      size += copy.byteLength;
    };

    const addText = (text: string) => addBytes(encoder.encode(text));

    const addObject = (body: string | Uint8Array, before = '', after = '') => {
      offsets.push(size);
      addText(`${offsets.length} 0 obj\n${before}`);
      if (typeof body === 'string') {
        addText(body);
      } else {
        addBytes(body);
      }
      addText(`${after}\nendobj\n`);
    };

    addText('%PDF-1.4\n');
    addObject('<< /Type /Catalog /Pages 2 0 R >>\n');
    addObject('<< /Type /Pages /Kids [3 0 R] /Count 1 >>\n');
    addObject('<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /XObject << /Im1 5 0 R >> >> /Contents 4 0 R >>\n');
    addObject('q 595 0 0 842 0 0 cm /Im1 Do Q\n', '<< /Length 33 >>\nstream\n', 'endstream');
    addObject(jpegBytes, `<< /Type /XObject /Subtype /Image /Width ${width} /Height ${height} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${jpegBytes.length} >>\nstream\n`, '\nendstream');

    const xrefOffset = size;
    addText(`xref\n0 ${offsets.length + 1}\n0000000000 65535 f \n`);
    offsets.forEach((offset) => addText(`${offset.toString().padStart(10, '0')} 00000 n \n`));
    addText(`trailer\n<< /Size ${offsets.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`);

    return new Blob(parts, { type: 'application/pdf' });
  };

  const buildInvoiceSvg = (reservation: Reservation, type: PaymentType, logoDataUrl: string) => {
    const isStay = type === 'stay';
    const accent = '#b45309';
    const footerEnd = '#c2410c';
    const headerStart = '#fff7ed';
    const headerEnd = '#ffedd5';
    const title = isStay ? 'Facture Séjour' : 'Facture Caution';
    const amount = getPaymentAmount(reservation, type);
    const nights = countNights(reservation.check_in, reservation.check_out);
    const unitPrice = isStay ? (nights > 0 ? amount / nights : 0) : reservation.deposit_daily_rate ?? 0;
    const quantity = isStay
      ? `${nights} nuit${nights > 1 ? 's' : ''}`
      : `${unitPrice > 0 ? Math.round(amount / unitPrice) : 0} jour(s)`;
    const client = reservation.user || user;
    const documentDate = formatReservationDateTime(isStay ? reservation.stay_paid_at || new Date().toISOString() : reservation.paid_at || new Date().toISOString());
    const description = isStay ? 'Frais de séjour' : 'Caution de réservation';
    const titleText = svgEscape(title);
    const numberText = svgEscape(invoiceNumber(reservation, type));
    const clientName = svgEscape(client?.name || 'Client');
    const clientPhone = svgEscape(client?.phone || 'Non renseigné');
    const clientEmail = svgEscape(client?.email || 'Non renseigné');
    const apartment = svgEscape(getReservationTitle(reservation));
    const arrival = svgEscape(formatReservationDate(reservation.check_in));
    const departure = svgEscape(formatReservationDate(reservation.check_out));
    const requestDate = svgEscape(formatReservationDate(reservation.created_at));
    const calculation = svgEscape(`${quantity} × ${formatCurrency(unitPrice)}`);
    const total = svgEscape(formatCurrency(amount));
    const detailsDateLines = isStay
      ? `
        <text x="660" y="532" font-family="Arial, sans-serif" font-size="22" fill="#374151">Arrivée : ${arrival}</text>
        <text x="660" y="570" font-family="Arial, sans-serif" font-size="22" fill="#374151">Départ : ${departure}</text>
        <text x="660" y="608" font-family="Arial, sans-serif" font-size="22" fill="#374151">Durée : ${nights} nuit${nights > 1 ? 's' : ''}</text>
        <text x="660" y="646" font-family="Arial, sans-serif" font-size="22" fill="#374151">Date de demande : ${requestDate}</text>
      `
      : `
        <text x="660" y="532" font-family="Arial, sans-serif" font-size="22" fill="#374151">Date de demande : ${requestDate}</text>
        <text x="660" y="570" font-family="Arial, sans-serif" font-size="22" fill="#374151">Arrivée : ${arrival}</text>
      `;

    return `
      <svg xmlns="http://www.w3.org/2000/svg" width="1240" height="1754" viewBox="0 0 1240 1754">
        <defs>
          <linearGradient id="headerGradient" x1="0" x2="1" y1="0" y2="0">
            <stop offset="0%" stop-color="${headerStart}" />
            <stop offset="100%" stop-color="${headerEnd}" />
          </linearGradient>
          <linearGradient id="footerGradient" x1="0" x2="1" y1="0" y2="0">
            <stop offset="0%" stop-color="${accent}" />
            <stop offset="100%" stop-color="${footerEnd}" />
          </linearGradient>
          <filter id="shadow" x="-20%" y="-20%" width="140%" height="140%">
            <feDropShadow dx="0" dy="8" stdDeviation="10" flood-color="#000000" flood-opacity="0.12" />
          </filter>
        </defs>
        <rect width="1240" height="1754" fill="#ffffff" />
        <rect x="0" y="0" width="1240" height="310" fill="url(#headerGradient)" />
        <rect x="0" y="300" width="1240" height="10" fill="${accent}" />

        ${logoDataUrl ? `<image href="${logoDataUrl}" x="70" y="72" width="150" height="150" preserveAspectRatio="xMidYMid meet" />` : ''}
        <text x="250" y="95" font-family="Georgia, serif" font-size="56" font-weight="700" fill="#111827">LE MANOIR</text>
        <text x="250" y="135" font-family="Arial, sans-serif" font-size="22" font-style="italic" fill="#4b5563">Ce lieu a été façonné par des mains, porté par des cœurs...</text>
        <text x="250" y="182" font-family="Arial, sans-serif" font-size="20" fill="#374151">Cotonou, Bénin</text>
        <text x="250" y="215" font-family="Arial, sans-serif" font-size="20" fill="#374151">+229 01 00 00 00 00</text>
        <text x="250" y="248" font-family="Arial, sans-serif" font-size="20" fill="#374151">contact@manoir.com</text>

        <text x="830" y="100" font-family="Georgia, serif" font-size="44" font-weight="700" fill="${accent}">${titleText}</text>
        <rect x="820" y="125" width="360" height="155" rx="14" fill="#ffffff" filter="url(#shadow)" />
        <text x="850" y="166" font-family="Arial, sans-serif" font-size="18" fill="#6b7280">Numéro</text>
        <text x="850" y="197" font-family="Arial, sans-serif" font-size="24" font-weight="700" fill="#111827">${numberText}</text>
        <text x="850" y="232" font-family="Arial, sans-serif" font-size="17" fill="#6b7280">Date et heure de délivrance</text>
        <text x="850" y="262" font-family="Arial, sans-serif" font-size="20" font-weight="700" fill="#111827">${svgEscape(documentDate)}</text>

        <text x="80" y="405" font-family="Arial, sans-serif" font-size="28" font-weight="700" fill="#111827">Client</text>
        <rect x="80" y="425" width="470" height="5" fill="${accent}" />
        <text x="80" y="485" font-family="Arial, sans-serif" font-size="30" font-weight="700" fill="#111827">${clientName}</text>
        <text x="80" y="532" font-family="Arial, sans-serif" font-size="22" fill="#374151">Téléphone : ${clientPhone}</text>
        <text x="80" y="570" font-family="Arial, sans-serif" font-size="22" fill="#374151">Email : ${clientEmail}</text>

        <text x="660" y="405" font-family="Arial, sans-serif" font-size="28" font-weight="700" fill="#111827">Détails du séjour</text>
        <rect x="660" y="425" width="500" height="5" fill="${accent}" />
        <text x="660" y="485" font-family="Arial, sans-serif" font-size="26" font-weight="700" fill="#111827">${apartment}</text>
        ${detailsDateLines}

        <text x="80" y="760" font-family="Arial, sans-serif" font-size="28" font-weight="700" fill="#111827">Calcul</text>
        <rect x="80" y="780" width="1080" height="5" fill="${accent}" />
        <rect x="80" y="835" width="1080" height="70" fill="#f9fafb" />
        <text x="115" y="879" font-family="Arial, sans-serif" font-size="20" font-weight="700" fill="#374151">Description</text>
        <text x="585" y="879" font-family="Arial, sans-serif" font-size="20" font-weight="700" text-anchor="middle" fill="#374151">${isStay ? 'Nombre de nuits' : 'Nombre de jours'}</text>
        <text x="815" y="879" font-family="Arial, sans-serif" font-size="20" font-weight="700" text-anchor="end" fill="#374151">Prix unitaire</text>
        <text x="1125" y="879" font-family="Arial, sans-serif" font-size="20" font-weight="700" text-anchor="end" fill="#374151">Montant</text>
        <line x1="80" y1="905" x2="1160" y2="905" stroke="#e5e7eb" stroke-width="2" />

        <text x="115" y="965" font-family="Arial, sans-serif" font-size="24" font-weight="700" fill="#111827">${svgEscape(description)}</text>
        <text x="115" y="1004" font-family="Arial, sans-serif" font-size="20" fill="#6b7280">${calculation}</text>
        <text x="585" y="985" font-family="Arial, sans-serif" font-size="22" text-anchor="middle" fill="#111827">${svgEscape(quantity)}</text>
        <text x="815" y="985" font-family="Arial, sans-serif" font-size="22" text-anchor="end" fill="#111827">${svgEscape(formatCurrency(unitPrice))}</text>
        <text x="1125" y="985" font-family="Arial, sans-serif" font-size="22" font-weight="700" text-anchor="end" fill="#111827">${total}</text>
        <line x1="80" y1="1040" x2="1160" y2="1040" stroke="#e5e7eb" stroke-width="2" />

        <line x1="720" y1="1140" x2="1160" y2="1140" stroke="${accent}" stroke-width="5" />
        <text x="720" y="1190" font-family="Arial, sans-serif" font-size="30" font-weight="700" fill="#111827">Total net</text>
        <text x="1160" y="1190" font-family="Arial, sans-serif" font-size="30" font-weight="700" text-anchor="end" fill="${accent}">${total}</text>



        <rect x="0" y="1600" width="1240" height="154" fill="url(#footerGradient)" />
        <text x="620" y="1660" font-family="Arial, sans-serif" font-size="22" text-anchor="middle" fill="#ffffff">Merci de votre confiance.</text>
        <text x="620" y="1700" font-family="Arial, sans-serif" font-size="18" text-anchor="middle" fill="#ffffff">LE MANOIR - Cotonou, Bénin - +229 01 00 00 00 00</text>
      </svg>
    `;
  };

  const buildInvoicePdf = async (reservation: Reservation, type: PaymentType) => {
    const width = 1240;
    const height = 1754;
    const logoDataUrl = await fetchAssetDataUrl('/assets/logo.jpg').catch(() => '');
    const svg = buildInvoiceSvg(reservation, type, logoDataUrl);
    const svgUrl = URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml;charset=utf-8' }));

    try {
      const image = await loadImage(svgUrl);
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const context = canvas.getContext('2d');

      if (!context) {
        throw new Error('Impossible de generer le PDF.');
      }

      context.fillStyle = '#ffffff';
      context.fillRect(0, 0, width, height);
      context.drawImage(image, 0, 0, width, height);
      const jpegDataUrl = canvas.toDataURL('image/jpeg', 0.95);

      return createPdfFromJpeg(dataUrlToBytes(jpegDataUrl), width, height);
    } finally {
      URL.revokeObjectURL(svgUrl);
    }
  };

  const handleDownloadInvoice = async (reservation: Reservation, type: PaymentType) => {
    try {
      const number = invoiceNumber(reservation, type);
      const fileName = type === 'stay' ? `Facture-Sejour-${number}.pdf` : `Facture-Caution-${number}.pdf`;
      const url = URL.createObjectURL(await buildInvoicePdf(reservation, type));
      const link = document.createElement('a');
      link.href = url;
      link.download = fileName;
      document.body.appendChild(link);
      link.click();
      link.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);

      const response = await api.markInvoiceDownloaded(reservation.id.toString(), type);
      setReservations((currentReservations) =>
        currentReservations.map((currentReservation) =>
          currentReservation.id === reservation.id ? response.reservation : currentReservation
        )
      );
      showToast(
        type === 'stay'
          ? 'Votre facture de séjour a été téléchargée avec succès !'
          : 'Votre facture a été téléchargée avec succès !',
        'success'
      );
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Impossible de télécharger la facture.', 'error');
    }
  };

  const handleOpenPayment = async (reservation: Reservation, type: PaymentType) => {
    if (type === 'deposit' && isDepositPaymentExpired(reservation, Date.now())) {
      setReservations((currentReservations) =>
        currentReservations.map((currentReservation) =>
          currentReservation.id === reservation.id
            ? { ...currentReservation, status: 'EXPIREE' }
            : currentReservation
        )
      );
      showToast("Le delai de paiement est expire. L'appartement est de nouveau disponible.", 'error');
      loadReservations();
      return;
    }

    setActiveReservation(reservation);
    setActivePaymentType(type);
    setPaymentError('');
    setPaymentStep('processing');

    try {
      setProcessingText('Validation du paiement...');
      const initResponse = await api.initiatePayment(reservation.id.toString(), {
        payment_method: 'mobile_money',
        provider: 'fedapay',
        payment_type: type,
        phone_number: user?.phone || '+2290100000000',
      });

      setProcessingText('Confirmation du paiement...');
      const webhookUrl = `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api'}/payments/${initResponse.payment.id}/webhook`;
      const response = await fetch(webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status: 'success',
          transaction_id: initResponse.payment.transaction_id,
          provider_reference: `REF_${Math.floor(Math.random() * 1000000)}`,
        }),
      });

      if (!response.ok) {
        throw new Error('La validation du paiement a echoue.');
      }

      await new Promise((resolve) => setTimeout(resolve, 350));
      setPaymentStep('success');
      setReservations((currentReservations) =>
        currentReservations.map((currentReservation) =>
          currentReservation.id === reservation.id
            ? {
                ...currentReservation,
                status: type === 'stay' ? 'SEJOUR_PAYE' : 'CONFIRMEE',
                ...(type === 'stay' ? { stay_paid_at: new Date().toISOString() } : { paid_at: new Date().toISOString() }),
              }
            : currentReservation
        )
      );
      showToast(type === 'deposit' ? 'Caution payee. Reservation confirmee.' : 'Sejour paye avec succes.', 'success');
      if (type === 'stay') {
        setActiveTab('history');
      }
      loadReservations();
    } catch (err) {
      setPaymentStep('failed');
      setPaymentError(err instanceof Error ? err.message : 'Le paiement a echoue.');
    }
  };

  const activeReservations = reservations.filter((reservation) =>
    ['EN_ATTENTE', 'VALIDEE_PAIEMENT_REQUIS', 'CONFIRMEE'].includes(effectiveReservationStatus(reservation, nowMs))
  );
  const historyReservations = reservations.filter((reservation) =>
    ['REFUSEE', 'EXPIREE', 'SEJOUR_PAYE', 'ANNULEE', 'REMBOURSEE', 'LIBEREE'].includes(effectiveReservationStatus(reservation, nowMs))
  );
  const visibleReservations = activeTab === 'active' ? activeReservations : historyReservations;

  const renderTimeline = (reservation: Reservation) => {
    const steps = [
      { key: 'submitted', label: 'Demande' },
      { key: 'approved', label: 'Validation' },
      { key: 'deposit', label: 'Caution' },
      { key: 'stay', label: 'Sejour' },
    ];

    let completedStepIndex = 0;
    let nextStepIndex = 1;
    let errorLabel = '';

    const status = effectiveReservationStatus(reservation, nowMs);

    if (status === 'VALIDEE_PAIEMENT_REQUIS') {
      completedStepIndex = 1;
      nextStepIndex = 2;
    }
    if (status === 'CONFIRMEE') {
      completedStepIndex = 2;
      nextStepIndex = 3;
    }
    if (status === 'SEJOUR_PAYE') {
      completedStepIndex = 3;
      nextStepIndex = 3;
    }
    if (status === 'REFUSEE') errorLabel = 'Demande refusee';
    if (status === 'EXPIREE') errorLabel = 'Delai expire';
    if (status === 'ANNULEE') errorLabel = 'Reservation annulee';
    if (status === 'REMBOURSEE') errorLabel = 'Remboursement effectue';
    if (status === 'LIBEREE') errorLabel = 'Appartement libere';

    if (errorLabel) {
      return (
        <div className="rounded-2xl border border-terracotta/25 bg-terracotta/10 p-4 text-xs text-terracotta">
          <div className="flex items-center gap-3">
            <XCircle className="h-5 w-5 flex-shrink-0" />
            <div>
              <p className="font-bold uppercase tracking-wider">{errorLabel}</p>
              <p className="mt-0.5 text-[10px] text-bark/60">Vous pouvez faire une nouvelle demande depuis le catalogue.</p>
            </div>
          </div>
        </div>
      );
    }

    return (
      <div className="relative flex w-full items-center justify-between pt-5">
        <div className="absolute left-0 right-0 top-8 z-0 h-0.5 bg-bark/10" />
        <div
          className="absolute left-0 top-8 z-0 h-0.5 bg-bark transition-all duration-700"
          style={{ width: `${(completedStepIndex / (steps.length - 1)) * 100}%` }}
        />
        {steps.map((step, index) => {
          const isDone = index <= completedStepIndex;
          const isActive = !isDone && index === nextStepIndex;

          return (
            <div key={step.key} className="relative z-10 flex flex-col items-center">
              <div className={`flex h-6 w-6 items-center justify-center rounded-full border-2 ${
                isDone ? 'border-bark bg-bark text-cream' :
                isActive ? 'border-bark bg-cream text-bark' :
                'border-bark/20 bg-cream-dark text-bark/30'
              }`}>
                {isDone ? <Check className="h-3.5 w-3.5" strokeWidth={3} /> : <span className="text-[9px] font-bold">{index + 1}</span>}
              </div>
              <span className={`mt-2 hidden text-[9px] uppercase tracking-wider sm:block ${isDone || isActive ? 'font-bold text-bark' : 'text-bark/40'}`}>
                {step.label}
              </span>
            </div>
          );
        })}
      </div>
    );
  };

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
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }} className="mb-10">
          <div className="flex flex-col gap-5 md:flex-row md:items-start md:justify-between">
            <div className="space-y-4">
              <div className="inline-flex items-center gap-2 rounded-full border border-bark/10 bg-bark/5 px-4 py-2 backdrop-blur-md">
                <Sparkles className="h-4 w-4 text-bark" />
                <span className="text-[10px] font-semibold uppercase tracking-widest text-bark">Espace Client</span>
              </div>
              <div>
                <h1 className="mb-4 font-display text-4xl font-bold uppercase tracking-tight text-bark md:text-6xl">
                  Mes Reservations
                </h1>
                <p className="max-w-2xl text-lg text-bark/60">
                  Suivez vos demandes, payez votre caution ou votre sejour, et retrouvez vos documents.
                </p>
              </div>
            </div>

            <Link
              href="/espace-client/profil"
              className="inline-flex items-center justify-center gap-2 rounded-xl border border-bark/20 bg-cream-dark/60 px-5 py-3 text-[10px] font-black uppercase tracking-[0.22em] text-bark transition hover:border-bark hover:bg-bark hover:text-cream md:mt-1"
            >
              <Settings size={14} />
              Gerer mon profil
            </Link>
          </div>
        </motion.div>

        <div className="mb-10 flex gap-4 border-b border-bark/10 pb-4 text-sm font-black uppercase tracking-widest">
          <button onClick={() => setActiveTab('active')} className={`relative pb-4 transition-colors ${activeTab === 'active' ? 'text-bark' : 'text-bark/40 hover:text-bark'}`}>
            En cours ({activeReservations.length})
            {activeTab === 'active' && <motion.div layoutId="tab-underline" className="absolute bottom-[-1px] left-0 right-0 h-0.5 bg-bark" />}
          </button>
          <button onClick={() => setActiveTab('history')} className={`relative pb-4 transition-colors ${activeTab === 'history' ? 'text-bark' : 'text-bark/40 hover:text-bark'}`}>
            Historique ({historyReservations.length})
            {activeTab === 'history' && <motion.div layoutId="tab-underline" className="absolute bottom-[-1px] left-0 right-0 h-0.5 bg-bark" />}
          </button>
        </div>

        {visibleReservations.length === 0 ? (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="rounded-3xl border border-bark/10 bg-cream-dark/50 py-20 text-center backdrop-blur-md">
            <Calendar className="mx-auto mb-6 h-16 w-16 text-bark/20" />
            <h3 className="mb-2 font-display text-2xl font-bold uppercase text-bark">Aucune reservation</h3>
            <p className="mx-auto mb-8 max-w-sm text-bark/50">Il n'y a aucune reservation dans cette section pour le moment.</p>
            <Link href="/rooms" className="inline-flex items-center gap-2 border border-bark px-6 py-4 text-xs font-black uppercase tracking-[0.28em] transition hover:bg-bark hover:text-cream">
              Voir les appartements
            </Link>
          </motion.div>
        ) : (
          <div className="space-y-8">
            {visibleReservations.map((reservation, index) => (
              <motion.article
                key={reservation.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.05, duration: 0.5 }}
                className="space-y-8 rounded-3xl border border-bark/10 bg-cream-dark/30 p-8 backdrop-blur-md transition-all duration-300 hover:border-bark/20"
              >
                <div className="flex flex-col justify-between gap-8 lg:flex-row lg:items-start">
                  <div className="flex-1 space-y-6">
                    <div className="flex flex-wrap items-center gap-3">
                      <h3 className="font-display text-2xl font-bold uppercase tracking-wide text-bark">
                        {getReservationTitle(reservation)}
                      </h3>
                      <span className="rounded-full border border-bark/10 bg-bark/5 px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-bark/60">
                        {statusLabels[effectiveReservationStatus(reservation, nowMs)] || effectiveReservationStatus(reservation, nowMs)}
                      </span>
                    </div>

                    <div className="grid gap-6 border-t border-bark/5 pt-4 sm:grid-cols-2">
                      <div className="flex items-center gap-4">
                        <div className="flex h-11 w-11 items-center justify-center rounded-xl border border-bark/10 bg-bark/5">
                          <Calendar className="h-5 w-5 text-bark/70" />
                        </div>
                        <div>
                          <p className="text-[10px] uppercase tracking-widest text-bark/40">Arrivee</p>
                          <p className="font-semibold text-bark">{formatReservationDate(reservation.check_in)}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-4">
                        <div className="flex h-11 w-11 items-center justify-center rounded-xl border border-bark/10 bg-bark/5">
                          <Calendar className="h-5 w-5 text-bark/70" />
                        </div>
                        <div>
                          <p className="text-[10px] uppercase tracking-widest text-bark/40">Depart</p>
                          <p className="font-semibold text-bark">{formatReservationDate(reservation.check_out)}</p>
                        </div>
                      </div>
                    </div>

                    <div className="grid gap-4 sm:grid-cols-3">
                      <div className="rounded-2xl border border-bark/5 bg-bark/5 p-4">
                        <p className="text-[9px] uppercase tracking-widest text-bark/40">Caution</p>
                        <p className="mt-1 font-display text-xl font-bold text-bark">{formatCurrency(reservation.deposit_amount ?? reservation.total_price)}</p>
                      </div>
                      <div className="rounded-2xl border border-bark/5 bg-bark/5 p-4">
                        <p className="text-[9px] uppercase tracking-widest text-bark/40">Sejour</p>
                        <p className="mt-1 font-display text-xl font-bold text-bark">{formatCurrency(reservation.stay_amount)}</p>
                      </div>
                      <div className="rounded-2xl border border-bark/5 bg-bark/5 p-4">
                        <p className="text-[9px] uppercase tracking-widest text-bark/40">Nuits</p>
                        <p className="mt-1 font-display text-xl font-bold text-bark">{countNights(reservation.check_in, reservation.check_out)}</p>
                      </div>
                    </div>

                    {reservation.status === 'EN_ATTENTE' && (
                      <p className="rounded-2xl border border-bark/10 bg-cream p-4 text-sm text-bark/65">
                        Votre demande est en cours d'examen.
                      </p>
                    )}

                    {reservation.special_requests && (
                      <div className="rounded-2xl border border-bark/5 bg-bark/5 p-4 text-xs text-bark/70">
                        <span className="mb-1 block text-[9px] uppercase tracking-wider text-bark/40">Demandes speciales</span>
                        {reservation.special_requests}
                      </div>
                    )}

                    {reservation.admin_notes && (
                      <div className="rounded-2xl border border-terracotta/10 bg-terracotta/5 p-4 text-xs text-terracotta">
                        <span className="mb-1 block text-[9px] uppercase tracking-wider text-terracotta/50">Message de l'administration</span>
                        {reservation.admin_notes}
                      </div>
                    )}
                  </div>

                  <div className="flex min-w-[260px] flex-col gap-3 border-t border-bark/10 pt-6 lg:border-l lg:border-t-0 lg:pl-8 lg:pt-0">
                    {reservation.payment_deadline && reservation.status === 'VALIDEE_PAIEMENT_REQUIS' && (
                      (() => {
                        const countdown = paymentCountdown(reservation.payment_deadline, reservation.approved_at, nowMs);

                        return (
                          <div className={`mb-2 rounded-2xl border p-4 text-xs ${
                            countdown?.expired
                              ? 'border-terracotta/25 bg-terracotta/10 text-terracotta'
                              : countdown?.isUrgent
                                ? 'border-terracotta/25 bg-terracotta/5 text-terracotta'
                                : 'border-bark/10 bg-bark/5 text-bark'
                          }`}>
                            <div className="flex items-start gap-3">
                              <Clock className="mt-0.5 h-4 w-4 flex-shrink-0" />
                              <div className="min-w-0 flex-1">
                                <p className="font-semibold">
                                  Autorisation valable jusqu'au {new Date(reservation.payment_deadline).toLocaleString('fr-FR')}
                                </p>
                                <p className="mt-1 text-[10px] uppercase tracking-widest opacity-60">
                                  Temps restant pour payer la caution de réservation
                                </p>

                                {countdown?.expired ? (
                                  <p className="mt-3 rounded-xl border border-terracotta/20 bg-terracotta/10 px-3 py-2 text-[11px] font-bold">
                                    Delai expire. Le paiement est desactive et l'appartement est de nouveau disponible.
                                  </p>
                                ) : countdown ? (
                                  <>
                                    <div className="mt-3 grid grid-cols-3 gap-2">
                                      {[
                                        { label: 'Heures', value: countdown.hours },
                                        { label: 'Minutes', value: countdown.minutes },
                                        { label: 'Secondes', value: countdown.seconds },
                                      ].map((item) => (
                                        <div key={item.label} className="rounded-xl border border-current/10 bg-cream/60 px-3 py-2 text-center">
                                          <p className="font-display text-lg font-bold leading-none">
                                            {String(item.value).padStart(2, '0')}
                                          </p>
                                          <p className="mt-1 text-[8px] font-black uppercase tracking-widest opacity-55">
                                            {item.label}
                                          </p>
                                        </div>
                                      ))}
                                    </div>
                                    <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-current/10">
                                      <div
                                        className={`h-full rounded-full transition-all duration-500 ${
                                          countdown.isUrgent ? 'bg-terracotta' : 'bg-bark'
                                        }`}
                                        style={{ width: `${countdown.percent}%` }}
                                      />
                                    </div>
                                  </>
                                ) : null}
                              </div>
                            </div>
                          </div>
                        );
                      })()
                    )}

                    {reservation.status === 'VALIDEE_PAIEMENT_REQUIS' && !hasDepositInvoice(reservation) && (
                      <div className="space-y-3 rounded-2xl border border-bark/10 bg-bark/5 p-4">
                        <p className="text-sm font-bold text-bark">Bon de Réservation</p>
                        <a href={`/reservations/${reservation.id}/invoice?type=booking`} className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-bark/20 px-5 py-3 text-[10px] font-black uppercase tracking-wider text-bark transition hover:bg-bark hover:text-cream">
                          <FileText size={14} />
                          Voir le bon
                        </a>
                        {isDepositPaymentExpired(reservation, nowMs) ? (
                          <button
                            type="button"
                            disabled
                            className="flex w-full cursor-not-allowed items-center justify-center gap-2 rounded-xl bg-bark/35 px-5 py-4 text-center text-[10px] font-black uppercase leading-5 tracking-[0.14em] text-cream/80 sm:text-xs"
                          >
                            Delai expire
                          </button>
                        ) : (
                          <button onClick={() => handleOpenPayment(reservation, 'deposit')} className="flex w-full items-center justify-center gap-2 rounded-xl bg-bark px-5 py-4 text-center text-[10px] font-black uppercase leading-5 tracking-[0.14em] text-cream transition hover:bg-bark-light sm:text-xs">
                            Payer la caution de réservation
                          </button>
                        )}
                      </div>
                    )}

                    {hasDepositInvoice(reservation) && (
                      <div className="space-y-3 rounded-2xl border border-olive/15 bg-olive/5 p-4">
                        <p className="text-sm font-bold text-bark">Facture Caution</p>
                        {reservation.deposit_invoice_downloaded ? (
                          <a
                            href={`/reservations/${reservation.id}/invoice?type=deposit`}
                            className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-bark/20 px-5 py-3 text-[10px] font-black uppercase tracking-wider text-bark transition hover:bg-bark hover:text-cream"
                          >
                            <FileText size={14} />
                            Voir la Facture de Caution
                          </a>
                        ) : (
                          <button
                            type="button"
                            onClick={() => handleDownloadInvoice(reservation, 'deposit')}
                            className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-bark/20 px-5 py-3 text-[10px] font-black uppercase tracking-wider text-bark transition hover:bg-bark hover:text-cream"
                          >
                            <Download size={14} />
                            Télécharger la facture
                          </button>
                        )}
                      </div>
                    )}

                    {reservation.status === 'CONFIRMEE' && !hasStayInvoice(reservation) && (
                      <div className="space-y-3 rounded-2xl border border-bark/10 bg-bark/5 p-4">
                        <p className="text-sm font-bold text-bark">Bon du Séjour</p>
                        <a href={`/reservations/${reservation.id}/invoice?type=stay-voucher`} className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-bark/20 px-5 py-3 text-[10px] font-black uppercase tracking-wider text-bark transition hover:bg-bark hover:text-cream">
                          <FileText size={14} />
                          Voir le bon
                        </a>
                        <button onClick={() => handleOpenPayment(reservation, 'stay')} className="flex w-full items-center justify-center gap-2 rounded-xl bg-bark px-6 py-4 text-xs font-black uppercase tracking-[0.2em] text-cream transition hover:bg-bark-light">
                          Payer mon séjour
                        </button>
                        {reservation.extension_status === 'EN_ATTENTE' && reservation.extension_requested_check_out && (
                          <div className="rounded-xl border border-bark/10 bg-cream p-3 text-xs leading-relaxed text-bark/70">
                            <p className="font-bold text-bark">Prolongation en attente</p>
                            <p>Nouvelle date demandée : {formatReservationDate(reservation.extension_requested_check_out)}</p>
                            <p>L'administrateur doit encore valider cette demande.</p>
                          </div>
                        )}
                        {reservation.extension_status === 'REFUSEE' && (
                          <div className="rounded-xl border border-terracotta/20 bg-terracotta/5 p-3 text-xs leading-relaxed text-terracotta">
                            <p className="font-bold">Prolongation refusée</p>
                            <p>{reservation.extension_admin_notes || 'Aucun motif précisé.'}</p>
                          </div>
                        )}
                        {canRequestStayExtension(reservation) && (
                          <button
                            type="button"
                            onClick={() => openExtensionModal(reservation)}
                            className="flex w-full items-center justify-center gap-2 rounded-xl border border-bark/20 px-5 py-3 text-[10px] font-black uppercase tracking-wider text-bark transition hover:bg-bark hover:text-cream"
                          >
                            Prolonger mon séjour
                          </button>
                        )}
                      </div>
                    )}

                    {hasStayInvoice(reservation) && (
                      <div className="space-y-3 rounded-2xl border border-olive/15 bg-olive/5 p-4">
                        <p className="text-sm font-bold text-bark">Facture Séjour</p>
                        {reservation.stay_invoice_downloaded ? (
                          <a
                            href={`/reservations/${reservation.id}/invoice?type=stay`}
                            className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-bark/20 px-5 py-3 text-[10px] font-black uppercase tracking-wider text-bark transition hover:bg-bark hover:text-cream"
                          >
                            <FileText size={14} />
                            Voir la Facture du Séjour
                          </a>
                        ) : (
                          <button
                            type="button"
                            onClick={() => handleDownloadInvoice(reservation, 'stay')}
                            className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-bark/20 px-5 py-3 text-[10px] font-black uppercase tracking-wider text-bark transition hover:bg-bark hover:text-cream"
                          >
                            <Download size={14} />
                            Télécharger la facture
                          </button>
                        )}
                      </div>
                    )}

                    {(reservation.status === 'ANNULEE' || reservation.status === 'REMBOURSEE') && (
                      <div className="space-y-3 rounded-2xl border border-terracotta/15 bg-terracotta/5 p-4">
                        <p className="text-sm font-bold text-bark">Bon d'Annulation</p>
                        <p className="text-xs leading-relaxed text-bark/60">
                          Montant a rembourser : {formatCurrency(reservation.cancellation_refund_amount)}
                        </p>
                        <a
                          href={`/reservations/${reservation.id}/invoice?type=cancellation`}
                          className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-bark/20 px-5 py-3 text-[10px] font-black uppercase tracking-wider text-bark transition hover:bg-bark hover:text-cream"
                        >
                          <FileText size={14} />
                          Voir le bon
                        </a>
                      </div>
                    )}

                    {canCancelReservation(reservation) && (
                      <button
                        type="button"
                        onClick={() => setCancellingReservation(reservation)}
                        className="flex w-full items-center justify-center gap-2 rounded-xl border border-terracotta/30 px-5 py-3 text-[10px] font-black uppercase tracking-wider text-terracotta transition hover:bg-terracotta hover:text-white"
                      >
                        <XCircle size={14} />
                        Annuler ma reservation
                      </button>
                    )}
                  </div>
                </div>

                <div className="border-t border-bark/5 pt-6">
                  {renderTimeline(reservation)}
                </div>
              </motion.article>
            ))}
          </div>
        )}
      </div>

      <AnimatePresence>
        {activeReservation && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => paymentStep !== 'processing' && setActiveReservation(null)}
              className="absolute inset-0 bg-black/80 backdrop-blur-md"
            />

            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative w-full max-w-md overflow-hidden rounded-3xl border border-bark/10 bg-cream p-8 shadow-2xl"
            >
              {paymentStep === 'processing' && (
                <div className="flex flex-col items-center justify-center space-y-6 py-16">
                  <div className="h-12 w-12 animate-spin rounded-full border-4 border-bark border-t-transparent" />
                  <div className="space-y-2 text-center">
                    <h3 className="font-display text-lg font-bold uppercase tracking-wider text-bark">Traitement securise</h3>
                    <p className="animate-pulse text-xs font-medium text-bark/50">{processingText}</p>
                  </div>
                </div>
              )}

              {paymentStep === 'success' && (
                <div className="flex flex-col items-center justify-center space-y-6 py-10 text-center">
                  <div className="flex h-16 w-16 items-center justify-center rounded-full border border-olive/30 bg-olive/10 text-olive">
                    <Check size={32} />
                  </div>
                  <div>
                    <h3 className="font-display text-2xl font-bold uppercase tracking-wider text-olive">Paiement reussi</h3>
                    <p className="mx-auto mt-2 max-w-xs text-xs leading-relaxed text-bark/50">La transaction a ete validee avec succes.</p>
                  </div>
                  <button type="button" onClick={() => setActiveReservation(null)} className="w-full rounded-xl bg-bark py-4 text-xs font-black uppercase tracking-wider text-cream transition hover:bg-bark-light">
                    Fermer
                  </button>
                </div>
              )}

              {paymentStep === 'failed' && (
                <div className="flex flex-col items-center justify-center space-y-6 py-10 text-center">
                  <div className="flex h-16 w-16 items-center justify-center rounded-full border border-terracotta/30 bg-terracotta/10 text-terracotta">
                    <XCircle size={32} />
                  </div>
                  <div>
                    <h3 className="font-display text-2xl font-bold uppercase tracking-wider text-terracotta">Paiement echoue</h3>
                    <p className="mx-auto mt-2 max-w-xs text-xs leading-relaxed text-bark/50">{paymentError}</p>
                  </div>
                  <button
                    type="button"
                    disabled={Boolean(activeReservation && activePaymentType === 'deposit' && isDepositPaymentExpired(activeReservation, nowMs))}
                    onClick={() => activeReservation && handleOpenPayment(activeReservation, activePaymentType)}
                    className="w-full rounded-xl bg-bark py-4 text-xs font-black uppercase tracking-wider text-cream transition hover:bg-bark-light disabled:cursor-not-allowed disabled:bg-bark/35 disabled:text-cream/80"
                  >
                    {activeReservation && activePaymentType === 'deposit' && isDepositPaymentExpired(activeReservation, nowMs)
                      ? 'Delai expire'
                      : 'Reessayer le paiement'}
                  </button>
                </div>
              )}
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {cancellingReservation && (
          <div className="fixed inset-0 z-[110] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => !cancelling && setCancellingReservation(null)}
              className="absolute inset-0 bg-black/80 backdrop-blur-md"
            />

            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative w-full max-w-xl rounded-3xl border border-bark/10 bg-cream p-8 text-charcoal shadow-2xl"
            >
              {(() => {
                const preview = cancellationPreview(cancellingReservation);

                return (
                  <div className="space-y-6">
                    <div>
                      <h3 className="font-display text-2xl font-bold uppercase tracking-wide text-bark">
                        Annuler ma reservation
                      </h3>
                      <p className="mt-1 text-[10px] uppercase tracking-widest text-bark/50">
                        Reservation #{cancellingReservation.id}
                      </p>
                    </div>

                    <div className="rounded-2xl border border-bark/10 bg-bark/5 p-4 text-xs leading-relaxed text-bark/70">
                      <p><strong>Appartement :</strong> {getReservationTitle(cancellingReservation)}</p>
                      <p><strong>Dates :</strong> du {formatReservationDate(cancellingReservation.check_in)} au {formatReservationDate(cancellingReservation.check_out)}</p>
                      <p><strong>Date de demande :</strong> {formatReservationDate(cancellingReservation.created_at)}</p>
                    </div>

                    <div className="grid gap-3 sm:grid-cols-2">
                      <div className="rounded-2xl border border-bark/5 bg-bark/5 p-4">
                        <p className="text-[9px] uppercase tracking-widest text-bark/40">Caution payée</p>
                        <p className="mt-1 font-display text-xl font-bold text-bark">{formatCurrency(preview.depositAmount)}</p>
                      </div>
                      <div className="rounded-2xl border border-bark/5 bg-bark/5 p-4">
                        <p className="text-[9px] uppercase tracking-widest text-bark/40">Jours consommés</p>
                        <p className="mt-1 font-display text-xl font-bold text-bark">{preview.consumedDays}</p>
                      </div>
                      <div className="rounded-2xl border border-bark/5 bg-bark/5 p-4">
                        <p className="text-[9px] uppercase tracking-widest text-bark/40">Montant retenu</p>
                        <p className="mt-1 font-display text-xl font-bold text-bark">{formatCurrency(preview.retainedAmount)}</p>
                      </div>
                      <div className="rounded-2xl border border-olive/15 bg-olive/5 p-4">
                        <p className="text-[9px] uppercase tracking-widest text-bark/40">Montant rembourse</p>
                        <p className="mt-1 font-display text-xl font-bold text-olive">{formatCurrency(preview.refundAmount)}</p>
                      </div>
                    </div>

                    <p className="rounded-2xl border border-terracotta/15 bg-terracotta/5 p-4 text-sm leading-relaxed text-terracotta">
                      Etes-vous sur de vouloir annuler ? Vous serez rembourse de {formatCurrency(preview.refundAmount)} dans un delai de 48h a 72h.
                    </p>

                    <div className="flex gap-3 border-t border-bark/5 pt-4">
                      <button
                        type="button"
                        disabled={cancelling}
                        onClick={() => setCancellingReservation(null)}
                        className="flex-1 rounded-xl border border-bark/10 py-4 text-xs font-bold uppercase tracking-wider text-bark/70 transition hover:bg-bark/5 disabled:opacity-50"
                      >
                        Retour
                      </button>
                      <button
                        type="button"
                        disabled={cancelling}
                        onClick={handleConfirmCancellation}
                        className="flex-1 rounded-xl bg-terracotta py-4 text-xs font-black uppercase tracking-wider text-white transition hover:bg-terracotta/90 disabled:opacity-50"
                      >
                        {cancelling ? 'Annulation...' : "Confirmer l'annulation"}
                      </button>
                    </div>
                  </div>
                );
              })()}
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {extensionReservation && (
          <div className="fixed inset-0 z-[110] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => !requestingExtension && setExtensionReservation(null)}
              className="absolute inset-0 bg-black/80 backdrop-blur-md"
            />

            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative w-full max-w-xl rounded-3xl border border-bark/10 bg-cream p-8 text-charcoal shadow-2xl"
            >
              {(() => {
                const preview = extensionPreview(extensionReservation);
                const minimumDate = extensionMinimumDate(extensionReservation);

                return (
                  <div className="space-y-6">
                    <div>
                      <h3 className="font-display text-2xl font-bold uppercase tracking-wide text-bark">
                        Prolonger mon séjour
                      </h3>
                      <p className="mt-1 text-[10px] uppercase tracking-widest text-bark/50">
                        Réservation #{extensionReservation.id}
                      </p>
                    </div>

                    <div className="rounded-2xl border border-bark/10 bg-bark/5 p-4 text-xs leading-relaxed text-bark/70">
                      <p><strong>Appartement :</strong> {getReservationTitle(extensionReservation)}</p>
                      <p><strong>Arrivée :</strong> {formatReservationDate(extensionReservation.check_in)}</p>
                      <p><strong>Départ actuel :</strong> {formatReservationDate(extensionReservation.check_out)}</p>
                    </div>

                    <label className="block">
                      <span className="mb-2 block text-[10px] font-semibold uppercase tracking-wider text-bark/60">
                        Nouvelle date de départ
                      </span>
                      <input
                        type="date"
                        min={minimumDate}
                        value={extensionDate}
                        onChange={(event) => {
                          setExtensionDate(event.target.value);
                          setExtensionError('');
                        }}
                        className="w-full rounded-xl border border-bark/15 bg-transparent px-4 py-4 text-sm font-semibold text-bark outline-none transition focus:border-bark"
                      />
                    </label>

                    <div className="grid gap-3 sm:grid-cols-3">
                      <div className="rounded-2xl border border-bark/5 bg-bark/5 p-4">
                        <p className="text-[9px] uppercase tracking-widest text-bark/40">Nuits actuelles</p>
                        <p className="mt-1 font-display text-xl font-bold text-bark">{preview.currentNights}</p>
                      </div>
                      <div className="rounded-2xl border border-bark/5 bg-bark/5 p-4">
                        <p className="text-[9px] uppercase tracking-widest text-bark/40">Nuits ajoutees</p>
                        <p className="mt-1 font-display text-xl font-bold text-bark">{preview.additionalNights}</p>
                      </div>
                      <div className="rounded-2xl border border-olive/15 bg-olive/5 p-4">
                        <p className="text-[9px] uppercase tracking-widest text-bark/40">Nouveau sejour</p>
                        <p className="mt-1 font-display text-xl font-bold text-olive">{formatCurrency(preview.newStayAmount)}</p>
                      </div>
                    </div>

                    <p className="rounded-2xl border border-bark/10 bg-cream-dark/60 p-4 text-sm leading-relaxed text-bark/70">
                      La demande sera envoyée à l'administrateur. Si l'appartement reste libre sur la nouvelle période, l'administrateur pourra accepter et le Bon du Séjour sera automatiquement mis à jour.
                    </p>

                    {extensionError && <p className="text-xs font-semibold text-terracotta">{extensionError}</p>}

                    <div className="flex gap-3 border-t border-bark/5 pt-4">
                      <button
                        type="button"
                        disabled={requestingExtension}
                        onClick={() => setExtensionReservation(null)}
                        className="flex-1 rounded-xl border border-bark/10 py-4 text-xs font-bold uppercase tracking-wider text-bark/70 transition hover:bg-bark/5 disabled:opacity-50"
                      >
                        Retour
                      </button>
                      <button
                        type="button"
                        disabled={requestingExtension}
                        onClick={handleSubmitExtension}
                        className="flex-1 rounded-xl bg-bark py-4 text-xs font-black uppercase tracking-wider text-cream transition hover:bg-bark/90 disabled:opacity-50"
                      >
                        {requestingExtension ? 'Envoi...' : 'Envoyer la demande'}
                      </button>
                    </div>
                  </div>
                );
              })()}
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </main>
  );
}
