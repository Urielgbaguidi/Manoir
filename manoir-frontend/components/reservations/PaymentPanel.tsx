"use client";

import { CheckCircle2, Lock, RefreshCw, XCircle } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { ApiError, api, type FeexPayCheckoutConfig, type PaymentResult } from "@/lib/api";
import { formatCurrency } from "@/lib/reservationDisplay";
import { cn } from "@/lib/utils";
import VoucherButton from "./VoucherButton";
import { errorMessage, isRetryableError, useIdempotentIntent } from "./useIdempotentIntent";

export type PayTarget = { kind: "reservation"; id: number } | { kind: "extension"; id: number };

type PaymentInfo = PaymentResult["payment"];
type Phase =
  | "preparing"
  | "ready"
  | "opening"
  | "verifying"
  | "waiting"
  | "success"
  | "failed"
  | "error"
  | "unavailable";

type FeexPayGlobal = {
  init: (containerId: string, options: Record<string, unknown>) => void;
  showPaymentModal?: () => void;
  hidePaymentModal?: () => void;
  hideResultModal?: () => void;
};

declare global {
  interface Window {
    FeexPayButton?: FeexPayGlobal;
  }
}

const POLL_INTERVAL_MS = 4000;
const POLL_DURATION_MS = 2 * 60 * 1000;
/** Délai maximal d'ouverture de la fenêtre FeexPay après le clic. */
const OPEN_TIMEOUT_MS = 8000;
/** Calque de la fenêtre de paiement FeexPay, visible quand il porte `active`. */
const FEEXPAY_OVERLAY = ".feexpay-payment-overlay";

const sdkLoads = new Map<string, Promise<FeexPayGlobal>>();

/** Charge une seule fois le script du checkout officiel FeexPay. */
function loadFeexPaySdk(url: string): Promise<FeexPayGlobal> {
  if (typeof window !== "undefined" && window.FeexPayButton)
    return Promise.resolve(window.FeexPayButton);

  let pending = sdkLoads.get(url);
  if (!pending) {
    pending = new Promise<FeexPayGlobal>((resolve, reject) => {
      const script = document.createElement("script");
      script.src = url;
      script.async = true;
      script.onload = () =>
        window.FeexPayButton
          ? resolve(window.FeexPayButton)
          : reject(new Error("Checkout FeexPay indisponible."));
      script.onerror = () => {
        sdkLoads.delete(url);
        reject(new Error("Impossible de charger le checkout FeexPay. Vérifiez votre connexion."));
      };
      document.head.appendChild(script);
    });
    sdkLoads.set(url, pending);
  }
  return pending;
}

function feexpayModalIsOpen(): boolean {
  return Boolean(document.querySelector(`${FEEXPAY_OVERLAY}.active`));
}

/**
 * Referme toutes les fenêtres FeexPay (paiement et résultat). Le SDK appelle
 * notre callback juste AVANT d'afficher sa fenêtre de résultat : on referme
 * donc aussi au tour suivant, pour que la suite (vérification, confirmation)
 * s'affiche uniquement dans notre page.
 */
function closeFeexPayWindows() {
  const close = () => {
    window.FeexPayButton?.hideResultModal?.();
    window.FeexPayButton?.hidePaymentModal?.();
  };
  close();
  window.setTimeout(close, 0);
  window.setTimeout(close, 300);
}

/** Référence de transaction éventuellement renvoyée par le checkout (simple indice). */
function referenceFrom(response: unknown): string | null {
  if (!response || typeof response !== "object") return null;
  const data = response as Record<string, unknown>;
  const nested = (data.data && typeof data.data === "object" ? data.data : {}) as Record<
    string,
    unknown
  >;
  const candidate =
    data.reference ?? data.transaction_id ?? nested.reference ?? nested.transaction_id;
  return typeof candidate === "string" && /^[A-Za-z0-9_-]+$/.test(candidate) ? candidate : null;
}

/** Opérateur choisi dans le checkout (MTN, Moov…), pour l'affichage seulement. */
function networkFrom(response: unknown): string | null {
  if (!response || typeof response !== "object") return null;
  const network = (response as Record<string, unknown>).reseau;
  return typeof network === "string" && /^[A-Za-z0-9 _-]{1,40}$/.test(network) ? network : null;
}

/** Confirmation renvoyée par le SDK FeexPay en SANDBOX (paiement simulé). */
function sandboxConfirmationFrom(response: unknown): {
  description: string;
  callback_info: { payment_id: number };
  reseau: string | null;
} | null {
  if (!response || typeof response !== "object") return null;
  const data = response as Record<string, unknown>;
  if (data.status !== "SUCCESSFUL" || typeof data.description !== "string") return null;
  const callbackInfo = data.callback_info;
  if (!callbackInfo || typeof callbackInfo !== "object") return null;
  const paymentId = (callbackInfo as Record<string, unknown>).payment_id;
  if (typeof paymentId !== "number") return null;
  return {
    description: data.description,
    callback_info: { payment_id: paymentId },
    reseau: networkFrom(response)
  };
}

function Spinner({ className }: { className?: string }) {
  return (
    <span
      aria-hidden
      className={cn(
        "inline-block size-5 animate-spin rounded-full border-[3px] border-night/30 border-t-night",
        className
      )}
    />
  );
}

/**
 * Paiement d'un séjour ou d'une prolongation via le checkout officiel FeexPay.
 *
 * Un bouton « Payer » ouvre la fenêtre FeexPay, qui gère tout le paiement
 * (choix du moyen, saisie, validation). Le résultat n'est jamais deviné côté
 * navigateur : seul le serveur, qui interroge FeexPay, le déclare.
 */
export default function PaymentPanel({
  target,
  amount,
  disabled = false,
  disabledReason,
  onSuccess
}: {
  target: PayTarget;
  amount: number;
  disabled?: boolean;
  disabledReason?: string;
  onSuccess?: (result: PaymentResult) => void;
}) {
  const containerId = `feexpay-${target.kind}-${target.id}`;
  const buttonId = `${containerId}-pay`;
  const [phase, setPhase] = useState<Phase>("preparing");
  const [payment, setPayment] = useState<PaymentInfo | null>(null);
  const [voucher, setVoucher] = useState<PaymentResult["voucher"]>(null);
  const [error, setError] = useState("");
  const { keyFor, reset, run } = useIdempotentIntent();

  const pollTimer = useRef<number | null>(null);
  const pollUntil = useRef(0);
  const watchTimer = useRef<number | null>(null);
  const mounted = useRef(true);
  const sdkReady = useRef(false);
  const checkoutObserver = useRef<MutationObserver | null>(null);
  const [checkoutReady, setCheckoutReady] = useState(false);
  const [checkoutUnavailable, setCheckoutUnavailable] = useState(false);
  const onSuccessRef = useRef(onSuccess);
  onSuccessRef.current = onSuccess;

  const stopPolling = () => {
    if (pollTimer.current) window.clearTimeout(pollTimer.current);
    pollTimer.current = null;
  };

  const stopWatching = () => {
    if (watchTimer.current) window.clearInterval(watchTimer.current);
    watchTimer.current = null;
  };

  const settle = useCallback(
    (result: PaymentResult): boolean => {
      if (!mounted.current) return true;
      setPayment(result.payment);
      if (result.payment.status === "success") {
        stopPolling();
        setVoucher(result.voucher);
        setPhase("success");
        onSuccessRef.current?.(result);
        return true;
      }
      if (result.payment.status === "failed") {
        stopPolling();
        setError(result.payment.failure_reason || "Le paiement a échoué.");
        setPhase("failed");
        reset();
        return true;
      }
      return false;
    },
    [reset]
  );

  /** Vérification serveur, répétée tant que FeexPay n'a pas conclu. */
  const verify = useCallback(
    async (paymentId: number, reference?: string | null, network?: string | null) => {
      stopPolling();
      stopWatching();
      setPhase("verifying");
      pollUntil.current = Date.now() + POLL_DURATION_MS;

      const tick = async (hint?: string | null) => {
        try {
          const result = await api.verifyPayment(paymentId, hint, network);
          if (settle(result)) return;
        } catch {
          /* coupure ponctuelle : on retente au prochain passage */
        }
        if (!mounted.current) return;
        if (Date.now() < pollUntil.current) {
          pollTimer.current = window.setTimeout(() => void tick(hint), POLL_INTERVAL_MS);
        } else {
          setPhase("waiting");
        }
      };

      await tick(reference);
    },
    [settle]
  );

  /**
   * En SANDBOX, le SDK FeexPay simule un paiement réussi sans créer de
   * transaction. Le serveur confirme ce résultat uniquement si le drapeau
   * FEEXPAY_SANDBOX_TRUST_SDK est activé côté backend.
   */
  const confirmSandbox = useCallback(
    async (
      paymentId: number,
      callback: {
        description: string;
        callback_info: { payment_id: number };
        reseau: string | null;
      }
    ) => {
      if (pollTimer.current) window.clearTimeout(pollTimer.current);
      pollTimer.current = null;
      if (watchTimer.current) window.clearInterval(watchTimer.current);
      watchTimer.current = null;
      setPhase("verifying");
      try {
        const result = await api.confirmSandboxPayment(paymentId, callback);
        if (!settle(result)) {
          setError("La confirmation du paiement sandbox n'a pas abouti.");
          setPhase("error");
        }
      } catch (err) {
        if (!mounted.current) return;
        setError(errorMessage(err, "Impossible de confirmer le paiement sandbox."));
        setPhase("error");
      }
    },
    [settle]
  );

  const mountCheckout = useCallback(
    async (config: FeexPayCheckoutConfig, paymentId: number) => {
      const sdk = await loadFeexPaySdk(config.sdk_url);
      const container = document.getElementById(containerId);
      if (!container || !mounted.current) return;
      container.innerHTML = "";
      sdkReady.current = false;
      setCheckoutReady(false);
      setCheckoutUnavailable(false);

      /*
        Le SDK crée son bouton (ou son message d'erreur) dans ce conteneur
        masqué. On attend le bouton avant d'activer notre propre bouton, pour
        qu'un clic trop rapide ne soit pas perdu. En cas d'identifiants
        invalides, le message brut est retiré et jamais affiché.
      */
      checkoutObserver.current?.disconnect();
      const observer = new MutationObserver(() => {
        if (container.querySelector(".feexpay-button")) {
          sdkReady.current = true;
          setCheckoutReady(true);
          setCheckoutUnavailable(false);
          checkoutObserver.current?.disconnect();
          return;
        }
        const error = container.querySelector(".feexpay-error-message");
        if (error) {
          error.remove();
          sdkReady.current = false;
          setCheckoutReady(true);
          setCheckoutUnavailable(true);
          checkoutObserver.current?.disconnect();
        }
      });
      checkoutObserver.current = observer;
      observer.observe(container, { childList: true, subtree: true });

      // Le SDK prépare la fenêtre officielle FeexPay. Notre bouton visible
      // l'ouvre ensuite avec showPaymentModal().
      sdk.init(containerId, {
        id: config.id,
        amount: config.amount,
        token: config.token,
        mode: config.mode,
        currency: config.currency,
        custom_id: config.custom_id,
        description: config.description,
        callback_info: config.callback_info,
        // Le client ne saisit que son numéro : nom et e-mail sont connus
        // du compte et ne lui sont pas redemandés.
        fields_to_hide: ["name", "email"],
        // FeexPay a terminé : on referme sa fenêtre tout de suite, puis le
        // serveur vérifie le vrai statut. En SANDBOX, le SDK simule la
        // réussite sans transaction : confirmation sandbox dédiée.
        callback: (response: unknown) => {
          closeFeexPayWindows();
          if (config.mode === "SANDBOX") {
            const sandbox = sandboxConfirmationFrom(response);
            if (sandbox) {
              void confirmSandbox(paymentId, sandbox);
              return;
            }
          }
          void verify(paymentId, referenceFrom(response), networkFrom(response));
        }
      });
    },
    [confirmSandbox, containerId, verify]
  );

  const prepare = useCallback(async () => {
    setError("");
    setPhase("preparing");
    checkoutObserver.current?.disconnect();
    sdkReady.current = false;
    setCheckoutReady(false);
    setCheckoutUnavailable(false);
    const signature = `${target.kind}:${target.id}:${amount}`;

    await run(async () => {
      try {
        const key = keyFor(signature);
        const result =
          target.kind === "reservation"
            ? await api.payReservation(target.id, key)
            : await api.payExtension(target.id, key);

        if (!mounted.current || settle(result)) return;

        setPayment(result.payment);
        if (!result.checkout) {
          setError("Le paiement n'a pas pu être préparé. Réessayez.");
          setPhase("error");
          return;
        }
        await mountCheckout(result.checkout, result.payment.id);
        if (mounted.current) setPhase("ready");
      } catch (err) {
        if (!mounted.current) return;
        if (!isRetryableError(err)) reset();
        if (err instanceof ApiError && err.status === 503) {
          setPhase("unavailable");
          return;
        }
        setError(errorMessage(err, "Impossible de préparer le paiement."));
        setPhase("error");
      }
    });
  }, [amount, keyFor, mountCheckout, reset, run, settle, target.id, target.kind]);

  /**
   * Clic sur « Payer » : le bouton grossit et tourne jusqu'à l'ouverture de
   * la fenêtre FeexPay, puis reprend son état normal si la fenêtre est
   * refermée sans paiement.
   */
  const handlePayClick = () => {
    if (phase !== "ready") return;
    if (checkoutUnavailable) {
      setError("Le paiement en ligne est momentanément indisponible. Contactez l'administration.");
      return;
    }
    if (!checkoutReady || !sdkReady.current) return;
    setPhase("opening");
    stopWatching();

    // Le SDK est prêt (bouton créé dans le conteneur masqué) : on ouvre
    // directement sa fenêtre officielle.
    window.FeexPayButton?.showPaymentModal?.();

    const startedAt = Date.now();
    let opened = false;

    watchTimer.current = window.setInterval(() => {
      if (!mounted.current) return stopWatching();
      const isOpen = feexpayModalIsOpen();

      if (!opened && isOpen) {
        opened = true;
        return;
      }

      // Fenêtre refermée sans retour de FeexPay : on revient au bouton.
      if (opened && !isOpen) {
        stopWatching();
        setPhase((current) => (current === "opening" ? "ready" : current));
        return;
      }

      if (!opened && Date.now() - startedAt > OPEN_TIMEOUT_MS) {
        stopWatching();
        setPhase((current) => (current === "opening" ? "ready" : current));
        setError("La fenêtre de paiement FeexPay ne s'est pas ouverte. Réessayez dans un instant.");
      }
    }, 150);
  };

  useEffect(() => {
    mounted.current = true;
    if (!disabled) void prepare();
    return () => {
      mounted.current = false;
      checkoutObserver.current?.disconnect();
      stopPolling();
      stopWatching();
    };
    // Une préparation par cible : pas à chaque rendu.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [disabled, target.kind, target.id]);

  if (disabled) {
    return (
      <div className="rounded-2xl border border-gold/20 bg-white/5 p-4 text-sm text-cream/70">
        {disabledReason || "Le paiement n'est pas disponible pour le moment."}
      </div>
    );
  }

  if (phase === "unavailable") {
    return (
      <div className="rounded-2xl border border-gold/25 bg-gold/10 p-4 text-sm leading-6 text-cream/80">
        Paiement en ligne bientôt disponible. Votre séjour reste réservé jusqu&apos;à
        l&apos;échéance indiquée ; contactez-nous si besoin.
      </div>
    );
  }

  if (phase === "success") {
    return (
      <div className="space-y-4 rounded-2xl border border-olive/40 bg-olive/10 p-5">
        <p className="flex items-center gap-2 text-sm font-semibold text-olive-light">
          <CheckCircle2 size={18} /> Paiement confirmé.
        </p>
        {voucher && (
          <VoucherButton
            voucherId={voucher.id}
            label={`Télécharger le Bon de Séjour ${voucher.number}`}
          />
        )}
      </div>
    );
  }

  const sdkPreparing = phase === "ready" && !checkoutReady;
  const busy =
    phase === "preparing" || phase === "opening" || phase === "verifying" || sdkPreparing;
  const buttonLabel =
    phase === "preparing" || sdkPreparing
      ? "Préparation du paiement…"
      : phase === "opening"
        ? "Ouverture du paiement sécurisé…"
        : "Vérification du paiement…";

  return (
    <div className="space-y-4 rounded-2xl border border-gold/20 bg-white/5 p-5">
      <div className="flex items-baseline justify-between gap-4">
        <p className="text-sm text-cream/70">Montant à régler</p>
        <p className="font-display text-2xl font-semibold text-gold-light">
          {formatCurrency(amount)}
        </p>
      </div>

      {/*
        Notre bouton reste toujours visible. Il ouvre la fenêtre officielle
        FeexPay une fois que le SDK a fini de préparer son checkout.
      */}
      <button
        id={buttonId}
        type="button"
        onClick={handlePayClick}
        disabled={phase !== "ready" || !checkoutReady}
        aria-busy={busy}
        className={cn(
          "flex w-full items-center justify-center gap-3 rounded-full bg-gradient-to-br from-gold-light to-gold font-bold uppercase tracking-[0.2em] text-night shadow-lg shadow-gold/20 transition-all duration-300 ease-out",
          "hover:brightness-105 disabled:cursor-not-allowed",
          busy ? "scale-[1.04] py-5 text-sm" : "py-4 text-xs",
          phase === "failed" || phase === "error" || phase === "waiting" ? "hidden" : "",
          !busy && phase !== "ready" ? "opacity-50" : ""
        )}
      >
        {busy ? (
          <>
            <Spinner />
            {buttonLabel}
          </>
        ) : (
          <>Payer {formatCurrency(amount)}</>
        )}
      </button>

      <p className="flex items-start gap-2 text-xs leading-5 text-cream/55">
        <Lock size={14} className="mt-0.5 shrink-0" />
        Paiement sécurisé par FeexPay : saisissez simplement votre numéro Mobile Money.
      </p>

      {/*
        Zone technique du SDK FeexPay. Elle reste masquée : notre bouton
        personnalisé déclenche le checkout, et le message brut du SDK
        (identifiants incorrects, etc.) ne doit jamais apparaître.
      */}
      <div id={containerId} className="hidden" aria-hidden="true" />

      {error && phase === "ready" && (
        <p className="flex items-start gap-2 text-xs font-semibold text-terracotta-light">
          <XCircle size={14} className="mt-0.5 shrink-0" /> {error}
        </p>
      )}

      {phase === "ready" && payment && (
        <button
          type="button"
          onClick={() => void verify(payment.id)}
          className="text-xs font-semibold text-cream/50 underline-offset-4 transition hover:text-gold-light hover:underline"
        >
          J&apos;ai déjà payé : vérifier le paiement
        </button>
      )}

      {phase === "waiting" && payment && (
        <div className="space-y-3 text-sm text-cream/70">
          <p>
            FeexPay n&apos;a pas encore confirmé le paiement. S&apos;il est validé de votre côté,
            vérifiez à nouveau dans un instant.
          </p>
          <button
            type="button"
            onClick={() => void verify(payment.id)}
            className="inline-flex items-center gap-2 rounded-full border border-gold/30 px-5 py-2.5 text-xs font-semibold text-cream/80 hover:border-gold/60"
          >
            <RefreshCw size={14} /> Vérifier à nouveau
          </button>
        </div>
      )}

      {(phase === "failed" || phase === "error") && (
        <div className="space-y-3">
          <p className="flex items-start gap-2 rounded-2xl border border-terracotta/40 bg-terracotta/15 p-4 text-xs font-semibold text-terracotta-light">
            <XCircle size={16} className="shrink-0" /> {error}
          </p>
          <button
            type="button"
            onClick={() => void prepare()}
            className="inline-flex items-center gap-2 rounded-full bg-gradient-to-br from-gold-light to-gold px-6 py-3 text-xs font-bold uppercase tracking-[0.2em] text-night"
          >
            <RefreshCw size={14} /> Réessayer
          </button>
        </div>
      )}
    </div>
  );
}
