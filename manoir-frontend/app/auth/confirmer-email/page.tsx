"use client";

import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { motion } from "framer-motion";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { BadgeCheck, MailCheck, Sparkles } from "lucide-react";
import { api } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { useToast } from "@/context/ToastContext";

const LONGUEUR = 6;

function ConfirmerEmailContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, refreshUser, loading: authLoading } = useAuth();
  const { showToast } = useToast();

  // Destination voulue avant la confirmation (une fiche appartement, par
  // exemple) : on y ramene le client une fois son adresse validee.
  const retour = searchParams.get("redirect");

  const [chiffres, setChiffres] = useState<string[]>(Array(LONGUEUR).fill(""));
  const [envoi, setEnvoi] = useState(false);
  const [renvoi, setRenvoi] = useState(false);
  const [confirme, setConfirme] = useState(false);
  const cases = useRef<Array<HTMLInputElement | null>>([]);

  const code = useMemo(() => chiffres.join(""), [chiffres]);
  const complet = code.length === LONGUEUR;

  useEffect(() => {
    if (!authLoading && !user) {
      router.push("/auth/login");
    }
  }, [authLoading, user, router]);

  useEffect(() => {
    if (user?.email_verified_at) {
      setConfirme(true);
    }
  }, [user]);

  useEffect(() => {
    cases.current[0]?.focus();
  }, []);

  const valider = async (valeur: string) => {
    if (valeur.length !== LONGUEUR || envoi) return;

    setEnvoi(true);

    try {
      await api.verifyEmailCode(valeur);
      setConfirme(true);
      showToast("Adresse email confirmée.", "success");

      // Sans ce rafraichissement, l'application croit encore l'adresse non
      // confirmee et rebloquerait la reservation.
      await refreshUser();

      if (retour) {
        router.push(retour);
      }
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Une erreur est survenue", "error");
      setChiffres(Array(LONGUEUR).fill(""));
      cases.current[0]?.focus();
    } finally {
      setEnvoi(false);
    }
  };

  const saisir = (index: number, brut: string) => {
    const propre = brut.replace(/\D/g, "");
    if (!propre) return;

    const suivants = [...chiffres];

    // Un collage de 6 chiffres remplit toutes les cases d'un coup.
    propre.split("").forEach((chiffre, decalage) => {
      if (index + decalage < LONGUEUR) {
        suivants[index + decalage] = chiffre;
      }
    });

    setChiffres(suivants);

    const prochaineVide = suivants.findIndex((c) => c === "");
    cases.current[prochaineVide === -1 ? LONGUEUR - 1 : prochaineVide]?.focus();

    const assemble = suivants.join("");
    if (assemble.length === LONGUEUR) {
      void valider(assemble);
    }
  };

  const touche = (index: number, event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Backspace") {
      event.preventDefault();
      const suivants = [...chiffres];

      if (suivants[index]) {
        suivants[index] = "";
        setChiffres(suivants);
        return;
      }

      if (index > 0) {
        suivants[index - 1] = "";
        setChiffres(suivants);
        cases.current[index - 1]?.focus();
      }
    }

    if (event.key === "ArrowLeft" && index > 0) {
      cases.current[index - 1]?.focus();
    }

    if (event.key === "ArrowRight" && index < LONGUEUR - 1) {
      cases.current[index + 1]?.focus();
    }
  };

  const renvoyer = async () => {
    setRenvoi(true);

    try {
      const { message } = await api.resendEmailVerification();
      showToast(message, "success");
      setChiffres(Array(LONGUEUR).fill(""));
      cases.current[0]?.focus();
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Une erreur est survenue", "error");
    } finally {
      setRenvoi(false);
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
            <span className="text-gradient-gold">
              {confirme ? "Adresse confirmée" : "Confirmez votre email"}
            </span>
          </h1>
          {!confirme && user && (
            <p className="text-sm text-cream/55">
              Nous avons envoyé un code à 6 chiffres à{" "}
              <span className="text-gold-light">{user.email}</span>
            </p>
          )}
        </div>

        <div className="glass-dark glass-edge space-y-6 rounded-3xl p-8">
          {confirme ? (
            <div className="space-y-6 text-center">
              <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full border border-olive/40 bg-olive/15">
                <BadgeCheck className="h-7 w-7 text-olive-light" />
              </div>
              <p className="text-sm leading-6 text-cream/60">
                Votre compte est désormais entièrement sécurisé. Vous pouvez réserver en toute
                sérénité.
              </p>
              <Link
                href={retour || "/espace-client"}
                className="inline-flex items-center justify-center rounded-full bg-gradient-to-br from-gold-light to-gold px-8 py-3.5 text-xs font-bold uppercase tracking-[0.25em] text-night transition duration-300 hover:brightness-105"
              >
                {retour ? "Continuer ma réservation" : "Aller à mon espace"}
              </Link>
            </div>
          ) : (
            <>
              <div className="flex justify-center gap-2 sm:gap-3">
                {chiffres.map((chiffre, index) => (
                  <input
                    key={index}
                    ref={(element) => {
                      cases.current[index] = element;
                    }}
                    type="text"
                    inputMode="numeric"
                    autoComplete={index === 0 ? "one-time-code" : "off"}
                    maxLength={LONGUEUR}
                    value={chiffre}
                    onChange={(event) => saisir(index, event.target.value)}
                    onKeyDown={(event) => touche(index, event)}
                    disabled={envoi}
                    aria-label={`Chiffre ${index + 1} sur ${LONGUEUR}`}
                    className="glass-input h-14 w-11 rounded-xl text-center font-display text-2xl font-semibold outline-none disabled:opacity-50 sm:h-16 sm:w-13"
                  />
                ))}
              </div>

              <button
                type="button"
                onClick={() => valider(code)}
                disabled={!complet || envoi}
                className="flex w-full items-center justify-center gap-2 rounded-full bg-gradient-to-br from-gold-light to-gold py-4 text-xs font-bold uppercase tracking-[0.25em] text-night transition duration-300 hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {envoi ? (
                  <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-night border-t-transparent" />
                ) : (
                  "Confirmer"
                )}
              </button>

              <div className="space-y-3 border-t border-gold/15 pt-5 text-center">
                <p className="text-xs leading-5 text-cream/40">
                  Le code expire au bout de 15 minutes. Pensez à regarder dans les courriers
                  indésirables.
                </p>
                <button
                  type="button"
                  onClick={renvoyer}
                  disabled={renvoi}
                  className="inline-flex items-center gap-2 text-xs font-semibold tracking-wide text-cream/60 transition duration-300 hover:text-gold-light disabled:opacity-50"
                >
                  <MailCheck size={14} />
                  {renvoi ? "Envoi..." : "Renvoyer un code"}
                </button>
              </div>
            </>
          )}
        </div>

        {!confirme && (
          <p className="mt-6 text-center text-xs text-cream/40">
            La confirmation est nécessaire pour réserver. Vous pouvez tout de même{" "}
            <Link href="/espace-client" className="text-cream/60 underline hover:text-gold-light">
              consulter votre espace
            </Link>
          </p>
        )}
      </motion.div>
    </main>
  );
}

export default function ConfirmerEmailPage() {
  return (
    <Suspense fallback={null}>
      <ConfirmerEmailContent />
    </Suspense>
  );
}
