"use client";

import React, { createContext, useCallback, useContext, useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { toast } from "react-toastify";
import { ApiError, LoginResult, api, User } from "@/lib/api";
import { isAdminUser, roleSafeRedirect } from "@/lib/roles";

interface AuthContextType {
  user: User | null;
  /** Vrai uniquement pendant la lecture initiale de la session (au chargement). */
  loading: boolean;
  /** Vrai entre le clic sur « Déconnexion » et l'arrivée sur la page d'accueil. */
  loggingOut: boolean;
  /**
   * Connexion par mot de passe. Renvoie `two_factor` quand un code 2FA est
   * attendu : la page affiche alors la saisie du code.
   */
  login: (email: string, password: string, redirectTo?: string) => Promise<LoginResult>;
  completeTwoFactor: (
    challengeToken: string,
    code: { code?: string; recovery_code?: string },
    redirectTo?: string
  ) => Promise<void>;
  loginWithGoogle: (credential: string, redirectTo?: string) => Promise<LoginResult>;
  /** Inscription : aucune session n'est ouverte avant la saisie du code reçu. */
  register: (
    name: string,
    email: string,
    phone: string,
    password: string,
    country: string,
    redirectTo?: string
  ) => Promise<void>;
  /** Ouverture du lien de confirmation reçu par e-mail : ouvre la session. */
  verifyEmail: (email: string, token: string) => Promise<void>;
  logout: (redirectTo?: string) => void;
  refreshUser: () => Promise<User | null>;
  setUser: (user: User | null) => void;
  isAdmin: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

/** Page de saisie du téléphone obligatoire : la même que l'inscription. */
export function phoneCompletionPath(redirectTo?: string) {
  return redirectTo
    ? `/auth/register?etape=telephone&redirect=${encodeURIComponent(redirectTo)}`
    : "/auth/register?etape=telephone";
}

export function emailConfirmationPath(email: string) {
  return `/auth/confirmer-email?${new URLSearchParams({ email }).toString()}`;
}

/*
 * Page à rouvrir après la confirmation de l'adresse (une fiche appartement,
 * par exemple). Le lien du mail s'ouvre souvent dans un nouvel onglet : la
 * destination est donc gardée dans le navigateur (simple chemin du site, sans
 * aucune donnée sensible).
 */
const AFTER_VERIFY_KEY = "manoir:after-email-verification";

function rememberAfterVerification(redirectTo?: string) {
  try {
    if (redirectTo && redirectTo.startsWith("/") && !redirectTo.startsWith("//")) {
      window.localStorage.setItem(AFTER_VERIFY_KEY, redirectTo);
    } else {
      window.localStorage.removeItem(AFTER_VERIFY_KEY);
    }
  } catch {
    /* stockage indisponible : retour à l'espace client */
  }
}

function takeAfterVerification(): string | undefined {
  try {
    const value = window.localStorage.getItem(AFTER_VERIFY_KEY);
    window.localStorage.removeItem(AFTER_VERIFY_KEY);
    return value && value.startsWith("/") && !value.startsWith("//") ? value : undefined;
  } catch {
    return undefined;
  }
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [pendingLogout, setPendingLogout] = useState<string | null>(null);
  const router = useRouter();
  const pathname = usePathname();

  // La session vit dans des cookies HttpOnly : on demande simplement à l'API
  // qui est connecté (et on récupère le jeton CSRF au passage).
  useEffect(() => {
    let cancelled = false;
    api.restoreSession().then((restored) => {
      if (cancelled) return;
      setUser(restored);
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    router.prefetch("/espace-client");
    router.prefetch("/admin");
  }, [router]);

  // Separation stricte des espaces : un administrateur ne reste jamais dans
  // l'espace client (ni sur une page d'authentification), et un client ne
  // reste jamais dans le back-office.
  useEffect(() => {
    if (loading || !user || pendingLogout) return;

    const currentPath = pathname || "";

    if (isAdminUser(user)) {
      if (currentPath.startsWith("/espace-client") || currentPath.startsWith("/auth")) {
        router.replace("/admin");
      }
      return;
    }

    if (currentPath.startsWith("/admin")) {
      router.replace("/espace-client");
    }
  }, [loading, user, pendingLogout, pathname, router]);

  /**
   * Session ouverte : message et redirection au même instant. Un compte sans
   * téléphone (Google) est d'abord envoyé compléter son profil.
   */
  const onLoggedIn = useCallback(
    (
      loggedUser: User,
      redirectTo?: string,
      options: { replace?: boolean; welcome?: string } = {}
    ) => {
      setUser(loggedUser);
      // Après la confirmation de l'adresse, la page du lien ne doit pas
      // rester dans l'historique (retour arrière).
      const go = options.replace ? router.replace : router.push;

      const isAdmin = isAdminUser(loggedUser);
      // Un admin ne peut atterrir que dans /admin, un client jamais dans /admin.
      const destination = roleSafeRedirect(loggedUser, redirectTo);

      // Les administrateurs n'ont jamais à renseigner de téléphone.
      if (!isAdmin && loggedUser.profile_completed === false) {
        toast.info("Dernière étape : renseignez votre numéro de téléphone.", {
          toastId: "phone-required"
        });
        go(phoneCompletionPath(destination));
        return;
      }

      toast.success(
        options.welcome ?? `Connexion réussie. Bienvenue, ${loggedUser.name.split(" ")[0]} !`,
        { toastId: "login-success" }
      );

      go(destination);
    },
    [router]
  );

  const login = async (email: string, password: string, redirectTo?: string) => {
    try {
      const result = await api.login(email, password);
      if (result.kind === "session") onLoggedIn(result.user, redirectTo);
      return result;
    } catch (error) {
      // Mot de passe correct mais adresse non confirmée : un nouveau lien
      // vient de partir, la page de confirmation l'explique.
      if (error instanceof ApiError && error.reason === "email_not_verified") {
        rememberAfterVerification(redirectTo);
        router.push(emailConfirmationPath(String(error.data.email || email)));
      }
      throw error;
    }
  };

  const completeTwoFactor = async (
    challengeToken: string,
    code: { code?: string; recovery_code?: string },
    redirectTo?: string
  ) => {
    const loggedUser = await api.completeTwoFactorLogin(challengeToken, code);
    onLoggedIn(loggedUser, redirectTo);
  };

  const loginWithGoogle = async (credential: string, redirectTo?: string) => {
    const result = await api.loginWithGoogle(credential);
    if (result.kind === "session") onLoggedIn(result.user, redirectTo);
    return result;
  };

  const register = async (
    name: string,
    email: string,
    phone: string,
    password: string,
    country: string,
    redirectTo?: string
  ) => {
    const response = await api.register({ name, email, phone, password, country });
    rememberAfterVerification(redirectTo);
    if (response.already_pending) {
      toast.info(response.message, { toastId: "register-pending" });
    }
    router.push(emailConfirmationPath(response.email || email));
  };

  const verifyEmail = async (email: string, token: string) => {
    const verifiedUser = await api.verifyEmailLink(email, token);
    onLoggedIn(verifiedUser, takeAfterVerification(), {
      replace: true,
      welcome: `Adresse e-mail confirmée. Bienvenue, ${verifiedUser.name.split(" ")[0]} !`
    });
  };

  /**
   * Déconnexion instantanée : on part vers l'accueil sans attendre le serveur
   * (la révocation part en arrière-plan). L'utilisateur n'est vidé qu'à
   * l'arrivée sur la page, pour que le tableau de bord ne clignote pas.
   */
  const logout = useCallback(
    (redirectTo = "/") => {
      api.logout();
      if (pathname === redirectTo) {
        setUser(null);
        return;
      }
      setPendingLogout(redirectTo);
      router.replace(redirectTo);
    },
    [pathname, router]
  );

  useEffect(() => {
    if (!pendingLogout) return;
    if (pathname === pendingLogout) {
      setUser(null);
      setPendingLogout(null);
      return;
    }
    const timer = window.setTimeout(() => {
      setUser(null);
      setPendingLogout(null);
    }, 2000);
    return () => window.clearTimeout(timer);
  }, [pathname, pendingLogout]);

  const refreshUser = async () => {
    const profile = await api.getCurrentUser();
    setUser(profile);
    return profile;
  };

  // Le rôle affiché ne sert qu'à l'interface : chaque route admin est
  // contrôlée par l'API, qui relit le rôle en base à chaque requête.
  const isAdmin = isAdminUser(user);

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        loggingOut: pendingLogout !== null,
        login,
        completeTwoFactor,
        loginWithGoogle,
        register,
        verifyEmail,
        logout,
        refreshUser,
        setUser,
        isAdmin
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
