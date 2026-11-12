"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import { KeyRound, Laptop, LogOut, ShieldCheck, ShieldOff, Smartphone, X } from "lucide-react";
import Switch from "@/components/ui/Switch";
import { ApiError, AuthSessionInfo, api } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { useToast } from "@/context/ToastContext";

/**
 * Exécute une action sensible ; si l'API exige une réauthentification
 * récente, demande d'abord le mot de passe (ou un code 2FA) puis rejoue.
 */
export function useReauthentication() {
  const [pending, setPending] = useState<null | {
    resolve: (ok: boolean) => void;
  }>(null);

  const run = useCallback(async <T,>(action: () => Promise<T>): Promise<T | null> => {
    try {
      return await action();
    } catch (error) {
      if (!(error instanceof ApiError) || error.reason !== "reauthentication_required") throw error;
      const confirmed = await new Promise<boolean>((resolve) => setPending({ resolve }));
      if (!confirmed) return null;
      return await action();
    }
  }, []);

  const prompt = pending ? (
    <ReauthDialog
      onDone={(ok) => {
        pending.resolve(ok);
        setPending(null);
      }}
    />
  ) : null;

  return { run, prompt };
}

function ReauthDialog({ onDone }: { onDone: (ok: boolean) => void }) {
  const { user } = useAuth();
  const { showToast } = useToast();
  const [value, setValue] = useState("");
  const [loading, setLoading] = useState(false);
  const usesCode = user?.has_password === false && user?.two_factor_enabled;

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setLoading(true);
    try {
      await api.reauthenticate(usesCode ? { code: value.trim() } : { password: value });
      onDone(true);
    } catch (error) {
      showToast(error instanceof Error ? error.message : "Vérification échouée", "error");
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-night/70 p-4 backdrop-blur-sm">
      <form
        onSubmit={submit}
        className="glass-dark glass-edge w-full max-w-sm space-y-5 rounded-3xl p-6 text-cream"
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <h3 className="font-display text-xl font-semibold uppercase">
              Confirmez votre identité
            </h3>
            <p className="mt-1 text-xs leading-relaxed text-cream/55">
              Cette action est sensible : par sécurité, confirmez qu&apos;il s&apos;agit bien de
              vous.
            </p>
          </div>
          <button
            type="button"
            onClick={() => onDone(false)}
            aria-label="Annuler"
            className="text-cream/50 hover:text-cream"
          >
            <X size={18} />
          </button>
        </div>

        {user?.has_password === false && !user?.two_factor_enabled ? (
          <p className="rounded-2xl border border-gold/25 bg-gold/10 p-4 text-xs leading-5 text-cream/75">
            Votre compte utilise la connexion Google et n&apos;a pas de mot de passe. Définissez-en
            un via « Mot de passe oublié » sur la page de connexion pour effectuer cette action.
          </p>
        ) : (
          <input
            type={usesCode ? "text" : "password"}
            inputMode={usesCode ? "numeric" : undefined}
            autoComplete={usesCode ? "one-time-code" : "current-password"}
            value={value}
            onChange={(event) => setValue(event.target.value)}
            autoFocus
            required
            placeholder={usesCode ? "Code à 6 chiffres" : "Votre mot de passe"}
            className="glass-input h-12 w-full rounded-xl px-4 text-[15px] outline-none"
          />
        )}

        <button
          type="submit"
          disabled={loading || !value}
          className="flex w-full items-center justify-center rounded-full bg-gradient-to-br from-gold-light to-gold py-3.5 text-xs font-bold uppercase tracking-[0.22em] text-night disabled:opacity-50"
        >
          {loading ? "Vérification..." : "Confirmer"}
        </button>
      </form>
    </div>
  );
}

function formatDate(value: string | null) {
  if (!value) return "—";
  return new Date(value).toLocaleString("fr-FR", { dateStyle: "medium", timeStyle: "short" });
}

/**
 * Double authentification : état, activation (avec codes de secours) et
 * désactivation. Sans carte autour : s'intègre dans n'importe quelle section.
 *
 * `switch` : ligne titre + description avec un interrupteur on / off (style
 * du template), le formulaire d'activation s'affichant en dessous.
 */
export function TwoFactorSettings({
  variant = "buttons",
  title = "Double authentification (2FA)",
  description
}: {
  variant?: "buttons" | "switch";
  title?: string;
  description?: string;
} = {}) {
  const { user, setUser } = useAuth();
  const { showToast } = useToast();
  const { run, prompt } = useReauthentication();
  const [setup, setSetup] = useState<{ secret: string; otpauth_url: string } | null>(null);
  const [code, setCode] = useState("");
  const [recoveryCodes, setRecoveryCodes] = useState<string[] | null>(null);
  const [busy, setBusy] = useState(false);

  const guard = async (action: () => Promise<void>) => {
    setBusy(true);
    try {
      await action();
    } catch (error) {
      showToast(error instanceof Error ? error.message : "Une erreur est survenue", "error");
    } finally {
      setBusy(false);
    }
  };

  const startSetup = () =>
    guard(async () => {
      const result = await run(() => api.beginTwoFactorSetup());
      if (result) {
        setSetup(result);
        setCode("");
      }
    });

  const confirmSetup = (event: FormEvent) => {
    event.preventDefault();
    void guard(async () => {
      const result = await api.confirmTwoFactorSetup(code.replace(/\s/g, ""));
      setRecoveryCodes(result.recovery_codes);
      setSetup(null);
      setUser(result.user);
      showToast("Double authentification activée.", "success");
    });
  };

  const disable = () =>
    guard(async () => {
      const result = await run(() => api.disableTwoFactor());
      if (result) {
        setUser(result.user);
        setRecoveryCodes(null);
        showToast(result.message, "success");
      }
    });

  const regenerate = () =>
    guard(async () => {
      const result = await run(() => api.regenerateRecoveryCodes());
      if (result) setRecoveryCodes(result.recovery_codes);
    });

  if (!user) return null;

  const enabled = Boolean(user.two_factor_enabled);

  const recoveryBlock = recoveryCodes && (
    <div className="rounded-2xl border border-gold/30 bg-gold/10 p-4">
      <p className="mb-3 text-xs font-semibold text-gold-light">
        Codes de secours : notez-les en lieu sûr. Chacun ne sert qu&apos;une fois et ils ne seront
        plus affichés.
      </p>
      <ul className="grid grid-cols-2 gap-2 font-mono text-xs text-cream">
        {recoveryCodes.map((recovery) => (
          <li key={recovery} className="rounded-lg bg-night/40 px-2 py-1 text-center">
            {recovery}
          </li>
        ))}
      </ul>
    </div>
  );

  const setupForm = setup && (
    <form onSubmit={confirmSetup} className="space-y-4">
      <p className="text-xs leading-5 text-cream/70">
        1. Sur votre téléphone,{" "}
        <a href={setup.otpauth_url} className="text-gold-light underline">
          ouvrez ce lien
        </a>{" "}
        ou ajoutez manuellement cette clé dans votre application d&apos;authentification :
      </p>
      <p className="break-all rounded-xl bg-night/40 px-3 py-2 text-center font-mono text-sm tracking-widest text-cream">
        {setup.secret.replace(/(.{4})/g, "$1 ").trim()}
      </p>
      <p className="text-xs text-cream/70">2. Saisissez le code affiché par l&apos;application :</p>
      <input
        inputMode="numeric"
        autoComplete="one-time-code"
        value={code}
        onChange={(event) => setCode(event.target.value)}
        maxLength={7}
        required
        autoFocus
        placeholder="123456"
        className="glass-input h-12 w-full rounded-xl px-4 text-center font-display text-xl tracking-[0.4em] outline-none"
      />
      <div className="flex gap-3">
        <button
          type="submit"
          disabled={busy || code.replace(/\s/g, "").length !== 6}
          className="flex-1 rounded-lg bg-gradient-to-br from-gold-light to-gold py-3 text-sm font-semibold text-night disabled:opacity-50"
        >
          Activer
        </button>
        <button
          type="button"
          onClick={() => setSetup(null)}
          className="rounded-lg border border-gold/30 px-5 text-sm font-medium text-cream/70"
        >
          Annuler
        </button>
      </div>
    </form>
  );

  if (variant === "switch") {
    const onToggle = (next: boolean) => {
      if (next) {
        if (!enabled && !setup) void startSetup();
        return;
      }
      if (setup) {
        setSetup(null);
        return;
      }
      if (enabled) void disable();
    };

    return (
      <div>
        {prompt}
        <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
          <div>
            <h4 className="mb-1 text-base font-medium text-cream">{title}</h4>
            <p className="text-sm text-cream/50">
              {description ??
                (enabled
                  ? "Activée : un code de votre application vous est demandé à chaque connexion."
                  : "Protégez votre compte avec un code à 6 chiffres demandé à chaque connexion.")}
            </p>
          </div>
          <Switch
            checked={enabled || Boolean(setup)}
            onCheckedChange={onToggle}
            disabled={busy}
            label={
              enabled
                ? "Désactiver la double authentification"
                : "Activer la double authentification"
            }
          />
        </div>

        {setupForm && <div className="mt-5">{setupForm}</div>}
        {recoveryBlock && <div className="mt-4">{recoveryBlock}</div>}
        {enabled && !recoveryCodes && (
          <button
            type="button"
            onClick={regenerate}
            disabled={busy}
            className="mt-3 inline-flex items-center gap-2 text-xs font-medium text-cream/50 transition hover:text-gold-light disabled:opacity-50"
          >
            <KeyRound size={13} /> Générer de nouveaux codes de secours
          </button>
        )}
      </div>
    );
  }

  return (
    <div>
      {prompt}
      {recoveryBlock && <div className="mb-6">{recoveryBlock}</div>}

      {enabled ? (
        <div className="space-y-4">
          <p className="flex items-center gap-2 text-sm font-semibold text-olive-light">
            <ShieldCheck size={16} /> Activée
          </p>
          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              onClick={regenerate}
              disabled={busy}
              className="inline-flex items-center gap-2 rounded-full border border-gold/30 px-5 py-2.5 text-xs font-semibold text-cream/80 hover:border-gold/60 disabled:opacity-50"
            >
              <KeyRound size={14} /> Nouveaux codes de secours
            </button>
            <button
              type="button"
              onClick={disable}
              disabled={busy}
              className="inline-flex items-center gap-2 rounded-full border border-terracotta/40 px-5 py-2.5 text-xs font-semibold text-terracotta-light hover:bg-terracotta/10 disabled:opacity-50"
            >
              <ShieldOff size={14} /> Désactiver
            </button>
          </div>
        </div>
      ) : setup ? (
        setupForm
      ) : (
        <button
          type="button"
          onClick={startSetup}
          disabled={busy}
          className="flex w-full items-center justify-center gap-2 rounded-full bg-gradient-to-br from-gold-light to-gold px-6 py-4 text-xs font-bold uppercase tracking-[0.22em] text-night transition hover:brightness-105 disabled:opacity-50"
        >
          <ShieldCheck size={16} /> Activer la double authentification
        </button>
      )}
    </div>
  );
}

/** Appareils connectés au compte, avec déconnexion à distance. */
function ConnectedDevices() {
  const { showToast } = useToast();
  const { run, prompt } = useReauthentication();
  const [sessions, setSessions] = useState<AuthSessionInfo[]>([]);
  const [loadingSessions, setLoadingSessions] = useState(true);
  const [busy, setBusy] = useState(false);

  const loadSessions = useCallback(async () => {
    try {
      const { sessions } = await api.getSessions();
      setSessions(sessions);
    } catch {
      /* affichage seulement */
    } finally {
      setLoadingSessions(false);
    }
  }, []);

  useEffect(() => {
    void loadSessions();
  }, [loadSessions]);

  const guard = async (action: () => Promise<void>) => {
    setBusy(true);
    try {
      await action();
    } catch (error) {
      showToast(error instanceof Error ? error.message : "Une erreur est survenue", "error");
    } finally {
      setBusy(false);
    }
  };

  const revoke = (session: AuthSessionInfo) =>
    guard(async () => {
      await api.revokeSession(session.id);
      showToast(`${session.device_name} a été déconnecté.`, "success");
      await loadSessions();
    });

  const revokeOthers = () =>
    guard(async () => {
      const result = await run(() => api.revokeOtherSessions());
      if (result) {
        showToast(result.message, "success");
        await loadSessions();
      }
    });

  return (
    <>
      {prompt}
      {loadingSessions ? (
        <div className="h-10 w-10 animate-spin rounded-full border-[3px] border-gold border-t-transparent" />
      ) : (
        <ul className="space-y-3">
          {sessions.map((session) => (
            <li
              key={session.id}
              className="flex items-center justify-between gap-3 rounded-2xl border border-gold/15 bg-white/5 p-4"
            >
              <div className="flex min-w-0 items-center gap-3">
                {/Android|iOS/.test(session.device_name) ? (
                  <Smartphone size={18} className="shrink-0 text-gold-light" />
                ) : (
                  <Laptop size={18} className="shrink-0 text-gold-light" />
                )}
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-cream">
                    {session.device_name}
                    {session.current && (
                      <span className="ml-2 text-xs font-normal text-olive-light">
                        (cet appareil)
                      </span>
                    )}
                  </p>
                  <p className="text-xs text-cream/45">
                    Dernière activité : {formatDate(session.last_used_at)}
                    {session.ip_address ? ` · ${session.ip_address}` : ""}
                  </p>
                </div>
              </div>
              {!session.current && (
                <button
                  type="button"
                  onClick={() => revoke(session)}
                  disabled={busy}
                  aria-label={`Déconnecter ${session.device_name}`}
                  className="shrink-0 rounded-full border border-terracotta/40 p-2 text-terracotta-light hover:bg-terracotta/10 disabled:opacity-50"
                >
                  <LogOut size={14} />
                </button>
              )}
            </li>
          ))}
        </ul>
      )}

      {sessions.length > 1 && (
        <button
          type="button"
          onClick={revokeOthers}
          disabled={busy}
          className="mt-5 inline-flex items-center gap-2 rounded-full border border-terracotta/40 px-5 py-2.5 text-xs font-semibold text-terracotta-light hover:bg-terracotta/10 disabled:opacity-50"
        >
          <LogOut size={14} /> Déconnecter tous les autres appareils
        </button>
      )}
    </>
  );
}

/**
 * Sécurité du compte (administration) : double authentification et
 * appareils connectés.
 */
export default function SecurityPanel() {
  const { user } = useAuth();
  if (!user) return null;

  return (
    <div className="grid gap-6 lg:grid-cols-2 lg:gap-8">
      <section className="glass-warm glass-edge rounded-3xl p-5 sm:p-8">
        <div className="mb-6 flex items-start gap-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-gold/20 bg-white/5 text-gold-light">
            <ShieldCheck size={22} />
          </div>
          <div>
            <h2 className="font-display text-2xl font-semibold uppercase text-cream">
              Double authentification
            </h2>
            <p className="mt-1 text-xs leading-relaxed text-cream/50">
              Un code à 6 chiffres de votre application (Google Authenticator, Microsoft
              Authenticator…) vous sera demandé à chaque connexion.
              {user.is_admin && " Fortement recommandée pour les comptes administrateurs."}
            </p>
          </div>
        </div>
        <TwoFactorSettings />
      </section>

      <section className="glass-warm glass-edge rounded-3xl p-5 sm:p-8">
        <div className="mb-6 flex items-start gap-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-gold/20 bg-white/5 text-gold-light">
            <Laptop size={22} />
          </div>
          <div>
            <h2 className="font-display text-2xl font-semibold uppercase text-cream">
              Appareils connectés
            </h2>
            <p className="mt-1 text-xs leading-relaxed text-cream/50">
              Déconnectez un appareil que vous ne reconnaissez pas ou que vous n&apos;utilisez plus.
            </p>
          </div>
        </div>
        <ConnectedDevices />
      </section>
    </div>
  );
}
