"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { CheckCircle2, Eye, EyeOff, Info } from "lucide-react";
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

  const { login } = useAuth();
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
      // Le message de bienvenue et la redirection sont gérés ensemble par
      // le contexte d'authentification, au même instant.
      await login(email.trim(), password, redirectTo);
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Une erreur est survenue", "error");
      setLoading(false);
    }
  };

  const registerHref = redirectTo
    ? `/auth/register?redirect=${encodeURIComponent(redirectTo)}`
    : "/auth/register";

  return (
    <AuthShell
      title="Bon retour parmi nous"
      subtitle="Connectez-vous pour retrouver vos réservations, vos paiements et vos factures."
      footer={
        <>
          Pas encore de compte ?{" "}
          <Link href={registerHref} className="font-semibold text-gold-light underline-offset-4 hover:underline">
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

      <GoogleSignInButton mode="signin" redirectTo={redirectTo} />
      <AuthDivider />

      <form onSubmit={handleSubmit} className="space-y-5" noValidate={false}>
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
