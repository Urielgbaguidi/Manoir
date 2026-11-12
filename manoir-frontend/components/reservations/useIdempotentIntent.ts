"use client";

import { useCallback, useRef } from "react";
import { ApiError, newIdempotencyKey } from "@/lib/api";

/**
 * Clé d'idempotence liée à une intention de l'utilisateur.
 *
 * - même contenu (signature) => même clé : un nouvel essai après une coupure
 *   réseau ne peut pas créer une deuxième demande ou un deuxième paiement ;
 * - contenu différent, ou nouvel essai après un échec définitif (`reset`) =>
 *   nouvelle clé.
 *
 * `inFlight` empêche un double envoi (double clic) avant même le prochain rendu.
 */
export function useIdempotentIntent() {
  const intent = useRef<{ signature: string; key: string } | null>(null);
  const inFlight = useRef(false);

  const keyFor = useCallback((signature: string) => {
    if (!intent.current || intent.current.signature !== signature) {
      intent.current = { signature, key: newIdempotencyKey() };
    }
    return intent.current.key;
  }, []);

  const reset = useCallback(() => {
    intent.current = null;
  }, []);

  /**
   * Exécute `action` une seule fois à la fois. Renvoie `undefined` si un envoi
   * est déjà en cours.
   */
  const run = useCallback(async <T>(action: () => Promise<T>): Promise<T | undefined> => {
    if (inFlight.current) return undefined;
    inFlight.current = true;
    try {
      return await action();
    } finally {
      inFlight.current = false;
    }
  }, []);

  return { keyFor, reset, run };
}

/**
 * Erreur « transitoire » : la requête a pu ne pas arriver (réseau) ou le
 * serveur a flanché. On garde alors la même clé pour le nouvel essai.
 */
export function isRetryableError(error: unknown): boolean {
  if (!(error instanceof ApiError)) return true;
  return error.status >= 500 || error.status === 408 || error.status === 429;
}

/** Message lisible pour une erreur d'API (validation Laravel comprise). */
export function errorMessage(error: unknown, fallback: string): string {
  if (error instanceof ApiError) {
    const errors = error.data.errors;
    if (errors && typeof errors === "object") {
      const first = Object.values(errors as Record<string, unknown>)[0];
      if (Array.isArray(first) && typeof first[0] === "string") return first[0];
    }
    return error.message || fallback;
  }
  if (error instanceof TypeError) {
    return "Connexion impossible. Vérifiez votre réseau puis réessayez.";
  }
  return error instanceof Error && error.message ? error.message : fallback;
}
