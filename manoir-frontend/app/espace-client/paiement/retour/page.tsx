"use client";

import { Hourglass, RefreshCw, XCircle } from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { ClientPageHeader } from "@/components/dashboard/client/ClientShell";
import { errorMessage, isRetryableError } from "@/components/reservations/useIdempotentIntent";
import { useToast } from "@/context/ToastContext";
import { api, type PaymentResult } from "@/lib/api";
import {
  PAYMENT_SUCCESS_MESSAGE,
  claimPaymentAnnouncement,
  takePaymentHandoff,
  type PaymentHandoff
} from "@/lib/paymentHandoff";
import { reservationHref } from "@/lib/reservationDisplay";

const POLL_INTERVAL_MS = 4000;
const MAX_ATTEMPTS = 8;
const RESERVATIONS_HREF = "/espace-client/reservations";

/**
 * `checking` : vérification en cours ; `leaving` : verdict rendu, retour vers
 * la réservation ; `pending` : FeexPay n'a pas conclu dans le délai imparti.
 */
type Phase = "checking" | "leaving" | "pending" | "missing";

export default function PaymentReturnPage() {
  // useSearchParams impose une frontière Suspense avec l'export statique.
  return (
    <Suspense fallback={<VerifyingState />}>
      <PaymentReturnContent />
    </Suspense>
  );
}

/**
 * Retour du checkout FeexPay (`?payment=<id>&ref=...&status=...`), après un
 * paiement par carte ou Mobile Money.
 *
 * Le `status` de l'URL n'est JAMAIS pris en compte : il peut être modifié à la
 * main. Seule la vérification serveur auprès de FeexPay fait foi ; `ref`
 * n'est qu'un indice, contrôlé par le serveur.
 *
 * Dès que le serveur conclut (réussite ou échec), ou si la vérification est
 * impossible, le client est ramené sur sa réservation avec une notification.
 * La page est remplacée dans l'historique : « Retour » n'y ramène pas.
 */
function PaymentReturnContent() {
  const router = useRouter();
  const { showToast } = useToast();
  const searchParams = useSearchParams();
  const reference = searchParams.get("ref") || searchParams.get("reference") || "";
  const paymentParam = Number(searchParams.get("payment"));
  const paymentId = Number.isInteger(paymentParam) && paymentParam > 0 ? paymentParam : null;
  const canVerify = paymentId !== null || reference !== "";

  const [phase, setPhase] = useState<Phase>(canVerify ? "checking" : "missing");
  const [reservationId, setReservationId] = useState<number | null>(null);
  const run = useRef(0);

  /** Indices laissés par le panneau de paiement (lus une seule fois). */
  const handoff = useRef<PaymentHandoff | null | undefined>(undefined);

  const check = useCallback(async (): Promise<PaymentResult> => {
    if (paymentId === null) return api.verifyPaymentReference(reference);

    if (handoff.current === undefined) handoff.current = takePaymentHandoff(paymentId);
    const sandbox = handoff.current?.sandbox;
    if (sandbox && sandbox.callback_info.payment_id === paymentId) {
      try {
        const confirmed = await api.confirmSandboxPayment(paymentId, sandbox);
        if (confirmed.payment.status !== "pending") return confirmed;
      } catch {
        /* confirmation sandbox désactivée : vérification normale */
      }
    }
    return api.verifyPayment(paymentId, reference || null, handoff.current?.network ?? null);
  }, [paymentId, reference]);

  /**
   * Retour à la réservation concernée (à défaut, à la liste), avec la
   * notification du verdict. `message` nul : rien à notifier.
   */
  const leave = useCallback(
    (target: number | null, message: string | null, tone: "success" | "error") => {
      setPhase("leaving");
      if (message) showToast(message, tone);
      router.replace(target ? reservationHref(target) : RESERVATIONS_HREF);
    },
    [router, showToast]
  );

  const verify = useCallback(async () => {
    if (!canVerify) return;
    const current = ++run.current;
    setPhase("checking");
    let target: number | null = null;

    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
      try {
        const { payment, message } = await check();
        if (current !== run.current) return;
        if (payment.reservation_id) {
          target = payment.reservation_id;
          setReservationId(target);
        }

        if (payment.status === "success") {
          // Déjà annoncé par le panneau dans cette page : pas de doublon.
          const announce = claimPaymentAnnouncement(payment.id);
          leave(target, announce ? PAYMENT_SUCCESS_MESSAGE : null, "success");
          return;
        }
        if (payment.status === "failed") {
          const reason = payment.failure_reason || message || "Le paiement a été refusé ou annulé.";
          leave(target, `Paiement non abouti. ${reason}`, "error");
          return;
        }
      } catch (err) {
        if (current !== run.current) return;
        // Erreur définitive (accès refusé, paiement inconnu…) ou essais épuisés.
        if (!isRetryableError(err) || attempt === MAX_ATTEMPTS) {
          leave(
            target,
            errorMessage(err, "Impossible de vérifier ce paiement pour le moment."),
            "error"
          );
          return;
        }
      }

      if (attempt < MAX_ATTEMPTS) {
        await new Promise((resolve) => window.setTimeout(resolve, POLL_INTERVAL_MS));
        if (current !== run.current) return;
      }
    }

    // Toujours en attente : pas de redirection à l'aveugle.
    setPhase("pending");
  }, [canVerify, check, leave]);

  useEffect(() => {
    void verify();
    return () => {
      // Invalide la boucle en cours (démontage, ou double montage en développement).
      run.current += 1;
    };
  }, [verify]);

  if (phase === "checking" || phase === "leaving") return <VerifyingState />;

  const reservationLink = reservationId ? reservationHref(reservationId) : RESERVATIONS_HREF;

  return (
    <div>
      <ClientPageHeader
        title="Paiement"
        description="Nous vérifions votre paiement directement auprès de FeexPay."
      />

      {phase === "pending" ? (
        <StatusCard
          icon={<Hourglass className="size-12 text-gold-light" />}
          title="Paiement en cours de confirmation"
          text="FeexPay n'a pas encore confirmé ce paiement. Patientez quelques instants puis vérifiez à nouveau : votre réservation sera mise à jour automatiquement dès la confirmation."
        >
          <button
            type="button"
            onClick={() => void verify()}
            className="inline-flex items-center justify-center gap-2 rounded-full bg-gradient-to-br from-gold-light to-gold px-6 py-3 text-xs font-bold uppercase tracking-[0.16em] text-night transition hover:brightness-105"
          >
            <RefreshCw size={14} /> Vérifier à nouveau
          </button>
          <Link
            href={reservationLink}
            replace
            className="inline-flex items-center justify-center rounded-full border border-gold/25 px-6 py-3 text-xs font-bold uppercase tracking-[0.16em] text-cream transition hover:border-gold/50 hover:text-gold-light"
          >
            {reservationId ? "Voir ma réservation" : "Mes réservations"}
          </Link>
        </StatusCard>
      ) : (
        <StatusCard
          icon={<XCircle className="size-12 text-terracotta-light" />}
          title="Référence de paiement absente"
          text="Nous n'avons pas reçu de référence de paiement. Si vous avez annulé le paiement, vous pouvez le relancer depuis votre réservation."
        >
          <Link
            href={RESERVATIONS_HREF}
            replace
            className="inline-flex items-center justify-center rounded-full bg-gradient-to-br from-gold-light to-gold px-6 py-3 text-xs font-bold uppercase tracking-[0.16em] text-night transition hover:brightness-105"
          >
            Mes réservations
          </Link>
        </StatusCard>
      )}
    </div>
  );
}

/** État de vérification : occupe toute la zone de contenu. */
function VerifyingState() {
  return (
    <div
      role="status"
      aria-live="polite"
      className="glass-warm glass-edge flex min-h-[60vh] w-full flex-col items-center justify-center gap-5 rounded-3xl p-6 text-center sm:p-10"
    >
      <span
        aria-hidden
        className="size-14 animate-spin rounded-full border-4 border-gold border-t-transparent"
      />
      <div className="space-y-2">
        <p className="font-display text-2xl font-semibold text-cream">
          Vérification de votre paiement…
        </p>
        <p className="mx-auto max-w-md text-sm leading-6 text-cream/60">
          Nous interrogeons FeexPay, cela prend généralement quelques secondes. Merci de ne pas
          fermer cette page : vous serez ramené à votre réservation automatiquement.
        </p>
      </div>
    </div>
  );
}

function StatusCard({
  icon,
  title,
  text,
  children
}: {
  icon: ReactNode;
  title: string;
  text: string;
  children: ReactNode;
}) {
  return (
    <div className="glass-warm glass-edge flex w-full flex-col items-center gap-4 rounded-3xl p-6 text-center sm:p-10">
      {icon}
      <h2 className="font-display text-2xl font-bold text-cream">{title}</h2>
      {/* Colonne de lecture étroite pour le message, la carte reste pleine largeur. */}
      <p className="max-w-lg text-sm leading-6 text-cream/70">{text}</p>
      <div className="mt-2 flex w-full flex-col gap-3 sm:w-auto sm:flex-row sm:justify-center">
        {children}
      </div>
    </div>
  );
}
