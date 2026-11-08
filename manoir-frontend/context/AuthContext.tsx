"use client";

import React, { createContext, useContext, useState, useEffect } from "react";
import { ApiError, api, User } from "@/lib/api";
import { useRouter } from "next/navigation";

interface AuthContextType {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string, redirectTo?: string) => Promise<void>;
  register: (
    name: string,
    email: string,
    phone: string,
    password: string,
    redirectTo?: string
  ) => Promise<void>;
  logout: (redirectTo?: string) => Promise<void>;
  refreshUser: () => Promise<User | null>;
  isAdmin: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

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

  const login = async (email: string, password: string, redirectTo?: string) => {
    setLoading(true);
    try {
      const response = await api.login(email, password);
      setUser(response.user);

      if (response.user.is_admin) {
        router.push("/admin");
        return;
      }

      // Un client dont l'adresse n'est pas confirmee ne peut rien reserver :
      // on l'amene a la saisie du code plutot que de le laisser buter dessus.
      if (response.user.email_verified_at === null) {
        router.push(
          redirectTo
            ? `/auth/confirmer-email?redirect=${encodeURIComponent(redirectTo)}`
            : "/auth/confirmer-email"
        );
        return;
      }

      router.push(redirectTo || "/espace-client");
    } catch (error) {
      setUser(null);
      throw error;
    } finally {
      setLoading(false);
    }
  };

  const register = async (
    name: string,
    email: string,
    phone: string,
    password: string,
    redirectTo?: string
  ) => {
    setLoading(true);
    try {
      const response = await api.register({ name, email, phone, password });
      setUser(response.user);
      // Le code vient d'etre envoye et le serveur refuse toute reservation tant
      // qu'il n'est pas saisi : on passe donc TOUJOURS par la confirmation, en
      // emportant la destination voulue pour y revenir ensuite.
      router.push(
        redirectTo
          ? `/auth/confirmer-email?redirect=${encodeURIComponent(redirectTo)}`
          : "/auth/confirmer-email"
      );
    } catch (error) {
      setUser(null);
      throw error;
    } finally {
      setLoading(false);
    }
  };

  const logout = async (redirectTo = "/") => {
    setLoading(true);
    try {
      await api.logout();
    } catch (error) {
      if (!(error instanceof ApiError && error.status === 401)) {
        console.warn("Déconnexion distante indisponible, session locale nettoyée.");
      }
    } finally {
      setUser(null);
      setLoading(false);
      router.push(redirectTo);
    }
  };

  const refreshUser = async () => {
    const profile = await api.getCurrentUser();
    setUser(profile);
    return profile;
  };

  const isAdmin = user ? user.is_admin : false;

  return (
    <AuthContext.Provider value={{ user, loading, login, register, logout, refreshUser, isAdmin }}>
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
