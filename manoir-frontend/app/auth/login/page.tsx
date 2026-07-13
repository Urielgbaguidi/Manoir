'use client';

import { Suspense, useState } from 'react';
import { motion } from 'framer-motion';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Sparkles, Eye, EyeOff, Lock, Mail } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/context/ToastContext';

function LoginContent() {
  const searchParams = useSearchParams();
  const redirectTo = searchParams.get('redirect') || undefined;
  const message = searchParams.get('message');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  const { login } = useAuth();
  const { showToast } = useToast();

  const successMessage =
    message === 'reservation-sent'
      ? "Votre demande a été envoyée avec succès. Connectez-vous à votre espace client pour suivre l'état de votre demande."
      : message === 'session-expired'
        ? "Votre session a expire. Connectez-vous a nouveau pour acceder a votre espace client."
        : null;

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setLoading(true);

    try {
      await login(email, password, redirectTo);
      showToast('Connexion réussie ! Bienvenue au Manoir.', 'success');
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Une erreur est survenue', 'error');
    } finally {
      setLoading(false);
    }
  };

  const registerHref = redirectTo
    ? `/auth/register?redirect=${encodeURIComponent(redirectTo)}`
    : '/auth/register';

  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-cream px-6 py-24 grain-layer">
      <div className="pointer-events-none absolute left-1/4 top-1/4 h-96 w-96 rounded-full bg-bark/[0.03] blur-3xl" />
      <div className="pointer-events-none absolute bottom-1/4 right-1/4 h-[400px] w-[400px] rounded-full bg-bark/[0.03] blur-3xl" />

      <motion.div
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
        className="relative z-10 w-full max-w-md"
      >
        <div className="mb-8 text-center">
          <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-bark/10 bg-bark/5 px-4 py-2 backdrop-blur-md">
            <Sparkles className="h-4 w-4 text-bark" />
            <span className="text-[10px] font-semibold uppercase tracking-widest text-bark">
              Le Manoir
            </span>
          </div>
          <h1 className="mb-2 font-display text-4xl font-bold uppercase tracking-tight text-bark">
            Connexion
          </h1>
          <p className="text-sm text-bark/50">
            Accédez à votre espace client pour suivre vos séjours.
          </p>
        </div>

        <div className="space-y-6 rounded-3xl border border-bark/10 bg-cream-dark/60 p-8 shadow-2xl backdrop-blur-xl">
          {successMessage && (
            <div className="rounded-2xl border border-olive/20 bg-olive/10 p-4 text-sm leading-6 text-olive">
              {successMessage}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="space-y-2">
              <label className="block text-[10px] font-semibold uppercase tracking-widest text-bark/50">Email</label>
              <div className="relative">
                <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-4 text-bark/40">
                  <Mail size={16} />
                </div>
                <input
                  type="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  required
                  className="w-full rounded-xl border border-bark/10 bg-cream py-3.5 pl-11 pr-4 text-sm text-charcoal outline-none transition-all placeholder:text-bark/30 focus:border-bark focus:ring-1 focus:ring-bark/15"
                  placeholder="votre@email.com"
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="block text-[10px] font-semibold uppercase tracking-widest text-bark/50">Mot de passe</label>
              <div className="relative">
                <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-4 text-bark/40">
                  <Lock size={16} />
                </div>
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  required
                  className="w-full rounded-xl border border-bark/10 bg-cream py-3.5 pl-11 pr-12 text-sm text-charcoal outline-none transition-all placeholder:text-bark/30 focus:border-bark focus:ring-1 focus:ring-bark/15"
                  placeholder="Mot de passe"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 flex items-center pr-4 text-bark/40 transition-colors hover:text-bark"
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-bark py-4 text-xs font-black uppercase tracking-[0.25em] text-cream transition duration-300 hover:bg-bark-light disabled:opacity-50"
            >
              {loading ? (
                <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-cream border-t-transparent" />
              ) : (
                'Se connecter'
              )}
            </button>
          </form>

          <div className="border-t border-bark/5 pt-2 text-center">
            <Link
              href={registerHref}
              className="text-xs font-semibold tracking-wide text-bark/60 transition duration-300 hover:text-bark"
            >
              Pas encore de compte ? Créer un profil
            </Link>
          </div>
        </div>
      </motion.div>
    </main>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginContent />
    </Suspense>
  );
}
