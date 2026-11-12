/**
 * Content Security Policy du site (export statique : pas de serveur Next pour
 * poser des en-têtes, elle est donc aussi émise en <meta>, et doublée par les
 * en-têtes de `public/.htaccess` sur l'hébergement).
 *
 * `'unsafe-inline'` reste nécessaire pour les scripts : l'export statique de
 * Next injecte des scripts en ligne et ne permet pas de nonce. La politique
 * limite en revanche toutes les ORIGINES : un script injecté ne peut ni
 * charger de code externe, ni envoyer de données ailleurs qu'à l'API.
 */
const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api";

function originOf(url: string): string {
  try {
    return new URL(url).origin;
  } catch {
    return "";
  }
}

const apiOrigin = originOf(API_URL);

export const CONTENT_SECURITY_POLICY = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline' https://accounts.google.com/gsi/client https://*.feexpay.me",
  "style-src 'self' 'unsafe-inline' https://accounts.google.com/gsi/style https://*.feexpay.me",
  `img-src 'self' data: blob: https://images.unsplash.com https://*.googleusercontent.com https://*.feexpay.me ${apiOrigin}`,
  `media-src 'self' blob: ${apiOrigin}`,
  "font-src 'self' data:",
  `connect-src 'self' ${apiOrigin} https://accounts.google.com/gsi/ https://*.feexpay.me`,
  "frame-src https://accounts.google.com/gsi/ https://*.feexpay.me",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self' https://*.feexpay.me"
]
  .map((directive) => directive.trim())
  .join("; ");
