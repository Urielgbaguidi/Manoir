"use client";

import { Suspense, useState } from "react";
import { motion } from "framer-motion";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowLeft, Eye, EyeOff, Lock, Sparkles, TriangleAlert } from "lucide-react";
import { api } from "@/lib/api";
import { useToast } from "@/context/ToastContext";

function NouveauMotDePasseContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { showToast } = useToast();

  const token = searchParams.get("token") ?? "";
  const email = searchParams.get("email") ?? "";

  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  const lienIncomplet = !token || !email;

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();

    if (password !== confirmation) {
      showToast("Les deux mots de passe ne correspondent pas.", "error");
      return;
    }

    setLoading(true);

    try {
      await api.resetPassword({
        token,
        email,
        password,
        password_confirmation: confirmation
      });
      showToast("Mot de passe modifié. Vous pouvez vous connecter.", "success");
      router.push("/auth/login");
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Une erreur est survenue", "error");
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden px-6 py-24 text-cream">
      <div className="pointer-events-none absolute left-1/4 top-1/4 h-96 w-96 rounded-full bg-gold/[0.06] blur-3xl" />
      <div className="pointer-events-none absolute bottom-1/4 right-1/4 h-[400px] w-[400px] rounded-full bg-gold/[0.06] blur-3xl" />

      <motion.div
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
        className="relative z-10 w-full max-w-md"
      >
        <div className="mb-8 text-center">
          <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-gold/25 bg-white/5 px-4 py-2 backdrop-blur-md">
            <Sparkles className="h-4 w-4 text-gold-light" />
            <span className="text-[10px] font-semibold uppercase tracking-[0.28em] text-cream/85">
              Le Manoir
            </span>
          </div>
          <h1 className="mb-2 font-display text-4xl font-semibold uppercase tracking-tight">
            <span className="text-gradient-gold">Nouveau mot de passe</span>
          </h1>
          {!lienIncomplet && (
            <p className="text-sm text-cream/55">
              Pour le compte <span className="text-gold-light">{email}</span>
            </p>
          )}
        </div>

        <div className="glass-dark glass-edge space-y-6 rounded-3xl p-8">
          {lienIncomplet ? (
            <div className="space-y-6 text-center">
              <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full border border-terracotta/40 bg-terracotta/15">
                <TriangleAlert className="h-7 w-7 text-terracotta" />
              </div>
              <div className="space-y-2">
                <p className="font-display text-lg font-semibold text-cream">Lien incomplet</p>
                <p className="text-sm leading-6 text-cream/60">
                  Ce lien de réinitialisation est incomplet ou a été tronqué par votre messagerie.
                  Demandez-en un nouveau.
                </p>
              </div>
              <Link
                href="/auth/mot-de-passe-oublie"
                className="inline-flex items-center justify-center rounded-full bg-gradient-to-br from-gold-light to-gold px-8 py-3.5 text-xs font-bold uppercase tracking-[0.25em] text-night transition duration-300 hover:brightness-105"
              >
                Demander un nouveau lien
              </Link>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-5">
              <div className="space-y-2">
                <label className="block text-[10px] font-semibold uppercase tracking-widest text-gold/80">
                  Nouveau mot de passe
                </label>
                <div className="relative">
                  <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-4 text-cream/40">
                    <Lock size={16} />
                  </div>
                  <input
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    required
                    minLength={8}
                    className="glass-input w-full rounded-xl py-3.5 pl-11 pr-12 text-sm outline-none"
                    placeholder="8 caractères minimum"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute inset-y-0 right-0 flex items-center pr-4 text-cream/40 transition-colors hover:text-gold-light"
                  >
                    {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
              </div>

              <div className="space-y-2">
                <label className="block text-[10px] font-semibold uppercase tracking-widest text-gold/80">
                  Confirmer le mot de passe
                </label>
                <div className="relative">
                  <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-4 text-cream/40">
                    <Lock size={16} />
                  </div>
                  <input
                    type={showPassword ? "text" : "password"}
                    value={confirmation}
                    onChange={(event) => setConfirmation(event.target.value)}
                    required
                    minLength={8}
                    className="glass-input w-full rounded-xl py-3.5 pl-11 pr-4 text-sm outline-none"
                    placeholder="Répétez le mot de passe"
                  />
                </div>
              </div>

              <p className="text-xs leading-5 text-cream/40">
                Par sécurité, changer votre mot de passe déconnecte tous vos appareils.
              </p>

              <button
                type="submit"
                disabled={loading}
                className="mt-4 flex w-full items-center justify-center gap-2 rounded-full bg-gradient-to-br from-gold-light to-gold py-4 text-xs font-bold uppercase tracking-[0.25em] text-night transition duration-300 hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {loading ? (
                  <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-night border-t-transparent" />
                ) : (
                  "Enregistrer"
                )}
              </button>
            </form>
          )}

          <div className="border-t border-gold/15 pt-4 text-center">
            <Link
              href="/auth/login"
              className="inline-flex items-center gap-2 text-xs font-semibold tracking-wide text-cream/60 transition duration-300 hover:text-gold-light"
            >
              <ArrowLeft size={14} />
              Retour à la connexion
            </Link>
          </div>
        </div>
      </motion.div>
    </main>
  );
}

export default function NouveauMotDePassePage() {
  return (
    <Suspense fallback={null}>
      <NouveauMotDePasseContent />
    </Suspense>
  );
}
