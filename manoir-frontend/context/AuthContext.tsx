"use client";

import React, { createContext, useCallback, useContext, useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { toast } from "react-toastify";
import { ApiError, api, User } from "@/lib/api";

interface AuthContextType {
  user: User | null;
  /** Vrai uniquement pendant la lecture initiale de la session (au chargement). */
  loading: boolean;
  /** Vrai entre le clic sur « Déconnexion » et l'arrivée sur la page d'accueil. */
  loggingOut: boolean;
  login: (email: string, password: string, redirectTo?: string) => Promise<void>;
  loginWithGoogle: (credential: string, redirectTo?: string) => Promise<void>;
  register: (
    name: string,
    email: string,
    phone: string,
    password: string,
    country: string,
    redirectTo?: string
  ) => Promise<void>;
  logout: (redirectTo?: string) => void;
  refreshUser: () => Promise<User | null>;
  isAdmin: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [pendingLogout, setPendingLogout] = useState<string | null>(null);
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    async function loadUser() {
      const token = api.getToken();
      if (token) {
        try {
          const profile = await api.getCurrentUser();
          setUser(profile);
        } catch (error) {
          if (!(error instanceof ApiError && error.status === 401)) {
            console.warn("Impossible de charger le profil utilisateur.");
          }
          api.clearToken();
          setUser(null);
        }
      }
      setLoading(false);
    }
    loadUser();
  }, []);

  // Les pages qui suivent une connexion sont préchargées dès qu'on connaît le
  // rôle : la redirection est alors immédiate.
  useEffect(() => {
    router.prefetch("/espace-client");
    router.prefetch("/admin");
  }, [router]);

  /**
   * Connexion réussie : le message et la redirection partent au même instant.
   * (Pas d'état « chargement » global : il faisait afficher un spinner aux
   * tableaux de bord et retardait l'arrivée.)
   */
  const onLoggedIn = (loggedUser: User, redirectTo?: string) => {
    setUser(loggedUser);
    toast.success(`Connexion réussie. Bienvenue, ${loggedUser.name.split(" ")[0]} !`, {
      toastId: "login-success"
    });

    if (loggedUser.is_admin) {
      router.push("/admin");
      return;
    }

    // Un client dont l'adresse n'est pas confirmée ne peut rien réserver :
    // on l'amène à la saisie du code plutôt que de le laisser buter dessus.
    if (loggedUser.email_verified_at === null) {
      router.push(
        redirectTo
          ? `/auth/confirmer-email?redirect=${encodeURIComponent(redirectTo)}`
          : "/auth/confirmer-email"
      );
      return;
    }

    // "/" n'est pas une vraie destination après connexion : l'espace client l'est.
    router.push(redirectTo && redirectTo !== "/" ? redirectTo : "/espace-client");
  };

  const loginWithGoogle = async (credential: string, redirectTo?: string) => {
    const response = await api.loginWithGoogle(credential);
    onLoggedIn(response.user, redirectTo);
  };

  const login = async (email: string, password: string, redirectTo?: string) => {
    const response = await api.login(email, password);
    onLoggedIn(response.user, redirectTo);
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
    setUser(response.user);
    toast.success("Compte créé ! Saisissez le code reçu par e-mail.", { toastId: "register-success" });
    // Le code vient d'être envoyé et le serveur refuse toute réservation tant
    // qu'il n'est pas saisi : on passe donc TOUJOURS par la confirmation, en
    // emportant la destination voulue pour y revenir ensuite.
    router.push(
      redirectTo
        ? `/auth/confirmer-email?redirect=${encodeURIComponent(redirectTo)}`
        : "/auth/confirmer-email"
    );
  };

  /**
   * Déconnexion instantanée : on part vers l'accueil sans attendre le serveur
   * (la révocation du jeton part en arrière-plan). L'utilisateur n'est vidé
   * qu'à l'arrivée sur la page, pour que le tableau de bord ne clignote pas
   * vers un écran de chargement ou de connexion.
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
    // Filet de sécurité si la navigation n'aboutit pas.
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

  const isAdmin = user ? user.is_admin : false;

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        loggingOut: pendingLogout !== null,
        login,
        loginWithGoogle,
        register,
        logout,
        refreshUser,
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
