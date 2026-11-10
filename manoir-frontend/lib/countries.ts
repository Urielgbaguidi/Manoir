import countries from "i18n-iso-countries";
import enLocale from "i18n-iso-countries/langs/en.json";
import frLocale from "i18n-iso-countries/langs/fr.json";

countries.registerLocale(frLocale);
countries.registerLocale(enLocale);

export type CountryOption = {
  /** Code ISO 3166-1 alpha-2, en majuscules. */
  code: string;
  /** Nom affiché, en français. */
  name: string;
  /** Nom anglais, utilisé uniquement pour la recherche. */
  nameEn: string;
  /** Texte normalisé (français + anglais + code) pour la recherche. */
  search: string;
};

/**
 * Normalise une chaîne pour une recherche insensible aux accents, à la casse
 * et à la ponctuation. « Côte d'Ivoire » et « cote d ivoire » se rejoignent.
 */
export function normalizeCountryQuery(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

const frenchNames = countries.getNames("fr");
const englishNames = countries.getNames("en");

/**
 * `i18n-iso-countries` expose 250 entrées : les 249 codes ISO 3166-1
 * officiellement attribués, plus `XK` (Kosovo), qui est un code
 * d'usage privé et non un code ISO 3166-1. On l'écarte pour rester
 * strictement conforme à la norme, sans retirer aucun pays ni territoire.
 */
export const COUNTRIES: CountryOption[] = Object.entries(frenchNames)
  .filter(([code]) => code !== "XK")
  .map(([code, name]) => {
    const nameEn = englishNames[code] || name;

    return {
      code,
      name,
      nameEn,
      search: normalizeCountryQuery(`${name} ${nameEn} ${code}`)
    };
  })
  .sort((a, b) => a.name.localeCompare(b.name, "fr"));

export const COUNTRY_BY_CODE = new Map(COUNTRIES.map((country) => [country.code, country]));

/** Filtre instantané par nom français, nom anglais ou code ISO. */
export function filterCountries(query: string) {
  const normalizedQuery = normalizeCountryQuery(query);
  if (!normalizedQuery) return COUNTRIES;

  return COUNTRIES.filter((country) => country.search.includes(normalizedQuery));
}

export function getCountry(code: string) {
  return COUNTRY_BY_CODE.get(code.toUpperCase());
}
