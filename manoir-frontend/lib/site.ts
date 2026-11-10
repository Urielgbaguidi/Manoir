/**
 * Coordonnees publiques du Manoir, centralisees pour ne plus diverger d'une
 * page a l'autre. L'adresse peut etre surchargee par NEXT_PUBLIC_CONTACT_EMAIL.
 */
export const CONTACT_EMAIL = process.env.NEXT_PUBLIC_CONTACT_EMAIL || "contact@lemanoir.com";

/** Lien mailto: qui ouvre la messagerie du visiteur, sujet pre-rempli. */
export function contactMailto(subject = "Demande d'information | Le Manoir", body = ""): string {
  const params = new URLSearchParams();
  params.set("subject", subject);
  if (body) params.set("body", body);
  // URLSearchParams encode les espaces en "+", que certains clients mail
  // affichent tels quels : on les remplace par %20.
  return `mailto:${CONTACT_EMAIL}?${params.toString().replace(/\+/g, "%20")}`;
}

/** Initiales (2 lettres max) pour les avatars. */
export function initialsOf(name?: string | null): string {
  if (!name) return "LM";
  const parts = name.trim().split(/\s+/).filter(Boolean);
  const letters = parts.length > 1 ? parts[0][0] + parts[parts.length - 1][0] : parts[0].slice(0, 2);
  return letters.toUpperCase();
}
