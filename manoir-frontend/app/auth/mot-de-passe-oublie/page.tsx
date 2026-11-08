"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import Link from "next/link";
import { ArrowLeft, MailCheck, Mail, Sparkles } from "lucide-react";
import { api } from "@/lib/api";
import { useToast } from "@/context/ToastContext";

export default function MotDePasseOubliePage() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [envoye, setEnvoye] = useState(false);
  const { showToast } = useToast();

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setLoading(true);

    try {
      await api.forgotPassword(email);
      setEnvoye(true);
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
            <span className="text-gradient-gold">Mot de passe oublié</span>
          </h1>
          <p className="text-sm text-cream/55">
            Indiquez votre adresse, nous vous envoyons un lien de réinitialisation.
          </p>
        </div>

        <div className="glass-dark glass-edge space-y-6 rounded-3xl p-8">
          {envoye ? (
            <div className="space-y-6 text-center">
              <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full border border-olive/40 bg-olive/15">
                <MailCheck className="h-7 w-7 text-olive-light" />
              </div>
              <div className="space-y-2">
                <p className="font-display text-lg font-semibold text-cream">
                  Vérifiez votre boîte mail
                </p>
                <p className="text-sm leading-6 text-cream/60">
                  Si un compte existe avec l&apos;adresse{" "}
                  <span className="text-gold-light">{email}</span>, un lien de réinitialisation
                  vient d&apos;y être envoyé. Il reste valable une heure.
                </p>
                <p className="text-xs leading-5 text-cream/40">
                  Pensez à regarder dans les courriers indésirables.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setEnvoye(false)}
                className="text-xs font-semibold tracking-wide text-cream/60 transition duration-300 hover:text-gold-light"
              >
                Utiliser une autre adresse
              </button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-5">
              <div className="space-y-2">
                <label className="block text-[10px] font-semibold uppercase tracking-widest text-gold/80">
                  Email
                </label>
                <div className="relative">
                  <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-4 text-cream/40">
                    <Mail size={16} />
                  </div>
                  <input
                    type="email"
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    required
                    className="glass-input w-full rounded-xl py-3.5 pl-11 pr-4 text-sm outline-none"
                    placeholder="votre@email.com"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="mt-4 flex w-full items-center justify-center gap-2 rounded-full bg-gradient-to-br from-gold-light to-gold py-4 text-xs font-bold uppercase tracking-[0.25em] text-night transition duration-300 hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {loading ? (
                  <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-night border-t-transparent" />
                ) : (
                  "Envoyer le lien"
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
