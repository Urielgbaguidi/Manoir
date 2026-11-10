"use client";

import { useEffect, useRef, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { useToast } from "@/context/ToastContext";

const GOOGLE_CLIENT_ID = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;
const GIS_SRC = "https://accounts.google.com/gsi/client";

type GoogleCredentialResponse = { credential?: string };

type GoogleIdentity = {
  accounts: {
    id: {
      initialize: (config: {
        client_id: string;
        callback: (response: GoogleCredentialResponse) => void;
        ux_mode?: "popup" | "redirect";
        auto_select?: boolean;
        cancel_on_tap_outside?: boolean;
        context?: "signin" | "signup" | "use";
      }) => void;
      renderButton: (element: HTMLElement, options: Record<string, unknown>) => void;
    };
  };
};

declare global {
  interface Window {
    google?: GoogleIdentity;
  }
}

let gisPromise: Promise<void> | null = null;

/** Charge le script Google Identity Services une seule fois pour tout le site. */
function loadGoogleScript(): Promise<void> {
  if (typeof window === "undefined") return Promise.reject();
  if (window.google?.accounts?.id) return Promise.resolve();
  if (gisPromise) return gisPromise;

  gisPromise = new Promise<void>((resolve, reject) => {
    const script = document.createElement("script");
    script.src = GIS_SRC;
    script.async = true;
    script.defer = true;
    script.onload = () => resolve();
    script.onerror = () => {
      gisPromise = null;
      reject(new Error("Google indisponible"));
    };
    document.head.appendChild(script);
  });

  return gisPromise;
}

function GoogleGlyph() {
  return (
    <svg viewBox="0 0 48 48" className="size-5" aria-hidden>
      <path
        fill="#FFC107"
        d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.3 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z"
      />
      <path
        fill="#FF3D00"
        d="M6.3 14.7l6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z"
      />
      <path
        fill="#4CAF50"
        d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.3 0-9.7-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z"
      />
      <path
        fill="#1976D2"
        d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z"
      />
    </svg>
  );
}

/**
 * Bouton « Continuer avec Google ».
 *
 * Utilise le bouton officiel Google (exige par Google pour le flux par jeton
 * d'identite) et transmet le jeton a l'API. Sans identifiant client configure,
 * un bouton de meme apparence informe l'utilisateur au lieu de casser la page.
 */
export default function GoogleSignInButton({
  mode = "signin",
  redirectTo
}: {
  mode?: "signin" | "signup";
  redirectTo?: string;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [ready, setReady] = useState(false);
  const [pending, setPending] = useState(false);
  const { loginWithGoogle } = useAuth();
  const { showToast } = useToast();

  // Les callbacks Google sont figes a l'initialisation : on passe par une ref
  // pour toujours utiliser la derniere destination demandee.
  const redirectRef = useRef(redirectTo);
  redirectRef.current = redirectTo;
  const loginRef = useRef(loginWithGoogle);
  loginRef.current = loginWithGoogle;
  const toastRef = useRef(showToast);
  toastRef.current = showToast;

  useEffect(() => {
    if (!GOOGLE_CLIENT_ID) return;
    let cancelled = false;

    loadGoogleScript()
      .then(() => {
        if (cancelled || !containerRef.current || !window.google) return;

        window.google.accounts.id.initialize({
          client_id: GOOGLE_CLIENT_ID,
          ux_mode: "popup",
          cancel_on_tap_outside: true,
          context: mode === "signup" ? "signup" : "signin",
          callback: async (response) => {
            if (!response.credential) {
              toastRef.current("La connexion Google a été annulée.", "info");
              return;
            }
            setPending(true);
            try {
              await loginRef.current(response.credential, redirectRef.current);
            } catch (error) {
              toastRef.current(
                error instanceof Error ? error.message : "Connexion Google impossible.",
                "error"
              );
            } finally {
              setPending(false);
            }
          }
        });

        const isDark = document.documentElement.getAttribute("data-theme") === "dark";
        const width = Math.min(400, Math.max(220, containerRef.current.offsetWidth));

        window.google.accounts.id.renderButton(containerRef.current, {
          type: "standard",
          theme: isDark ? "filled_black" : "outline",
          size: "large",
          shape: "pill",
          text: mode === "signup" ? "signup_with" : "continue_with",
          logo_alignment: "center",
          locale: "fr",
          width
        });
        setReady(true);
      })
      .catch(() => {
        if (!cancelled) setReady(false);
      });

    return () => {
      cancelled = true;
    };
  }, [mode]);

  const fallbackLabel = mode === "signup" ? "S'inscrire avec Google" : "Continuer avec Google";

  return (
    <div className="relative w-full">
      {/* Bouton officiel Google (rendu dans ce conteneur). */}
      <div
        ref={containerRef}
        className={ready ? "flex min-h-[44px] w-full justify-center" : "hidden"}
        aria-busy={pending}
      />

      {!ready && (
        <button
          type="button"
          onClick={() =>
            showToast(
              GOOGLE_CLIENT_ID
                ? "Google est momentanément indisponible. Réessayez dans un instant."
                : "La connexion avec Google sera bientôt disponible.",
              "info"
            )
          }
          className="flex h-11 w-full items-center justify-center gap-3 rounded-full border border-gold/25 bg-white/5 text-sm font-semibold text-cream transition hover:border-gold/50 hover:bg-white/10"
        >
          <GoogleGlyph />
          {fallbackLabel}
        </button>
      )}

      {pending && (
        <div className="absolute inset-0 grid place-items-center rounded-full bg-night/60 backdrop-blur-sm">
          <span className="size-5 animate-spin rounded-full border-2 border-gold border-t-transparent" />
        </div>
      )}
    </div>
  );
}
