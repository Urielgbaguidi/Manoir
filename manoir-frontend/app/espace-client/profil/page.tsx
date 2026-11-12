"use client";

import { AnimatePresence, motion } from "framer-motion";
import { Check, Pencil, X, XCircle } from "lucide-react";
import { useRouter } from "next/navigation";
import { FormEvent, useEffect, useState, type ReactNode } from "react";
import type { CountryCode } from "libphonenumber-js/min";
import { TwoFactorSettings, useReauthentication } from "@/components/account/SecurityPanel";
import { ClientPageHeader } from "@/components/dashboard/client/ClientShell";
import CountryCodeSelect from "@/components/ui/CountryCodeSelect";
import { useAuth } from "@/context/AuthContext";
import { useToast } from "@/context/ToastContext";
import { api, type User } from "@/lib/api";
import { getCountry } from "@/lib/countries";
import { DEFAULT_DIAL_COUNTRY, checkPhone, isDialCountry, splitStoredPhone } from "@/lib/phone";
import { initialsOf } from "@/lib/site";
import { cn } from "@/lib/utils";

/*
 * Page « Données personnelles », sur le modèle de la page Profil du template
 * TailAdmin : une carte d'informations (avatar, champs, bouton Modifier) et
 * une carte Sécurité (mot de passe, double authentification). Les
 * modifications se font dans des fenêtres dédiées.
 */

const normalizePhone = (value?: string | null) => (value || "").replace(/\s+/g, "");

export default function ProfilePage() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const [editingInfo, setEditingInfo] = useState(false);
  const [changingPassword, setChangingPassword] = useState(false);

  useEffect(() => {
    if (!authLoading && !user) {
      router.push("/auth/login?redirect=/espace-client/profil");
    }
  }, [authLoading, router, user]);

  if (authLoading || !user) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <div className="h-10 w-10 animate-spin rounded-full border-[3px] border-gold border-t-transparent" />
      </div>
    );
  }

  const isAdmin = Boolean(user.is_admin || user.is_super_admin);
  const country = user.country ? getCountry(user.country)?.name : null;

  return (
    <div className="relative text-cream">
      <ClientPageHeader
        title="Données personnelles"
        description="Vos informations de contact et la sécurité de votre compte."
      />

      <div className="admin-card rounded-2xl border border-gold/15 p-5 lg:p-6">
        <h3 className="mb-5 text-lg font-semibold text-cream lg:mb-7">Profil</h3>

        <div className="space-y-6">
          {/* Informations personnelles */}
          <section className="rounded-2xl border border-gold/15 p-5 sm:p-6 lg:p-7">
            <div className="flex items-center justify-between gap-4">
              <h2 className="text-base font-semibold text-cream sm:text-lg">
                Informations personnelles
              </h2>
              <OutlineButton onClick={() => setEditingInfo(true)}>
                <Pencil size={16} />
                Modifier
              </OutlineButton>
            </div>

            <div className="mt-5 flex items-center gap-4 sm:gap-6">
              <span className="flex size-16 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-gold-light to-gold text-xl font-semibold text-night sm:size-20 sm:text-2xl">
                {initialsOf(user.name)}
              </span>
              <div className="flex min-w-0 flex-col gap-1">
                <h3 className="truncate text-base font-semibold text-cream sm:text-lg">
                  {user.name}
                </h3>
                <div className="flex flex-wrap items-center gap-2 text-xs text-cream/50 sm:text-sm">
                  <span>{isAdmin ? "Administrateur" : "Client"}</span>
                  {country && (
                    <>
                      <span className="inline-block h-3.5 w-px bg-gold/25" />
                      <span>{country}</span>
                    </>
                  )}
                </div>
              </div>
            </div>

            <div className="mt-7 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
              <InfoField label="Nom complet" value={user.name} />
              <InfoField label="Adresse e-mail" value={user.email} />
              {!isAdmin && <InfoField label="Téléphone" value={user.phone} />}
            </div>
          </section>

          {/* Sécurité */}
          <section className="rounded-2xl border border-gold/15 p-5 lg:p-6">
            <h2 className="text-lg font-semibold text-cream">Sécurité</h2>

            <div className="mt-4">
              <SecurityItem
                title="Mot de passe"
                description={
                  user.has_password === false
                    ? "Vous vous connectez avec Google. Définissez un mot de passe pour vous connecter aussi avec votre e-mail."
                    : "Changez régulièrement votre mot de passe pour protéger votre compte."
                }
                divider
                action={
                  <OutlineButton onClick={() => setChangingPassword(true)}>
                    <Pencil size={16} />
                    {user.has_password === false
                      ? "Définir un mot de passe"
                      : "Modifier le mot de passe"}
                  </OutlineButton>
                }
              />

              <div className="pt-4">
                <TwoFactorSettings variant="switch" />
              </div>
            </div>
          </section>
        </div>
      </div>

      <AnimatePresence>
        {editingInfo && <EditInfoDialog user={user} onClose={() => setEditingInfo(false)} />}
        {changingPassword && (
          <ChangePasswordDialog user={user} onClose={() => setChangingPassword(false)} />
        )}
      </AnimatePresence>
    </div>
  );
}

/* ------------------------------------------------------------------------ */

function InfoField({ label, value }: { label: string; value?: string | null }) {
  return (
    <div className="flex min-w-0 flex-col gap-1 sm:gap-2">
      <p className="text-xs text-cream/50 sm:text-sm">{label}</p>
      <p className="break-words text-sm font-medium text-cream sm:text-base">{value || "—"}</p>
    </div>
  );
}

function SecurityItem({
  title,
  description,
  action,
  divider = false
}: {
  title: string;
  description: string;
  action: ReactNode;
  divider?: boolean;
}) {
  return (
    <div
      className={cn(
        "flex flex-col justify-between gap-4 py-4 first:pt-0 sm:flex-row sm:items-center",
        divider && "border-b border-gold/15"
      )}
    >
      <div>
        <h4 className="mb-1 text-base font-medium text-cream">{title}</h4>
        <p className="text-sm text-cream/50">{description}</p>
      </div>
      <div className="flex shrink-0 items-center">{action}</div>
    </div>
  );
}

function OutlineButton({ onClick, children }: { onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex h-9 shrink-0 items-center gap-2 rounded-lg border border-gold/20 px-3.5 text-sm font-medium text-cream/80 transition hover:border-gold/50 hover:text-gold-light"
    >
      {children}
    </button>
  );
}

function Dialog({
  title,
  description,
  onClose,
  busy,
  children
}: {
  title: string;
  description: string;
  onClose: () => void;
  busy?: boolean;
  children: ReactNode;
}) {
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !busy) onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [busy, onClose]);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[90] flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-label={title}
    >
      <div
        className="absolute inset-0 bg-night/80 backdrop-blur-sm"
        onClick={() => !busy && onClose()}
      />
      <motion.div
        initial={{ opacity: 0, scale: 0.96, y: 16 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.96, y: 16 }}
        className="glass-dark glass-edge relative w-full max-w-lg rounded-3xl p-6 text-cream sm:p-8"
      >
        <button
          type="button"
          onClick={onClose}
          disabled={busy}
          aria-label="Fermer"
          className="absolute right-5 top-5 inline-flex size-9 items-center justify-center rounded-full text-cream/50 transition hover:bg-white/5 hover:text-cream"
        >
          <X size={18} />
        </button>
        <h3 className="pr-10 text-xl font-semibold text-cream">{title}</h3>
        <p className="mt-1 text-sm text-cream/50">{description}</p>
        <div className="mt-6">{children}</div>
      </motion.div>
    </motion.div>
  );
}

function FormMessage({ tone, children }: { tone: "error" | "success"; children: ReactNode }) {
  return (
    <p
      className={cn(
        "mt-4 flex items-center gap-2 rounded-xl border p-3 text-xs font-semibold",
        tone === "error"
          ? "border-terracotta/40 bg-terracotta/15 text-terracotta-light"
          : "border-olive/40 bg-olive/15 text-olive-light"
      )}
    >
      {tone === "error" ? <XCircle size={16} /> : <Check size={16} />}
      {children}
    </p>
  );
}

function DialogActions({
  busy,
  label,
  busyLabel,
  onCancel
}: {
  busy: boolean;
  label: string;
  busyLabel: string;
  onCancel: () => void;
}) {
  return (
    <div className="mt-6 flex items-center justify-end gap-3">
      <button
        type="button"
        onClick={onCancel}
        disabled={busy}
        className="h-11 rounded-lg border border-gold/20 px-5 text-sm font-medium text-cream/70 transition hover:border-gold/40 hover:text-cream disabled:opacity-50"
      >
        Annuler
      </button>
      <button
        type="submit"
        disabled={busy}
        className="h-11 rounded-lg bg-gradient-to-br from-gold-light to-gold px-5 text-sm font-semibold text-night transition hover:brightness-105 disabled:opacity-50"
      >
        {busy ? busyLabel : label}
      </button>
    </div>
  );
}

const fieldLabel = "mb-1.5 block text-sm font-medium text-cream/80";
const fieldInput = "glass-input h-11 w-full rounded-lg px-4 text-sm outline-none";

function EditInfoDialog({ user, onClose }: { user: User; onClose: () => void }) {
  const { refreshUser } = useAuth();
  const { showToast } = useToast();
  const isAdmin = Boolean(user.is_admin || user.is_super_admin);
  const fallbackCountry = isDialCountry(user.country) ? user.country : DEFAULT_DIAL_COUNTRY;
  const storedPhone = splitStoredPhone(user.phone, fallbackCountry);
  const [name, setName] = useState(user.name || "");
  const [phoneCountry, setPhoneCountry] = useState<CountryCode>(storedPhone.country);
  const [phone, setPhone] = useState(storedPhone.national);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError("");

    if (name.trim().length < 2) {
      setError("Saisissez votre nom complet.");
      return;
    }

    // Le téléphone reste obligatoire pour les clients, jamais pour les admins.
    let fullPhone: string | null = null;
    if (!isAdmin) {
      const phoneCheck = checkPhone(phone, phoneCountry);
      if (!phoneCheck.valid) {
        setError(phoneCheck.message);
        return;
      }
      fullPhone = phoneCheck.international;
    }

    setSaving(true);
    try {
      await api.updateProfile({ name: name.trim() });
      if (fullPhone && normalizePhone(user.phone) !== normalizePhone(fullPhone)) {
        await api.completePhone(fullPhone, phoneCountry);
      }
      await refreshUser();
      showToast("Profil mis à jour.", "success");
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Impossible de modifier votre profil.");
      setSaving(false);
    }
  };

  return (
    <Dialog
      title="Modifier mes informations"
      description="Ces informations figurent sur vos Bons de Séjour et nous permettent de vous joindre."
      onClose={onClose}
      busy={saving}
    >
      <form onSubmit={submit} noValidate>
        <div className="space-y-5">
          <label className="block">
            <span className={fieldLabel}>Nom complet</span>
            <input
              type="text"
              autoComplete="name"
              value={name}
              onChange={(event) => setName(event.target.value)}
              className={fieldInput}
              placeholder="Votre nom complet"
              autoFocus
            />
          </label>

          <div>
            <span className={fieldLabel}>Adresse e-mail</span>
            <p className="glass-input flex h-11 w-full items-center rounded-lg px-4 text-sm text-cream/50">
              {user.email}
            </p>
          </div>

          {!isAdmin && (
            <div>
              <label htmlFor="profile-phone" className={fieldLabel}>
                Téléphone
              </label>
              <div className="flex gap-2">
                <CountryCodeSelect value={phoneCountry} onChange={setPhoneCountry} />
                <input
                  id="profile-phone"
                  type="tel"
                  inputMode="tel"
                  autoComplete="tel-national"
                  value={phone}
                  onChange={(event) => setPhone(event.target.value)}
                  className={cn(fieldInput, "min-w-0 flex-1")}
                  placeholder="01 00 00 00 00"
                />
              </div>
            </div>
          )}
        </div>

        {error && <FormMessage tone="error">{error}</FormMessage>}

        <DialogActions
          busy={saving}
          label="Enregistrer"
          busyLabel="Enregistrement…"
          onCancel={onClose}
        />
      </form>
    </Dialog>
  );
}

function ChangePasswordDialog({ user, onClose }: { user: User; onClose: () => void }) {
  const { refreshUser } = useAuth();
  const { showToast } = useToast();
  const { run: runSensitive, prompt: reauthPrompt } = useReauthentication();
  const hasPassword = user.has_password !== false;
  const [currentPassword, setCurrentPassword] = useState("");
  const [password, setPassword] = useState("");
  const [passwordConfirmation, setPasswordConfirmation] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError("");

    if (hasPassword && !currentPassword) {
      setError("Veuillez saisir votre mot de passe actuel.");
      return;
    }
    if (password.length < 8) {
      setError("Le nouveau mot de passe doit contenir au moins 8 caractères.");
      return;
    }
    if (password !== passwordConfirmation) {
      setError("Les deux nouveaux mots de passe ne correspondent pas.");
      return;
    }
    if (currentPassword === password) {
      setError("Le nouveau mot de passe doit être différent de l'ancien.");
      return;
    }

    setSaving(true);
    try {
      // Action sensible : l'API exige une identité confirmée récemment.
      // L'ancien mot de passe sert de preuve ; sinon on la demande.
      if (hasPassword) {
        await api.reauthenticate({ password: currentPassword });
      }
      const response = await runSensitive(() =>
        api.updatePassword({
          current_password: hasPassword ? currentPassword : undefined,
          password,
          password_confirmation: passwordConfirmation
        })
      );
      if (!response) {
        setSaving(false);
        return;
      }
      await refreshUser();
      showToast(response.message || "Mot de passe modifié.", "success");
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Impossible de modifier le mot de passe.");
      setSaving(false);
    }
  };

  return (
    <Dialog
      title={hasPassword ? "Modifier le mot de passe" : "Définir un mot de passe"}
      description={
        hasPassword
          ? "Confirmez votre mot de passe actuel avant de définir le nouveau."
          : "Vous pourrez ensuite vous connecter avec votre e-mail et ce mot de passe."
      }
      onClose={onClose}
      busy={saving}
    >
      {reauthPrompt}
      <form onSubmit={submit} noValidate>
        <div className="space-y-5">
          {hasPassword && (
            <label className="block">
              <span className={fieldLabel}>Mot de passe actuel</span>
              <input
                type="password"
                autoComplete="current-password"
                value={currentPassword}
                onChange={(event) => setCurrentPassword(event.target.value)}
                className={fieldInput}
                autoFocus
              />
            </label>
          )}
          <label className="block">
            <span className={fieldLabel}>Nouveau mot de passe</span>
            <input
              type="password"
              autoComplete="new-password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              className={fieldInput}
            />
          </label>
          <label className="block">
            <span className={fieldLabel}>Confirmer le nouveau mot de passe</span>
            <input
              type="password"
              autoComplete="new-password"
              value={passwordConfirmation}
              onChange={(event) => setPasswordConfirmation(event.target.value)}
              className={fieldInput}
            />
          </label>
        </div>

        {error && <FormMessage tone="error">{error}</FormMessage>}

        <DialogActions
          busy={saving}
          label="Enregistrer"
          busyLabel="Vérification…"
          onCancel={onClose}
        />
      </form>
    </Dialog>
  );
}
