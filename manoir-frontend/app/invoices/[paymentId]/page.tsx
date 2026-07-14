'use client';

import { useCallback, useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Image from 'next/image';
import Link from 'next/link';

interface InvoiceData {
  invoice_number: string;
  invoice_date: string;
  payment_type: string;
  payment_method: string;
  transaction_id: string;
  hotel: {
    name: string;
    tagline: string;
    address: string;
    phone: string;
    email: string;
  };
  client: {
    name: string;
    email: string;
    phone: string;
  };
  reservation: {
    room_name: string;
    room_type: string;
    check_in: string;
    check_out: string;
    nights: number;
    guests: number;
  };
  pricing: {
    description: string;
    unit_price: number;
    quantity: number;
    quantity_label?: string;
    subtotal: number;
    tax_rate: number;
    tax: number;
    total: number;
  };
}

export default function InvoicePage() {
  const params = useParams();
  const router = useRouter();
  const [invoice, setInvoice] = useState<InvoiceData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const fetchInvoice = useCallback(async () => {
    try {
      const token = localStorage.getItem('token');
      if (!token) {
        router.push('/auth/login');
        return;
      }

      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/payments/${params.paymentId}/invoice`,
        {
          headers: {
            'Authorization': `Bearer ${token}`,
          },
        }
      );

      if (!response.ok) {
        throw new Error('Facture non trouvée');
      }

      const data = await response.json();
      setInvoice(data.invoice);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur lors du chargement');
    } finally {
      setLoading(false);
    }
  }, [params.paymentId, router]);

  useEffect(() => {
    fetchInvoice();
  }, [fetchInvoice]);

  const handlePrint = () => {
    window.print();
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-amber-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Chargement de la facture...</p>
        </div>
      </div>
    );
  }

  if (error || !invoice) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <p className="text-red-600 mb-4">{error || 'Facture non trouvée'}</p>
          <Link
            href="/reservations"
            className="text-amber-600 hover:text-amber-700 underline"
          >
            Retour à mes réservations
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      {/* Action Buttons - Hidden when printing */}
      <div className="max-w-4xl mx-auto px-4 mb-4 print:hidden">
        <div className="flex justify-between items-center">
          <Link
            href="/reservations"
            className="text-amber-600 hover:text-amber-700 flex items-center gap-2"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
            Retour aux réservations
          </Link>
          <button
            onClick={handlePrint}
            className="bg-amber-600 text-white px-6 py-2 rounded-lg hover:bg-amber-700 transition-colors flex items-center gap-2"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
            </svg>
            Imprimer / PDF
          </button>
        </div>
      </div>

      {/* Invoice */}
      <div className="max-w-4xl mx-auto bg-white shadow-lg print:shadow-none">
        {/* Header with Logo */}
        <div className="bg-gradient-to-r from-amber-50 to-orange-50 p-8 border-b-4 border-amber-600">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-6">
              {/* Logo */}
              <div className="w-32 h-32 flex-shrink-0">
                <Image
                  src="/assets/logo.jpg"
                  alt="Le Manoir Logo"
                  width={128}
                  height={128}
                  className="w-full h-full object-contain"
                />
              </div>
              <div>
                <h1 className="text-4xl font-bold text-gray-900 mb-2">{invoice.hotel.name}</h1>
                <p className="text-gray-600 italic mb-4">{invoice.hotel.tagline}</p>
                <div className="text-sm text-gray-700 space-y-1">
                  <p className="flex items-center gap-2">
                    <svg className="w-4 h-4 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                    {invoice.hotel.address}
                  </p>
                  <p className="flex items-center gap-2">
                    <svg className="w-4 h-4 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                    </svg>
                    {invoice.hotel.phone}
                  </p>
                  <p className="flex items-center gap-2">
                    <svg className="w-4 h-4 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                    </svg>
                    {invoice.hotel.email}
                  </p>
                </div>
              </div>
            </div>

            {/* Invoice Title */}
            <div className="text-right">
              <h2 className="text-3xl font-bold text-amber-600 mb-2">FACTURE</h2>
              <div className="bg-white p-4 rounded-lg shadow-sm">
                <p className="text-sm text-gray-600">N° Facture</p>
                <p className="text-lg font-bold text-gray-900">{invoice.invoice_number}</p>
                <p className="text-sm text-gray-600 mt-2">Date et heure de délivrance</p>
                <p className="text-base font-semibold text-gray-900">{invoice.invoice_date}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Client and Reservation Info */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 p-8">
          {/* Client Info */}
          <div>
            <h3 className="text-lg font-semibold text-gray-900 mb-4 pb-2 border-b-2 border-amber-600">
              Facturé à
            </h3>
            <div className="space-y-2">
              <p className="text-xl font-bold text-gray-900">{invoice.client.name}</p>
              <p className="flex items-center gap-2 text-gray-700">
                <svg className="w-4 h-4 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                </svg>
                {invoice.client.email}
              </p>
              <p className="flex items-center gap-2 text-gray-700">
                <svg className="w-4 h-4 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                </svg>
                {invoice.client.phone}
              </p>
            </div>
          </div>

          {/* Reservation Info */}
          <div>
            <h3 className="text-lg font-semibold text-gray-900 mb-4 pb-2 border-b-2 border-amber-600">
              Détails du séjour
            </h3>
            <div className="space-y-2">
              <p className="text-lg font-semibold text-gray-900">{invoice.reservation.room_name}</p>
              <p className="text-gray-700">Type: {invoice.reservation.room_type}</p>
              <div className="grid grid-cols-2 gap-4 mt-3">
                <div>
                  <p className="text-sm text-gray-600">Arrivée</p>
                  <p className="font-semibold text-gray-900">{invoice.reservation.check_in}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-600">Départ</p>
                  <p className="font-semibold text-gray-900">{invoice.reservation.check_out}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-600">Durée</p>
                  <p className="font-semibold text-gray-900">{invoice.reservation.nights} nuit(s)</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Pricing Details */}
        <div className="px-8 pb-8">
          <h3 className="text-lg font-semibold text-gray-900 mb-4 pb-2 border-b-2 border-amber-600">
            Détails de la facturation
          </h3>
          
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Description</th>
                  <th className="px-4 py-3 text-center text-sm font-semibold text-gray-700">
                    {invoice.pricing.quantity_label || 'Nombre de jours'}
                  </th>
                  <th className="px-4 py-3 text-right text-sm font-semibold text-gray-700">Prix unitaire</th>
                  <th className="px-4 py-3 text-right text-sm font-semibold text-gray-700">Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                <tr className="hover:bg-gray-50">
                  <td className="px-4 py-4 text-gray-900">{invoice.pricing.description}</td>
                  <td className="px-4 py-4 text-center text-gray-900">{invoice.pricing.quantity}</td>
                  <td className="px-4 py-4 text-right text-gray-900">{invoice.pricing.unit_price.toLocaleString('fr-FR')} FCFA</td>
                  <td className="px-4 py-4 text-right text-gray-900 font-semibold">{invoice.pricing.total.toLocaleString('fr-FR')} FCFA</td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* Total */}
          <div className="mt-6 flex justify-end">
            <div className="w-full md:w-96">
              <div className="flex justify-between text-xl font-bold text-gray-900 pt-2 border-t-2 border-amber-600">
                <span>Total:</span>
                <span className="text-amber-600">{invoice.pricing.total.toLocaleString('fr-FR')} FCFA</span>
              </div>
            </div>
          </div>
        </div>

        {/* Payment Info */}
        <div className="bg-gray-50 p-8 border-t">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Informations de paiement</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
            <div>
              <p className="text-gray-600">Mode de paiement</p>
              <p className="font-semibold text-gray-900">{invoice.payment_method}</p>
            </div>
            <div>
              <p className="text-gray-600">Type de paiement</p>
              <p className="font-semibold text-gray-900">{invoice.payment_type}</p>
            </div>
            <div>
              <p className="text-gray-600">N° Transaction</p>
              <p className="font-semibold text-gray-900">{invoice.transaction_id}</p>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="bg-gradient-to-r from-amber-600 to-orange-600 text-white p-6 text-center">
          <p className="text-sm mb-2">Merci de votre confiance !</p>
          <p className="text-xs opacity-90">Le Manoir - {invoice.hotel.address} - {invoice.hotel.phone}</p>
          <p className="text-xs opacity-90 mt-1">{invoice.hotel.email}</p>
        </div>
      </div>

      {/* Print Styles */}
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
