// app/reservations/[id]/invoice/page.tsx
import { Suspense } from 'react';
import ReservationInvoiceClient from './ReservationInvoiceClient';

export function generateStaticParams() {
  return [{ id: 'preview' }];
}

export default function Page() {
  return (
    <Suspense fallback={<div className="flex h-screen items-center justify-center">Chargement de la facture...</div>}>
      <ReservationInvoiceClient />
    </Suspense>
  );
}