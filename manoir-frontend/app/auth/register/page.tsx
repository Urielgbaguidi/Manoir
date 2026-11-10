"use client";

import { Suspense, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Eye, EyeOff } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { useToast } from "@/context/ToastContext";
import AuthShell, { AuthDivider, AuthField, AuthSubmit } from "@/components/auth/AuthShell";
import GoogleSignInButton from "@/components/auth/GoogleSignInButton";
import type { CountryCode } from "libphonenumber-js/min";
import CountryCodeSelect from "@/components/ui/CountryCodeSelect";
import { DEFAULT_DIAL_COUNTRY, checkPhone } from "@/lib/phone";

/** Force indicative du mot de passe : 0 à 4. */
function passwordScore(value: string) {
  let score = 0;
  if (value.length >= 8) score += 1;
  if (value.length >= 12) score += 1;
  if (/[A-Z]/.test(value) && /[a-z]/.test(value)) score += 1;
  if (/\d/.test(value) && /[^A-Za-z0-9]/.test(value)) score += 1;
  return score;
}

const strengthLabels = ["Trop court", "Faible", "Correct", "Bon", "Excellent"];
const strengthColors = ["bg-terracotta", "bg-terracotta", "bg-gold", "bg-olive-light", "bg-olive"];

function RegisterContent() {
  const searchParams = useSearchParams();
  const redirectTo = searchParams.get("redirect") || undefined;
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [phoneCountry, setPhoneCountry] = useState<CountryCode>(DEFAULT_DIAL_COUNTRY);
  const [phone, setPhone] = useState("");
  const [phoneError, setPhoneError] = useState("");
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const { register } = useAuth();
  const { showToast } = useToast();

  const loginHref = redirectTo
    ? `/auth/login?redirect=${encodeURIComponent(redirectTo)}`
    : "/auth/login";

  const score = useMemo(() => passwordScore(password), [password]);
  const mismatch = confirmation.length > 0 && confirmation !== password;

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();

    if (password.length < 8) {
      showToast("Le mot de passe doit contenir au moins 8 caractères.", "error");
      return;
    }
    if (password !== confirmation) {
      showToast("Les deux mots de passe ne correspondent pas.", "error");
      return;
    }
    const phoneCheck = checkPhone(phone, phoneCountry);
    if (!phoneCheck.valid) {
      setPhoneError(phoneCheck.message);
      showToast(phoneCheck.message, "error");
      document.getElementById("phone")?.focus();
      return;
    }

    setLoading(true);
    const fullName = `${firstName.trim()} ${lastName.trim()}`.trim();

    try {
      // Numéro enregistré au format international lisible : « +229 01 97 00 00 00 ».
      // Plus de champ « Pays de résidence » : le pays transmis à l'API (qui
      // l'exige) est celui de l'indicatif téléphonique choisi.
      await register(fullName, email.trim(), phoneCheck.international, password, phoneCountry, redirectTo);
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Une erreur est survenue", "error");
      setLoading(false);
    }
  };

  const toggleVisibility = (
    <button
      type="button"
      onClick={() => setShowPassword((value) => !value)}
      aria-label={showPassword ? "Masquer le mot de passe" : "Afficher le mot de passe"}
      className="grid size-9 place-items-center rounded-full text-cream/45 transition hover:text-gold-light"
    >
      {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
    </button>
  );

  return (
    <AuthShell
      title="Créez votre compte"
      subtitle="C'est gratuit et rapide. Réservez, payez et suivez vos séjours au même endroit."
      image="/assets/rooms/room2.jpg"
      headline="Un sanctuaire de calme, rien que pour vous."
      footer={
        <>
          Vous avez déjà un compte ?{" "}
          <Link href={loginHref} className="font-semibold text-gold-light underline-offset-4 hover:underline">
            Se connecter
          </Link>
        </>
      }
    >
      <GoogleSignInButton mode="signup" redirectTo={redirectTo} />
      <AuthDivider label="ou remplissez le formulaire" />

      <form onSubmit={handleSubmit} className="space-y-5">
        <div className="grid gap-5 sm:grid-cols-2">
          <AuthField
            label="Prénom"
            name="firstName"
            autoComplete="given-name"
            value={firstName}
            onChange={(event) => setFirstName(event.target.value)}
            required
            placeholder="Votre prénom"
          />
          <AuthField
            label="Nom"
            name="lastName"
            autoComplete="family-name"
            value={lastName}
            onChange={(event) => setLastName(event.target.value)}
            required
            placeholder="Votre nom"
          />
        </div>

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
          hint="Un code de confirmation vous sera envoyé à cette adresse."
        />

        <div className="space-y-1.5">
          <label htmlFor="phone" className="text-sm font-medium text-cream/85">
            Téléphone<span className="ml-0.5 text-gold">*</span>
          </label>
          <div className="flex gap-2">
            <CountryCodeSelect
              value={phoneCountry}
              onChange={(code) => {
                setPhoneCountry(code);
                setPhoneError("");
              }}
            />
            <input
              id="phone"
              type="tel"
              autoComplete="tel-national"
              inputMode="tel"
              value={phone}
              onChange={(event) => {
                setPhone(event.target.value);
                if (phoneError) setPhoneError("");
              }}
              onBlur={() => {
                if (!phone.trim()) return;
                const result = checkPhone(phone, phoneCountry);
                setPhoneError(result.valid ? "" : result.message);
              }}
              required
              aria-invalid={Boolean(phoneError)}
              aria-describedby={phoneError ? "phone-hint" : undefined}
              className={`glass-input h-12 w-full min-w-0 flex-1 rounded-xl px-4 text-[15px] outline-none ${
                phoneError ? "!border-red-500/70" : ""
              }`}
              placeholder="Votre numéro"
            />
          </div>
          {/* Plus de texte d'aide permanent : seul un numéro invalide est signalé. */}
          {phoneError && (
            <p id="phone-hint" role="alert" className="text-xs leading-5 text-red-500">
              {phoneError}
            </p>
          )}
        </div>

        <div className="space-y-2">
          <AuthField
            label="Mot de passe"
            name="password"
            type={showPassword ? "text" : "password"}
            autoComplete="new-password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            required
            minLength={8}
            placeholder="8 caractères minimum"
            trailing={toggleVisibility}
          />
          {password && (
            <div className="flex items-center gap-3" aria-live="polite">
              <div className="flex flex-1 gap-1">
                {[0, 1, 2, 3].map((index) => (
                  <span
                    key={index}
                    className={`h-1 flex-1 rounded-full transition-colors ${
                      index < Math.max(score, 1) ? strengthColors[score] : "bg-gold/15"
                    }`}
                  />
                ))}
              </div>
              <span className="w-20 text-right text-xs text-cream/55">{strengthLabels[score]}</span>
            </div>
          )}
        </div>

        <AuthField
          label="Confirmer le mot de passe"
          name="password_confirmation"
          type={showPassword ? "text" : "password"}
          autoComplete="new-password"
          value={confirmation}
          onChange={(event) => setConfirmation(event.target.value)}
          required
          placeholder="Retapez votre mot de passe"
          aria-invalid={mismatch}
          className={mismatch ? "!border-terracotta/70" : ""}
          hint={mismatch ? <span className="text-terracotta-light">Les mots de passe ne correspondent pas.</span> : undefined}
        />

        <p className="text-xs leading-5 text-cream/50">
          En créant un compte, vous acceptez que Le Manoir utilise vos coordonnées pour gérer vos
          réservations et vous contacter au sujet de votre séjour.
        </p>

        <AuthSubmit loading={loading}>Créer mon compte</AuthSubmit>
      </form>
    </AuthShell>
  );
}

export default function RegisterPage() {
  return (
    <Suspense fallback={null}>
      <RegisterContent />
    </Suspense>
  );
}
