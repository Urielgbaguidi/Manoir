"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Check, Lock, Save, User, XCircle } from "lucide-react";
import { ClientPageHeader } from "@/components/dashboard/client/ClientShell";
import CountryCodeSelect, { COUNTRY_CODES } from "@/components/ui/CountryCodeSelect";
import { api } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { useToast } from "@/context/ToastContext";

/** "+229 01 97 00 00 00" -> { code: "+229", local: "01 97 00 00 00" } */
function splitPhone(phone?: string | null) {
  const value = (phone || "").trim();
  const match = [...COUNTRY_CODES]
    .sort((a, b) => b.code.length - a.code.length)
    .find((country) => value.startsWith(country.code));
  if (!match) return { code: "+229", local: value };
  return { code: match.code, local: value.slice(match.code.length).trim() };
}

const normalizePhone = (value?: string | null) => (value || "").replace(/\s+/g, "");

export default function ProfilePage() {
  const router = useRouter();
  const { user, loading: authLoading, refreshUser } = useAuth();
  const { showToast } = useToast();
  const [name, setName] = useState("");
  const [countryCode, setCountryCode] = useState("+229");
  const [phone, setPhone] = useState("");
  const [currentPassword, setCurrentPassword] = useState("");
  const [password, setPassword] = useState("");
  const [passwordConfirmation, setPasswordConfirmation] = useState("");
  const [profileMessage, setProfileMessage] = useState("");
  const [passwordMessage, setPasswordMessage] = useState("");
  const [profileError, setProfileError] = useState("");
  const [passwordError, setPasswordError] = useState("");
  const [savingProfile, setSavingProfile] = useState(false);
  const [savingPassword, setSavingPassword] = useState(false);

  useEffect(() => {
    if (!authLoading && !user) {
      router.push("/auth/login?redirect=/espace-client/profil");
    }
  }, [authLoading, router, user]);

  useEffect(() => {
    if (user) {
      setName(user.name || "");
      const parts = splitPhone(user.phone);
      setCountryCode(parts.code);
      setPhone(parts.local);
    }
  }, [user]);

  const handleProfileSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setProfileError("");
    setProfileMessage("");

    if (name.trim().length < 2) {
      setProfileError("Saisissez votre nom complet.");
      return;
    }

    const digits = phone.replace(/\D/g, "");
    if (digits.length < 8 || digits.length > 15) {
      setProfileError("Saisissez un numéro de téléphone valide (8 chiffres minimum).");
      return;
    }

    const fullPhone = phone.trim().startsWith("+") ? phone.trim() : `${countryCode} ${phone.trim()}`;

    setSavingProfile(true);
    try {
      const response = await api.updateProfile({ name: name.trim(), phone: fullPhone });
      await refreshUser();
      setName(response.user.name);

      // Si le serveur n'enregistre pas encore le téléphone, on le dit
      // clairement au lieu d'afficher un faux succès.
      if (normalizePhone(response.user.phone) !== normalizePhone(fullPhone)) {
        const message = "Votre nom est enregistré, mais le numéro n'a pas pu être modifié. Réessayez plus tard.";
        setProfileError(message);
        showToast(message, "error");
        return;
      }

      setProfileMessage("Vos informations sont bien enregistrées.");
      showToast("Profil mis à jour.", "success");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Impossible de modifier votre profil.";
      setProfileError(message);
      showToast(message, "error");
    } finally {
      setSavingProfile(false);
    }
  };

  const handlePasswordSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setPasswordError("");
    setPasswordMessage("");

    if (!currentPassword) {
      setPasswordError("Veuillez saisir votre ancien mot de passe.");
      return;
    }

    if (password.length < 8) {
      setPasswordError("Le nouveau mot de passe doit contenir au moins 8 caracteres.");
      return;
    }

    if (password !== passwordConfirmation) {
      setPasswordError("Les deux nouveaux mots de passe ne correspondent pas.");
      return;
    }

    if (currentPassword === password) {
      setPasswordError("Le nouveau mot de passe doit etre different de l ancien.");
      return;
    }

    setSavingPassword(true);
    try {
      const response = await api.updatePassword({
        current_password: currentPassword,
        password,
        password_confirmation: passwordConfirmation
      });
      setCurrentPassword("");
      setPassword("");
      setPasswordConfirmation("");
      setPasswordMessage(response.message || "Mot de passe modifie avec succes.");
    } catch (error) {
      setPasswordError(
        error instanceof Error ? error.message : "Impossible de modifier le mot de passe."
      );
    } finally {
      setSavingPassword(false);
    }
  };

  if (authLoading || !user) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <div className="h-10 w-10 animate-spin rounded-full border-[3px] border-gold border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="relative text-cream">
      <div>
        <ClientPageHeader
          title="Données personnelles"
          description="Modifiez vos informations et sécurisez votre compte avec un nouveau mot de passe."
        />

        <div className="mb-8 grid gap-3 rounded-2xl border border-gold/15 bg-white/5 p-5 text-sm sm:grid-cols-3">
          <div>
            <p className="text-xs uppercase tracking-wider text-cream/45">E-mail</p>
            <p className="mt-1 truncate font-medium text-cream">{user.email}</p>
          </div>
          <div>
            <p className="text-xs uppercase tracking-wider text-cream/45">Téléphone</p>
            <p className="mt-1 font-medium text-cream">{user.phone || "Non renseigné"}</p>
          </div>
          <div>
            <p className="text-xs uppercase tracking-wider text-cream/45">Vérification</p>
            <p className={`mt-1 font-medium ${user.email_verified_at ? "text-olive-light" : "text-terracotta-light"}`}>
              {user.email_verified_at ? "Confirmée" : "À confirmer"}
            </p>
          </div>
        </div>

        <div className="grid gap-6 lg:grid-cols-2 lg:gap-8">
          <form onSubmit={handleProfileSubmit} className="glass-warm glass-edge rounded-3xl p-5 sm:p-8">
            <div className="mb-8 flex items-start gap-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-gold/20 bg-white/5 text-gold-light">
                <User size={22} />
              </div>
              <div>
                <h2 className="font-display text-2xl font-semibold uppercase text-cream">
                  Informations personnelles
                </h2>
                <p className="mt-1 text-xs leading-relaxed text-cream/50">
                  Ces informations figurent sur vos bons de séjour et nous permettent de vous joindre.
                </p>
              </div>
            </div>

            <div className="space-y-5">
              <label className="block">
                <span className="mb-2 block text-sm font-medium text-cream/85">Nom et prénom</span>
                <input
                  type="text"
                  autoComplete="name"
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  className="glass-input h-12 w-full rounded-xl px-4 text-[15px] outline-none"
                  placeholder="Votre nom complet"
                />
              </label>

              <div>
                <label htmlFor="profile-phone" className="mb-2 block text-sm font-medium text-cream/85">
                  Téléphone
                </label>
                <div className="flex gap-2">
                  <CountryCodeSelect value={countryCode} onChange={setCountryCode} />
                  <input
                    id="profile-phone"
                    type="tel"
                    inputMode="tel"
                    autoComplete="tel-national"
                    value={phone}
                    onChange={(event) => setPhone(event.target.value)}
                    className="glass-input h-12 w-full min-w-0 flex-1 rounded-xl px-4 text-[15px] outline-none"
                    placeholder="01 00 00 00 00"
                  />
                </div>
                <p className="mt-1.5 text-xs text-cream/50">Utilisé pour vous contacter au sujet de votre séjour.</p>
              </div>
            </div>

            {profileError && (
              <p className="mt-4 flex items-center gap-2 rounded-2xl border border-terracotta/40 bg-terracotta/15 p-4 text-xs font-semibold text-terracotta-light">
                <XCircle size={16} /> {profileError}
              </p>
            )}

            {profileMessage && (
              <p className="mt-4 flex items-center gap-2 rounded-2xl border border-olive/40 bg-olive/15 p-4 text-xs font-semibold text-olive-light">
                <Check size={16} /> {profileMessage}
              </p>
            )}

            <button
              type="submit"
              disabled={savingProfile}
              className="mt-8 flex w-full items-center justify-center gap-2 rounded-full bg-gradient-to-br from-gold-light to-gold px-6 py-4 text-xs font-bold uppercase tracking-[0.22em] text-night transition hover:brightness-105 disabled:opacity-50"
            >
              <Save size={16} />
              {savingProfile ? "Enregistrement..." : "Enregistrer"}
            </button>
          </form>

          <form onSubmit={handlePasswordSubmit} className="glass-warm glass-edge rounded-3xl p-5 sm:p-8">
            <div className="mb-8 flex items-start gap-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-gold/20 bg-white/5 text-gold-light">
                <Lock size={22} />
              </div>
              <div>
                <h2 className="font-display text-2xl font-semibold uppercase text-cream">
                  Mot de passe
                </h2>
                <p className="mt-1 text-xs leading-relaxed text-cream/50">
                  Confirmez votre ancien mot de passe avant de definir le nouveau.
                </p>
              </div>
            </div>

            <div className="space-y-4">
              <label className="block">
                <span className="mb-2 block text-[10px] font-bold uppercase tracking-widest text-gold/80">
                  Ancien mot de passe
                </span>
                <input
                  type="password"
                  value={currentPassword}
                  onChange={(event) => setCurrentPassword(event.target.value)}
                  className="glass-input w-full rounded-xl px-4 py-3 text-sm outline-none"
                />
              </label>
              <label className="block">
                <span className="mb-2 block text-[10px] font-bold uppercase tracking-widest text-gold/80">
                  Nouveau mot de passe
                </span>
                <input
                  type="password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  className="glass-input w-full rounded-xl px-4 py-3 text-sm outline-none"
                />
              </label>
              <label className="block">
                <span className="mb-2 block text-[10px] font-bold uppercase tracking-widest text-gold/80">
                  Confirmer le nouveau mot de passe
                </span>
                <input
                  type="password"
                  value={passwordConfirmation}
                  onChange={(event) => setPasswordConfirmation(event.target.value)}
                  className="glass-input w-full rounded-xl px-4 py-3 text-sm outline-none"
                />
              </label>
            </div>

            {passwordError && (
              <p className="mt-4 flex items-center gap-2 rounded-2xl border border-terracotta/40 bg-terracotta/15 p-4 text-xs font-semibold text-terracotta-light">
                <XCircle size={16} /> {passwordError}
              </p>
            )}

            {passwordMessage && (
              <p className="mt-4 flex items-center gap-2 rounded-2xl border border-olive/40 bg-olive/15 p-4 text-xs font-semibold text-olive-light">
                <Check size={16} /> {passwordMessage}
              </p>
            )}

            <button
              type="submit"
              disabled={savingPassword}
              className="mt-8 flex w-full items-center justify-center gap-2 rounded-full bg-gradient-to-br from-gold-light to-gold px-6 py-4 text-xs font-bold uppercase tracking-[0.22em] text-night transition hover:brightness-105 disabled:opacity-50"
            >
              <Lock size={16} />
              {savingPassword ? "Verification..." : "Changer le mot de passe"}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
