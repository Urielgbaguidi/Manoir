"use client";

import { Suspense, useState } from "react";
import { motion } from "framer-motion";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Eye, EyeOff, Lock, Mail, Phone, Sparkles, User as UserIcon } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { useToast } from "@/context/ToastContext";
import CountryCodeSelect from "@/components/ui/CountryCodeSelect";

function RegisterContent() {
  const searchParams = useSearchParams();
  const redirectTo = searchParams.get("redirect") || "/";
  const [lastName, setLastName] = useState("");
  const [firstName, setFirstName] = useState("");
  const [email, setEmail] = useState("");
  const [countryCode, setCountryCode] = useState("+229");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const { register } = useAuth();
  const { showToast } = useToast();

  const loginHref = `/auth/login?redirect=${encodeURIComponent(redirectTo)}`;

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setLoading(true);

    const fullName = `${firstName.trim()} ${lastName.trim()}`;
    const fullPhone = phone.trim().startsWith("+")
      ? phone.trim()
      : `${countryCode} ${phone.trim()}`;

    try {
      await register(fullName, email, fullPhone, password, redirectTo);
      showToast("Inscription réussie ! Bienvenue au Manoir.", "success");
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
            <span className="text-gradient-gold">Inscription</span>
          </h1>
          <p className="text-[15px] text-cream/70">
            Créez votre profil pour envoyer votre demande de réservation.
          </p>
        </div>

        <div className="glass-dark glass-edge space-y-6 rounded-3xl p-8">
          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="space-y-2">
              <label className="block text-[10px] font-semibold uppercase tracking-widest text-gold/80">
                Nom
              </label>
              <div className="relative">
                <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-4 text-cream/40">
                  <UserIcon size={16} />
                </div>
                <input
                  type="text"
                  value={lastName}
                  onChange={(event) => setLastName(event.target.value)}
                  required
                  className="glass-input w-full rounded-xl py-3.5 pl-11 pr-4 text-sm outline-none"
                  placeholder="Votre Nom"
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="block text-[10px] font-semibold uppercase tracking-widest text-gold/80">
                Prénom
              </label>
              <div className="relative">
                <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-4 text-cream/40">
                  <UserIcon size={16} />
                </div>
                <input
                  type="text"
                  value={firstName}
                  onChange={(event) => setFirstName(event.target.value)}
                  required
                  className="glass-input w-full rounded-xl py-3.5 pl-11 pr-4 text-sm outline-none"
                  placeholder="Votre Prénom"
                />
              </div>
            </div>

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

            <div className="space-y-2">
              <label className="block text-[10px] font-semibold uppercase tracking-widest text-gold/80">
                Telephone
              </label>
              <div className="flex gap-2">
                <CountryCodeSelect value={countryCode} onChange={setCountryCode} />
                <div className="relative flex-1">
                  <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-4 text-cream/40">
                    <Phone size={16} />
                  </div>
                  <input
                    type="tel"
                    value={phone}
                    onChange={(event) => setPhone(event.target.value)}
                    required
                    className="glass-input w-full rounded-xl py-3.5 pl-11 pr-4 text-sm outline-none"
                    placeholder="Votre numéro de téléphone"
                  />
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <label className="block text-[10px] font-semibold uppercase tracking-widest text-gold/80">
                Mot de passe
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
                  placeholder="Minimum 8 caracteres"
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

            <button
              type="submit"
              disabled={loading}
              className="mt-4 flex w-full items-center justify-center gap-2 rounded-full bg-gradient-to-br from-gold-light to-gold py-4 text-xs font-bold uppercase tracking-[0.25em] text-night transition duration-300 hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {loading ? (
                <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-night border-t-transparent" />
              ) : (
                "Creer mon compte"
              )}
            </button>
          </form>

          <div className="border-t border-gold/15 pt-2 text-center">
            <Link
              href={loginHref}
              className="text-xs font-semibold tracking-wide text-cream/60 transition duration-300 hover:text-gold-light"
            >
              Déjà un compte ? Se connecter
            </Link>
          </div>
        </div>
      </motion.div>
    </main>
  );
}

export default function RegisterPage() {
  return (
    <Suspense fallback={null}>
      <RegisterContent />
    </Suspense>
  );
}
