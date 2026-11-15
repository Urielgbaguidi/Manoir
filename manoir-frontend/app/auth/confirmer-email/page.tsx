"use client";

import { BadgeCheck, CircleAlert, RefreshCw } from "lucide-react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import AuthShell from "@/components/auth/AuthShell";
import { useAuth } from "@/context/AuthContext";
import { useToast } from "@/context/ToastContext";
import { ApiError, api } from "@/lib/api";

/** Délai entre deux renvois (le serveur limite aussi à 3 envois par heure). */
const RESEND_COOLDOWN_SECONDS = 60;

type Phase =
  /** En attente : le client doit ouvrir le lien reçu par e-mail. */
  | "inbox"
  /** Lien ouvert : vérification auprès du serveur. */
  | "verifying"
  | "verified"
  /** Lien expiré, déjà remplacé ou incomplet. */
  | "invalid"
  | "already";

const SHELL = {
  image: "/assets/rooms/room2.jpg",
  headline: "Plus qu'une étape avant votre séjour.",
  bare: true
} as const;

/**
 * Confirmation de l'adresse e-mail par lien.
 *
 * - Sans jeton : « Vérifiez votre boîte mail », avec renvoi du lien.
 * - Avec jeton (lien du mail) : vérification automatique, puis ouverture de
 *   la session et redirection.
 */
function ConfirmerEmailContent() {
  const searchParams = useSearchParams();
  const { user, verifyEmail } = useAuth();
  const { showToast } = useToast();

  const email = (searchParams.get("email") || user?.email || "").trim();
  const token = searchParams.get("token") || "";

  const [phase, setPhase] = useState<Phase>(token ? "verifying" : "inbox");
  const [error, setError] = useState("");
  const [resending, setResending] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  const [linkSent, setLinkSent] = useState(false);
  const attempted = useRef(false);

  // Le lien ne doit être consommé qu'une fois (double montage en développement).
  useEffect(() => {
    if (!token || attempted.current) return;
    attempted.current = true;

    if (!email) {
      setError("Ce lien de confirmation est incomplet. Ouvrez-le directement depuis l'e-mail.");
      setPhase("invalid");
      return;
    }

    verifyEmail(email, token)
      .then(() => setPhase("verified"))
      .catch((err: unknown) => {
        if (err instanceof ApiError && err.reason === "already_verified") {
          setPhase("already");
          return;
        }
        setError(
          err instanceof Error
            ? err.message
            : "Ce lien de confirmation est invalide ou a expiré. Demandez-en un nouveau."
        );
        setPhase("invalid");
      });
  }, [email, token, verifyEmail]);

  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = window.setTimeout(() => setCooldown((value) => value - 1), 1000);
    return () => window.clearTimeout(timer);
  }, [cooldown]);

  const resend = useCallback(async () => {
    if (!email || resending || cooldown > 0) return;
    setResending(true);
    try {
      await api.resendEmailVerification(email);
      setLinkSent(true);
      setCooldown(RESEND_COOLDOWN_SECONDS);
      setPhase("inbox");
      setError("");
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Impossible d'envoyer le lien.", "error");
    } finally {
      setResending(false);
    }
  }, [cooldown, email, resending, showToast]);

  const resendButton = (
    <button
      type="button"
      onClick={resend}
      disabled={!email || resending || cooldown > 0}
      className="flex h-12 w-full items-center justify-center gap-2 rounded-full bg-gradient-to-br from-gold-light to-gold text-sm font-bold tracking-wide text-night transition hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-60"
    >
      {resending ? (
        <span className="inline-block size-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
      ) : (
        <RefreshCw size={16} />
      )}
      {cooldown > 0
        ? `Renvoyer l'e-mail de vérification (${cooldown} s)`
        : "Renvoyer l'e-mail de vérification"}
    </button>
  );

  if (phase === "verifying") {
    return (
      <AuthShell
        {...SHELL}
        title="Confirmation en cours…"
        subtitle="Nous vérifions votre lien de confirmation. Cela ne prend qu'un instant."
      >
        <div
          role="status"
          className="flex items-center gap-4 rounded-2xl border border-gold/15 bg-white/5 p-5"
        >
          <span className="inline-block size-8 shrink-0 animate-spin rounded-full border-[3px] border-gold border-t-transparent" />
          <p className="text-sm text-cream/70">Activation de votre compte…</p>
        </div>
      </AuthShell>
    );
  }

  if (phase === "verified") {
    return (
      <AuthShell
        {...SHELL}
        title="Adresse confirmée"
        subtitle="Votre compte est actif. Nous vous connectons à votre espace…"
      >
        <StatusIcon tone="success" icon={BadgeCheck} />
      </AuthShell>
    );
  }

  if (phase === "already") {
    return (
      <AuthShell
        {...SHELL}
        title="Adresse déjà confirmée"
        subtitle="Votre adresse e-mail a déjà été confirmée. Connectez-vous pour accéder à votre espace."
      >
        <div className="space-y-6">
          <StatusIcon tone="success" icon={BadgeCheck} />
          <PrimaryLink href="/auth/login">Se connecter</PrimaryLink>
        </div>
      </AuthShell>
    );
  }

  if (phase === "invalid") {
    return (
      <AuthShell
        {...SHELL}
        title="Lien invalide ou expiré"
        subtitle={error || "Ce lien de confirmation ne fonctionne plus. Demandez-en un nouveau."}
      >
        <div className="space-y-6">
          <StatusIcon tone="error" icon={CircleAlert} />
          {email ? (
            <>
              <p className="text-sm leading-6 text-cream/70">
                Nous enverrons un nouveau lien à <strong className="text-cream">{email}</strong>.
                Seul le dernier lien reçu fonctionne.
              </p>
              {resendButton}
            </>
          ) : (
            <PrimaryLink href="/auth/login">Se connecter</PrimaryLink>
          )}
        </div>
      </AuthShell>
    );
  }

  // Écran d'attente, sur le modèle de la vérification d'e-mail de Laravel Breeze.
  return (
    <AuthShell
      {...SHELL}
      title="Vérification de l'e-mail"
      subtitle="Merci de vous être inscrit(e) ! Avant de commencer, veuillez vérifier votre adresse e-mail en cliquant sur le lien que nous venons de vous envoyer. Si vous n'avez pas reçu cet e-mail, nous vous en enverrons un nouveau avec plaisir."
    >
      <div className="space-y-6">
        {linkSent && (
          <p role="status" className="text-sm font-medium leading-6 text-olive-light">
            Un nouveau lien de vérification a été envoyé à l&apos;adresse e-mail que vous avez
            indiquée lors de votre inscription.
          </p>
        )}

        {resendButton}

        <p className="text-center text-sm text-cream/60">
          <Link
            href="/auth/login"
            className="font-semibold text-gold-light underline-offset-4 hover:underline"
          >
            Retour à la connexion
          </Link>
        </p>
      </div>
    </AuthShell>
  );
}

function StatusIcon({ tone, icon: Icon }: { tone: "success" | "error"; icon: typeof BadgeCheck }) {
  return (
    <div
      className={
        tone === "success"
          ? "flex size-16 items-center justify-center rounded-full border border-olive/40 bg-olive/15 text-olive-light"
          : "flex size-16 items-center justify-center rounded-full border border-terracotta/40 bg-terracotta/15 text-terracotta-light"
      }
    >
      <Icon className="size-7" />
    </div>
  );
}

function PrimaryLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <Link
      href={href}
      className="flex h-12 w-full items-center justify-center rounded-full bg-gradient-to-br from-gold-light to-gold text-sm font-bold tracking-wide text-night transition hover:brightness-105"
    >
      {children}
    </Link>
  );
}

export default function ConfirmerEmailPage() {
  return (
    <Suspense fallback={null}>
      <ConfirmerEmailContent />
    </Suspense>
  );
}
