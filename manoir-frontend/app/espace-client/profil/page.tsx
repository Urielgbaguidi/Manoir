"use client";

import { FormEvent, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Check, Lock, Save, Sparkles, User, XCircle } from "lucide-react";
import { api } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";

export default function ProfilePage() {
  const router = useRouter();
  const { user, loading: authLoading, refreshUser } = useAuth();
  const [name, setName] = useState("");
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
    }
  }, [user]);

  const handleProfileSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setProfileError("");
    setProfileMessage("");

    if (name.trim().length < 2) {
      setProfileError("Veuillez saisir un nom complet valide.");
      return;
    }

    setSavingProfile(true);
    try {
      const response = await api.updateProfile({ name: name.trim() });
      await refreshUser();
      setName(response.user.name);
      setProfileMessage("Votre profil a ete mis a jour avec succes.");
    } catch (error) {
      setProfileError(
        error instanceof Error ? error.message : "Impossible de modifier votre profil."
      );
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
      <div className="flex min-h-screen items-center justify-center bg-night">
        <div className="h-12 w-12 animate-spin rounded-full border-4 border-gold border-t-transparent" />
      </div>
    );
  }

  return (
    <main className="relative min-h-screen px-6 py-32 text-cream md:px-10">
      <div className="mx-auto max-w-5xl">
        <div className="mb-10 flex flex-col justify-between gap-6 border-b border-gold/15 pb-8 md:flex-row md:items-end">
          <div>
            <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-gold/25 bg-white/5 px-4 py-2 backdrop-blur-md">
              <Sparkles className="h-4 w-4 text-gold-light" />
              <span className="text-[10px] font-semibold uppercase tracking-[0.28em] text-cream/85">
                Mon Espace
              </span>
            </div>
            <h1 className="font-display text-4xl font-semibold uppercase tracking-tight text-cream md:text-6xl">
              Gerer Mon <span className="text-gradient-gold">Profil</span>
            </h1>
            <p className="mt-4 max-w-2xl text-sm leading-relaxed text-cream/55">
              Modifiez vos informations personnelles et securisez votre compte avec un nouveau mot
              de passe.
            </p>
          </div>
          <Link
            href="/espace-client"
            className="inline-flex items-center justify-center rounded-xl border border-gold/25 px-5 py-3 text-xs font-black uppercase tracking-wider text-cream transition hover:border-gold/50 hover:bg-white/5 hover:text-gold-light"
          >
            Mes reservations
          </Link>
        </div>

        <div className="grid gap-8 lg:grid-cols-2">
          <form onSubmit={handleProfileSubmit} className="glass-dark glass-edge rounded-3xl p-8">
            <div className="mb-8 flex items-start gap-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-gold/20 bg-white/5 text-gold-light">
                <User size={22} />
              </div>
              <div>
                <h2 className="font-display text-2xl font-semibold uppercase text-cream">
                  Informations personnelles
                </h2>
                <p className="mt-1 text-xs leading-relaxed text-cream/50">
                  Le nom affiche dans votre espace client et sur vos documents.
                </p>
              </div>
            </div>

            <label className="block">
              <span className="mb-2 block text-[10px] font-bold uppercase tracking-widest text-gold/80">
                Nom et prenom
              </span>
              <input
                type="text"
                value={name}
                onChange={(event) => setName(event.target.value)}
                className="glass-input w-full rounded-xl px-4 py-3 text-sm outline-none"
                placeholder="Votre nom complet"
              />
            </label>

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

          <form onSubmit={handlePasswordSubmit} className="glass-dark glass-edge rounded-3xl p-8">
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
    </main>
  );
}
