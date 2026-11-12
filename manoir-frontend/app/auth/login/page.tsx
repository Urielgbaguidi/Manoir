"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { CheckCircle2, Eye, EyeOff, Info, ShieldCheck } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { useToast } from "@/context/ToastContext";
import AuthShell, { AuthDivider, AuthField, AuthSubmit } from "@/components/auth/AuthShell";
import GoogleSignInButton from "@/components/auth/GoogleSignInButton";

function LoginContent() {
  const searchParams = useSearchParams();
  const redirectTo = searchParams.get("redirect") || undefined;
  const message = searchParams.get("message");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  // Double authentification : le mot de passe (ou Google) a été accepté,
  // reste le code de l'application d'authentification.
  const [challengeToken, setChallengeToken] = useState<string | null>(null);
  const [twoFactorCode, setTwoFactorCode] = useState("");
  const [useRecoveryCode, setUseRecoveryCode] = useState(false);

  const { login, completeTwoFactor } = useAuth();
  const { showToast } = useToast();

  const notice =
    message === "reservation-sent"
      ? {
          tone: "success" as const,
          text: "Votre demande est bien envoyée. Connectez-vous pour la suivre depuis votre espace."
        }
      : null;

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setLoading(true);

    try {
      const result = await login(email.trim(), password, redirectTo);
      if (result.kind === "two_factor") {
        setChallengeToken(result.challengeToken);
        setPassword("");
        setLoading(false);
      }
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Une erreur est survenue", "error");
      setLoading(false);
    }
  };

  const handleTwoFactor = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!challengeToken) return;
    setLoading(true);

    try {
      await completeTwoFactor(
        challengeToken,
        useRecoveryCode
          ? { recovery_code: twoFactorCode.trim() }
          : { code: twoFactorCode.replace(/\s/g, "") },
        redirectTo
      );
    } catch (err) {
      const status = (err as { status?: number }).status;
      if (status === 401) {
        // Jeton intermédiaire expiré (5 minutes) : on recommence.
        setChallengeToken(null);
      }
      showToast(err instanceof Error ? err.message : "Code incorrect", "error");
      setTwoFactorCode("");
      setLoading(false);
    }
  };

  const registerHref = redirectTo
    ? `/auth/register?redirect=${encodeURIComponent(redirectTo)}`
    : "/auth/register";

  if (challengeToken) {
    return (
      <AuthShell
        title="Vérification en deux étapes"
        subtitle={
          useRecoveryCode
            ? "Saisissez l'un de vos codes de secours."
            : "Saisissez le code à 6 chiffres affiché par votre application d'authentification."
        }
      >
        <form onSubmit={handleTwoFactor} className="space-y-5">
          <div className="flex gap-3 rounded-2xl border border-gold/25 bg-gold/10 p-4 text-sm leading-6 text-cream/80">
            <ShieldCheck size={18} className="mt-0.5 shrink-0 text-gold-light" />
            Votre compte est protégé par la double authentification.
          </div>

          <AuthField
            label={useRecoveryCode ? "Code de secours" : "Code de vérification"}
            name="two_factor_code"
            inputMode={useRecoveryCode ? "text" : "numeric"}
            autoComplete="one-time-code"
            value={twoFactorCode}
            onChange={(event) => setTwoFactorCode(event.target.value)}
            required
            placeholder={useRecoveryCode ? "XXXXXXXX-XXXXXXXX" : "123456"}
            maxLength={useRecoveryCode ? 20 : 6}
          />

          <AuthSubmit loading={loading}>Valider</AuthSubmit>

          <div className="flex items-center justify-between text-xs">
            <button
              type="button"
              onClick={() => {
                setUseRecoveryCode((value) => !value);
                setTwoFactorCode("");
              }}
              className="font-semibold text-cream/55 transition hover:text-gold-light"
            >
              {useRecoveryCode ? "Utiliser un code d'application" : "Utiliser un code de secours"}
            </button>
            <button
              type="button"
              onClick={() => setChallengeToken(null)}
              className="font-semibold text-cream/55 transition hover:text-gold-light"
            >
              Recommencer
            </button>
          </div>
        </form>
      </AuthShell>
    );
  }

  return (
    <AuthShell
      title="Bon retour parmi nous"
      subtitle="Connectez-vous pour retrouver vos réservations, vos paiements et vos Bons de Séjour."
      footer={
        <>
          Pas encore de compte ?{" "}
          <Link
            href={registerHref}
            className="font-semibold text-gold-light underline-offset-4 hover:underline"
          >
            Créer un compte gratuitement
          </Link>
        </>
      }
    >
      {notice && (
        <div
          role="status"
          className={`mb-6 flex gap-3 rounded-2xl border p-4 text-sm leading-6 ${
            notice.tone === "success"
              ? "border-olive/40 bg-olive/10 text-olive-light"
              : "border-gold/25 bg-gold/10 text-cream/80"
          }`}
        >
          {notice.tone === "success" ? (
            <CheckCircle2 size={18} className="mt-0.5 shrink-0" />
          ) : (
            <Info size={18} className="mt-0.5 shrink-0" />
          )}
          {notice.text}
        </div>
      )}

      <GoogleSignInButton mode="signin" redirectTo={redirectTo} onTwoFactor={setChallengeToken} />
      <AuthDivider />

      <form onSubmit={handleSubmit} className="space-y-5">
        <AuthField
          label="Adresse e-mail"
          name="email"
          type="email"
          autoComplete="email"
          inputMode="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          required
          placeholder="vous@exemple.com"
        />

        <AuthField
          label="Mot de passe"
          name="password"
          type={showPassword ? "text" : "password"}
          autoComplete="current-password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          required
          placeholder="Votre mot de passe"
          labelAside={
            <Link
              href="/auth/mot-de-passe-oublie"
              className="text-xs font-semibold text-cream/55 transition hover:text-gold-light"
            >
              Mot de passe oublié ?
            </Link>
          }
          trailing={
            <button
              type="button"
              onClick={() => setShowPassword((value) => !value)}
              aria-label={showPassword ? "Masquer le mot de passe" : "Afficher le mot de passe"}
              className="grid size-9 place-items-center rounded-full text-cream/45 transition hover:text-gold-light"
            >
              {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
            </button>
          }
        />

        <AuthSubmit loading={loading}>Se connecter</AuthSubmit>
      </form>
    </AuthShell>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginContent />
    </Suspense>
  );
}
