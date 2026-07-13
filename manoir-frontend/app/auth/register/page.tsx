'use client';

import { Suspense, useState } from 'react';
import { motion } from 'framer-motion';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Eye, EyeOff, Lock, Mail, Phone, Sparkles, User as UserIcon } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/context/ToastContext';

function RegisterContent() {
  const searchParams = useSearchParams();
  const redirectTo = searchParams.get('redirect') || '/';
  const [lastName, setLastName] = useState('');
  const [firstName, setFirstName] = useState('');
  const [email, setEmail] = useState('');
  const [countryCode, setCountryCode] = useState('+229');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const { register } = useAuth();
  const { showToast } = useToast();

  const loginHref = `/auth/login?redirect=${encodeURIComponent(redirectTo)}`;

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setLoading(true);

    const fullName = `${firstName.trim()} ${lastName.trim()}`;
    const fullPhone = phone.trim().startsWith('+') ? phone.trim() : `${countryCode} ${phone.trim()}`;

    try {
      await register(fullName, email, fullPhone, password, redirectTo);
      showToast('Inscription réussie ! Bienvenue au Manoir.', 'success');
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Une erreur est survenue', 'error');
    } finally {
      setLoading(false);
    }
  };

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
            Inscription
          </h1>
          <p className="text-[15px] text-bark/70">
            Créez votre profil pour envoyer votre demande de réservation.
          </p>
        </div>

        <div className="space-y-6 rounded-3xl border border-bark/10 bg-cream-dark/60 p-8 shadow-2xl backdrop-blur-xl">
          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="space-y-2">
              <label className="block text-[10px] font-semibold uppercase tracking-widest text-bark/70">Nom</label>
              <div className="relative">
                <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-4 text-bark/40">
                  <UserIcon size={16} />
                </div>
                <input
                  type="text"
                  value={lastName}
                  onChange={(event) => setLastName(event.target.value)}
                  required
                  className="w-full rounded-xl border border-bark/10 bg-cream py-3.5 pl-11 pr-4 text-sm text-charcoal outline-none transition-all placeholder:text-bark/30 focus:border-bark focus:ring-1 focus:ring-bark/15"
                  placeholder="Votre Nom"
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="block text-[10px] font-semibold uppercase tracking-widest text-bark/70">Prénom</label>
              <div className="relative">
                <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-4 text-bark/40">
                  <UserIcon size={16} />
                </div>
                <input
                  type="text"
                  value={firstName}
                  onChange={(event) => setFirstName(event.target.value)}
                  required
                  className="w-full rounded-xl border border-bark/10 bg-cream py-3.5 pl-11 pr-4 text-sm text-charcoal outline-none transition-all placeholder:text-bark/30 focus:border-bark focus:ring-1 focus:ring-bark/15"
                  placeholder="Votre Prénom"
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="block text-[10px] font-semibold uppercase tracking-widest text-bark/70">Email</label>
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
              <label className="block text-[10px] font-semibold uppercase tracking-widest text-bark/70">Telephone</label>
              <div className="flex gap-2">
                <select
                  value={countryCode}
                  onChange={(event) => setCountryCode(event.target.value)}
                  className="rounded-xl border border-bark/10 bg-cream py-3.5 px-3 text-sm text-charcoal outline-none focus:border-bark focus:ring-1 focus:ring-bark/15 cursor-pointer"
                >
                  <option value="+229">🇧🇯 +229</option>
                  <option value="+33">🇫🇷 +33</option>
                  <option value="+225">🇨🇮 +225</option>
                  <option value="+228">🇹🇬 +228</option>
                  <option value="+234">🇳🇬 +234</option>
                  <option value="+221">🇸🇳 +221</option>
                  <option value="+226">🇧🇫 +226</option>
                  <option value="+227">🇳🇪 +227</option>
                  <option value="+223">🇲🇱 +223</option>
                  <option value="+237">🇨🇲 +237</option>
                  <option value="+241">🇬🇦 +241</option>
                  <option value="+242">🇨🇬 +242</option>
                  <option value="+243">🇨🇩 +243</option>
                  <option value="+32">🇧🇪 +32</option>
                  <option value="+41">🇨🇭 +41</option>
                  <option value="+1">🇺🇸/🇨🇦 +1</option>
                  <option value="+44">🇬🇧 +44</option>
                </select>
                <div className="relative flex-1">
                  <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-4 text-bark/40">
                    <Phone size={16} />
                  </div>
                  <input
                    type="tel"
                    value={phone}
                    onChange={(event) => setPhone(event.target.value)}
                    required
                    className="w-full rounded-xl border border-bark/10 bg-cream py-3.5 pl-11 pr-4 text-sm text-charcoal outline-none transition-all placeholder:text-bark/30 focus:border-bark focus:ring-1 focus:ring-bark/15"
                    placeholder="Votre numéro de téléphone"
                  />
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <label className="block text-[10px] font-semibold uppercase tracking-widest text-bark/70">Mot de passe</label>
              <div className="relative">
                <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-4 text-bark/40">
                  <Lock size={16} />
                </div>
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  required
                  minLength={8}
                  className="w-full rounded-xl border border-bark/10 bg-cream py-3.5 pl-11 pr-12 text-sm text-charcoal outline-none transition-all placeholder:text-bark/30 focus:border-bark focus:ring-1 focus:ring-bark/15"
                  placeholder="Minimum 8 caracteres"
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
                'Creer mon compte'
              )}
            </button>
          </form>

          <div className="border-t border-bark/5 pt-2 text-center">
            <Link
              href={loginHref}
              className="text-xs font-semibold tracking-wide text-bark/80 transition duration-300 hover:text-bark"
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
