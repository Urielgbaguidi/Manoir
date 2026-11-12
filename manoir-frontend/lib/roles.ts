import type { User } from "@/lib/api";

type RoleUser = Pick<User, "is_admin" | "is_super_admin"> | null | undefined;

/** Un super-administrateur possede toujours les droits d'un administrateur. */
export function isAdminUser(user: RoleUser): boolean {
  return Boolean(user?.is_admin || user?.is_super_admin);
}

/** Espace d'accueil selon le role. */
export function homePathFor(user: RoleUser): "/admin" | "/espace-client" {
  return isAdminUser(user) ? "/admin" : "/espace-client";
}

/**
 * Destination de connexion sans croisement admin/client.
 * Un administrateur ne peut atterrir que dans `/admin`, un client jamais dans
 * `/admin`.
 */
export function roleSafeRedirect(user: RoleUser, redirectTo?: string | null): string {
  const home = homePathFor(user);

  if (
    !redirectTo ||
    redirectTo === "/" ||
    !redirectTo.startsWith("/") ||
    redirectTo.startsWith("//")
  ) {
    return home;
  }

  if (isAdminUser(user)) {
    return redirectTo.startsWith("/admin") ? redirectTo : home;
  }

  return redirectTo.startsWith("/admin") ? home : redirectTo;
}
