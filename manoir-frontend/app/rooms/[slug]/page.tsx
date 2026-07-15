// app/rooms/[slug]/page.tsx
import { Suspense } from 'react';
import RoomClient from './RoomClient';

export function generateStaticParams() {
  return [{ slug: 'preview' }];
}

export default function Page() {
  return (
    <Suspense fallback={<div className="flex h-screen items-center justify-center">Chargement de la chambre...</div>}>
      <RoomClient />
    </Suspense>
  );
}