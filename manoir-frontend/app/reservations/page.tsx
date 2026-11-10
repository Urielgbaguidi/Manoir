"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/**
 * Ancienne adresse de « Mes réservations ». La page vit désormais dans
 * l'espace client ; on conserve les paramètres (ex. ?payer=12).
 */
export default function LegacyReservationsRedirect() {
  const router = useRouter();

  useEffect(() => {
    router.replace(`/espace-client/reservations${window.location.search}`);
  }, [router]);

  return (
    <div className="grid min-h-screen place-items-center">
      <span className="size-10 animate-spin rounded-full border-[3px] border-gold border-t-transparent" />
    </div>
  );
}
