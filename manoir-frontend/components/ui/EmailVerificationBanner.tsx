"use client";

import Link from "next/link";
import { MailWarning } from "lucide-react";
import type { User } from "@/lib/api";

/**
 * Rappel affiche tant que l'adresse email du client n'est pas confirmee.
 *
 * Le compte reste pleinement utilisable : la confirmation securise le compte
 * et fiabilise les mails de reservation, elle ne bloque rien.
 */
export default function EmailVerificationBanner({ user }: { user: User | null }) {
  // `undefined` = ancienne reponse d'API sans le champ : on n'affiche rien
  // plutot que d'alarmer a tort.
  if (!user || user.email_verified_at !== null) {
    return null;
  }

  return (
    <div className="mb-8 flex flex-col gap-4 rounded-2xl border border-gold/30 bg-gold/[0.07] p-5 backdrop-blur-md sm:flex-row sm:items-center sm:justify-between">
      <div className="flex items-start gap-3">
        <MailWarning className="mt-0.5 h-5 w-5 shrink-0 text-gold-light" />
        <div className="space-y-1">
          <p className="text-sm font-semibold text-cream">Confirmez votre adresse email</p>
          <p className="text-xs leading-5 text-cream/60">
            Un code à 6 chiffres a été envoyé à{" "}
            <span className="text-gold-light">{user.email}</span>. Sans confirmation, nous ne
            pourrons pas vous joindre au sujet de vos réservations.
          </p>
        </div>
      </div>

      <Link
        href="/auth/confirmer-email"
        className="shrink-0 rounded-xl border border-gold/30 bg-white/5 px-5 py-2.5 text-center text-[10px] font-black uppercase tracking-[0.22em] text-cream transition hover:border-gold/50 hover:bg-white/10 hover:text-gold-light"
      >
        Saisir mon code
      </Link>
    </div>
  );
}
