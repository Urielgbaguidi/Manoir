"use client";

import { CheckCircle2, Hourglass, RefreshCw, XCircle } from "lucide-react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useCallback, useEffect, useRef, useState } from "react";
import { ClientPageHeader } from "@/components/dashboard/client/ClientShell";
import VoucherButton from "@/components/reservations/VoucherButton";
import { errorMessage } from "@/components/reservations/useIdempotentIntent";
import { api, type PaymentResult } from "@/lib/api";
import { formatCurrency, reservationHref } from "@/lib/reservationDisplay";

const POLL_INTERVAL_MS = 4000;
const MAX_ATTEMPTS = 8;

type Phase = "checking" | "pending" | "success" | "failed" | "error" | "missing";

export default function PaymentReturnPage() {
  // useSearchParams impose une frontière Suspense avec l'export statique.
  return (
    <Suspense fallback={<Loader />}>
      <PaymentReturnContent />
    </Suspense>
  );
}

function Loader() {
  return (
    <div className="flex min-h-[50vh] items-center justify-center">
      <div className="h-10 w-10 animate-spin rounded-full border-[3px] border-gold border-t-transparent" />
    </div>
  );
}

/**
 * Retour de la page carte FeexPay (`?ref=...&status=...`).
 *
 * Le `status` de l'URL n'est JAMAIS pris en compte : il peut être modifié à la
 * main. Seule la vérification serveur auprès de FeexPay fait foi.
 */
function PaymentReturnContent() {
  const searchParams = useSearchParams();
  const reference = searchParams.get("ref") || searchParams.get("reference") || "";

  const [phase, setPhase] = useState<Phase>(reference ? "checking" : "missing");
  const [result, setResult] = useState<PaymentResult | null>(null);
  const [error, setError] = useState("");
  const [reservationId, setReservationId] = useState<number | null>(null);
  const run = useRef(0);

  /** Retrouve la réservation du paiement, pour proposer un lien direct. */
  const findReservation = useCallback(async (paymentId: number) => {
    try {
      const reservations = await api.getMyReservations();
      const match = reservations.find((reservation) =>
        (reservation.payments || []).some((payment) => payment.id === paymentId)
      );
      if (match) setReservationId(match.id);
    } catch {
      /* le lien générique vers « Mes réservations » reste proposé */
    }
  }, []);

  const verify = useCallback(async () => {
    if (!reference) return;
    const current = ++run.current;
    setPhase("checking");
    setError("");

    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
      try {
        const response = await api.verifyPaymentReference(reference);
        if (current !== run.current) return;
        setResult(response);

        if (response.payment.status !== "pending") {
          setPhase(response.payment.status === "success" ? "success" : "failed");
          findReservation(response.payment.id);
          return;
        }
        if (attempt === 1) findReservation(response.payment.id);
      } catch (err) {
        if (current !== run.current) return;
        if (attempt === MAX_ATTEMPTS) {
          setError(errorMessage(err, "Impossible de vérifier ce paiement pour le moment."));
          setPhase("error");
          return;
        }
      }

      if (attempt < MAX_ATTEMPTS) {
        await new Promise((resolve) => window.setTimeout(resolve, POLL_INTERVAL_MS));
        if (current !== run.current) return;
      }
    }

    setPhase("pending");
  }, [reference, findReservation]);

  useEffect(() => {
    verify();
    return () => {
      // Invalide la boucle en cours (démontage, ou double montage en développement).
      run.current += 1;
    };
  }, [verify]);

  const reservationLink = reservationId
    ? reservationHref(reservationId)
    : "/espace-client/reservations";
  const amount = result?.payment.amount;

  return (
    <div className="mx-auto max-w-xl">
      <ClientPageHeader
        title="Paiement"
        description="Nous vérifions votre paiement directement auprès de FeexPay."
      />

      <div className="glass-warm glass-edge rounded-3xl p-6 text-center sm:p-10">
        {phase === "checking" && (
          <div className="flex flex-col items-center gap-4">
            <span className="h-12 w-12 animate-spin rounded-full border-4 border-gold border-t-transparent" />
            <p className="font-semibold text-cream">Vérification du paiement en cours…</p>
            <p className="text-sm text-cream/55">
              Cela prend généralement quelques secondes. Merci de ne pas fermer cette page.
            </p>
          </div>
        )}

        {phase === "success" && (
          <div className="flex flex-col items-center gap-4">
            <CheckCircle2 className="h-14 w-14 text-olive-light" />
            <h2 className="font-display text-2xl font-bold text-olive-light">Paiement confirmé</h2>
            <p className="text-sm leading-6 text-cream/70">
              {amount ? `${formatCurrency(amount)} reçus. ` : ""}
              {result?.payment.payment_type === "extension"
                ? "Votre séjour est prolongé."
                : "Votre séjour est confirmé."}{" "}
              Votre Bon de Séjour est disponible.
            </p>
            <div className="mt-2 flex w-full flex-col gap-3 sm:flex-row sm:justify-center">
              {result?.voucher && <VoucherButton voucherId={result.voucher.id} />}
              <Link
                href={reservationLink}
                className="inline-flex items-center justify-center rounded-xl border border-gold/20 px-5 py-3 text-[10px] font-black uppercase tracking-wider text-cream transition hover:border-gold/40 hover:bg-white/10 hover:text-gold-light"
              >
                Voir ma réservation
              </Link>
            </div>
          </div>
        )}

        {phase === "failed" && (
          <div className="flex flex-col items-center gap-4">
            <XCircle className="h-14 w-14 text-terracotta-light" />
            <h2 className="font-display text-2xl font-bold text-terracotta-light">
              Paiement non abouti
            </h2>
            <p className="text-sm leading-6 text-cream/70">
              {result?.payment.failure_reason ||
                result?.message ||
                "Le paiement a été refusé ou annulé."}{" "}
              Aucun montant n&apos;a été validé : vous pouvez faire une nouvelle tentative depuis
              votre réservation.
            </p>
            <Link
              href={reservationLink}
              className="mt-2 inline-flex items-center justify-center rounded-full bg-gradient-to-br from-gold-light to-gold px-6 py-3 text-xs font-bold uppercase tracking-[0.16em] text-night transition hover:brightness-105"
            >
              Retour à ma réservation
            </Link>
          </div>
        )}

        {(phase === "pending" || phase === "error") && (
          <div className="flex flex-col items-center gap-4">
            <Hourglass className="h-12 w-12 text-gold-light" />
            <h2 className="font-display text-2xl font-bold text-cream">
              {phase === "pending"
                ? "Paiement en cours de confirmation"
                : "Vérification impossible"}
            </h2>
            <p className="text-sm leading-6 text-cream/70">
              {phase === "pending"
                ? "FeexPay n'a pas encore confirmé ce paiement. Patientez quelques instants puis vérifiez à nouveau : votre réservation sera mise à jour automatiquement dès la confirmation."
                : error}
            </p>
            <div className="mt-2 flex w-full flex-col gap-3 sm:flex-row sm:justify-center">
              <button
                type="button"
                onClick={verify}
                className="inline-flex items-center justify-center gap-2 rounded-full bg-gradient-to-br from-gold-light to-gold px-6 py-3 text-xs font-bold uppercase tracking-[0.16em] text-night transition hover:brightness-105"
              >
                <RefreshCw size={14} /> Vérifier à nouveau
              </button>
              <Link
                href={reservationLink}
                className="inline-flex items-center justify-center rounded-xl border border-gold/20 px-5 py-3 text-[10px] font-black uppercase tracking-wider text-cream transition hover:border-gold/40 hover:bg-white/10"
              >
                Mes réservations
              </Link>
            </div>
          </div>
        )}

        {phase === "missing" && (
          <div className="flex flex-col items-center gap-4">
            <XCircle className="h-12 w-12 text-terracotta-light" />
            <h2 className="font-display text-2xl font-bold text-cream">
              Référence de paiement absente
            </h2>
            <p className="text-sm leading-6 text-cream/70">
              Nous n&apos;avons pas reçu de référence de paiement. Si vous avez annulé le paiement,
              vous pouvez le relancer depuis votre réservation.
            </p>
            <Link
              href="/espace-client/reservations"
              className="mt-2 inline-flex items-center justify-center rounded-full bg-gradient-to-br from-gold-light to-gold px-6 py-3 text-xs font-bold uppercase tracking-[0.16em] text-night transition hover:brightness-105"
            >
              Mes réservations
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
