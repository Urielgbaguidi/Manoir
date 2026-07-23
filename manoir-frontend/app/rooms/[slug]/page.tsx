// app/rooms/[slug]/page.tsx
import { Suspense } from "react";
import { ROOM_CATEGORY_CONFIG, ROOM_CATEGORY_ORDER } from "@/lib/roomCategories";
import RoomClient from "./RoomClient";

// Pré-génère les vraies fiches de catégorie (pour qu'elles fonctionnent en dev
// ET en export statique), plus un shell "preview" utilisé par le fallback .htaccess
// pour tout autre slug (unités VIP, etc.) résolu côté client.
export function generateStaticParams() {
  return [
    ...ROOM_CATEGORY_ORDER.map((category) => ({
      slug: ROOM_CATEGORY_CONFIG[category].slug
    })),
    { slug: "preview" }
  ];
}

export default function Page() {
  return (
    <Suspense
      fallback={
        <div className="flex h-screen items-center justify-center">Chargement de la chambre...</div>
      }
    >
      <RoomClient />
    </Suspense>
  );
}
