/**
 * Indicatifs téléphoniques et validation des numéros, pour tous les pays.
 *
 * Choix technique (le moins coûteux et le plus fiable) :
 * - `libphonenumber-js/min` : indicatifs, validation et mise en forme pour
 *   245 pays, sans appel réseau, sans clé ni abonnement (≈ 75 ko de données).
 * - Noms français / anglais : réutilise `lib/countries` (i18n-iso-countries),
 *   déjà utilisé par le sélecteur « Pays de résidence ».
 * - Drapeaux : flagcdn, comme le reste du site.
 * Une API en ligne (REST Countries…) aurait ajouté une dépendance réseau et un
 * risque de panne sur le formulaire d'inscription, pour des données qui ne
 * changent presque jamais.
 */
import {
  getCountries,
  getCountryCallingCode,
  isValidPhoneNumber,
  parsePhoneNumberFromString,
  type CountryCode
} from "libphonenumber-js/min";
import { getCountry, normalizeCountryQuery } from "@/lib/countries";

export type DialCountry = {
  /** Code ISO 3166-1 alpha-2 (ex. « BJ »). */
  code: CountryCode;
  /** Indicatif avec le « + » (ex. « +229 »). */
  dial: string;
  /** Nom français. */
  name: string;
  /** Texte normalisé pour la recherche : noms FR/EN, code ISO, indicatif. */
  search: string;
};

export const DEFAULT_DIAL_COUNTRY: CountryCode = "BJ";

/** Pays proposés en premier : la clientèle habituelle du Manoir. */
export const SUGGESTED_DIAL_COUNTRIES: CountryCode[] = ["BJ", "TG", "NG", "CI", "FR", "SN", "BF", "GH"];

/**
 * Indicatifs dont le code n'est pas un code ISO 3166-1 officiel, donc absents
 * de la liste « Pays de résidence » : on les nomme ici.
 * - AC, TA : territoires de Sainte-Hélène (+247, +290) ;
 * - XK : Kosovo (+383), code d'usage courant exclu de la liste ISO.
 */
const EXTRA_NAMES: Partial<Record<CountryCode, { name: string; nameEn: string }>> = {
  AC: { name: "Île de l'Ascension", nameEn: "Ascension Island" },
  TA: { name: "Tristan da Cunha", nameEn: "Tristan da Cunha" },
  XK: { name: "Kosovo", nameEn: "Kosovo" }
};

export const DIAL_COUNTRIES: DialCountry[] = getCountries()
  .map((code) => {
    const country = getCountry(code) ?? EXTRA_NAMES[code];
    const dial = `+${getCountryCallingCode(code)}`;
    const name = country?.name || code;
    return {
      code,
      dial,
      name,
      search: normalizeCountryQuery(`${name} ${country?.nameEn || ""} ${code} ${dial} ${dial.slice(1)}`)
    };
  })
  .sort((a, b) => a.name.localeCompare(b.name, "fr"));

const BY_CODE = new Map(DIAL_COUNTRIES.map((country) => [country.code, country]));

export function getDialCountry(code?: string | null): DialCountry | undefined {
  return code ? BY_CODE.get(code.toUpperCase() as CountryCode) : undefined;
}

export function isDialCountry(code?: string | null): code is CountryCode {
  return Boolean(getDialCountry(code));
}

/**
 * Recherche par nom (FR ou EN, sans accents), code ISO ou indicatif :
 * « benin », « BJ », « +229 » et « 229 » trouvent tous le Bénin.
 */
export function filterDialCountries(query: string): DialCountry[] {
  const normalized = normalizeCountryQuery(query);
  if (!normalized) return DIAL_COUNTRIES;
  return DIAL_COUNTRIES.filter((country) => country.search.includes(normalized));
}

/**
 * Bénin : depuis fin 2024, les numéros comptent 10 chiffres. Les anciens
 * numéros à 8 chiffres prennent « 01 » devant. On applique cette règle
 * officielle au lieu de refuser un numéro que le client connaît par cœur.
 */
function migrateLegacyNumber(national: string, country: CountryCode) {
  const digits = national.replace(/\D/g, "");
  if (country === "BJ" && digits.length === 8) return `01${digits}`;
  return national;
}

export type PhoneCheck =
  | { valid: true; international: string }
  | { valid: false; message: string };

/**
 * Valide un numéro saisi pour un pays et le renvoie au format international
 * lisible (ex. « +229 01 97 00 00 00 »), prêt à être enregistré.
 */
export function checkPhone(input: string, country: CountryCode): PhoneCheck {
  const raw = input.trim();
  const dialCountry = getDialCountry(country);
  // « (Bénin, +229) » évite d'avoir à accorder l'article de chaque pays.
  const countryLabel = dialCountry ? `${dialCountry.name}, ${dialCountry.dial}` : country;

  if (!raw) return { valid: false, message: "Saisissez votre numéro de téléphone." };

  // Numéro collé avec son indicatif (« +33 6… ») : le préfixe fait foi.
  const candidate = raw.startsWith("+") ? raw : migrateLegacyNumber(raw, country);
  const parsed = raw.startsWith("+")
    ? parsePhoneNumberFromString(candidate)
    : parsePhoneNumberFromString(candidate, country);

  if (!parsed || !(raw.startsWith("+") ? parsed.isValid() : isValidPhoneNumber(candidate, country))) {
    return {
      valid: false,
      message: raw.startsWith("+")
        ? "Ce numéro ne semble pas valide pour l'indicatif saisi. Vérifiez-le."
        : `Ce numéro ne semble pas valide (${countryLabel}). Vérifiez-le.`
    };
  }

  return { valid: true, international: parsed.formatInternational() };
}

/**
 * Découpe un numéro enregistré (« +229 01 97 00 00 00 ») en pays + partie
 * nationale, pour pré-remplir un formulaire.
 */
export function splitStoredPhone(
  phone?: string | null,
  fallback: CountryCode = DEFAULT_DIAL_COUNTRY
): { country: CountryCode; national: string } {
  const value = (phone || "").trim();
  if (!value) return { country: fallback, national: "" };

  const parsed = parsePhoneNumberFromString(value);
  if (parsed?.country) {
    return { country: parsed.country, national: parsed.formatNational() };
  }

  // Indicatif reconnu mais pays ambigu (+1, +7…) ou numéro incomplet.
  const byDial = [...DIAL_COUNTRIES]
    .sort((a, b) => b.dial.length - a.dial.length)
    .find((country) => value.startsWith(country.dial));
  if (byDial) return { country: byDial.code, national: value.slice(byDial.dial.length).trim() };

  return { country: fallback, national: value };
}
