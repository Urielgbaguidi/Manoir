import { cn } from "@/lib/utils";

type CountryFlagProps = {
  /** Code ISO 3166-1 alpha-2 (ou indicatif pays déjà normalisé). */
  code: string;
  className?: string;
};

/**
 * Territoires absents de flagcdn, servis depuis /public/flags :
 * - AC, île de l'Ascension (+247) : flag-icons (MIT) ;
 * - TA, Tristan da Cunha (+290) : Wikimedia Commons (domaine public).
 *   (Le drapeau « sh-ta » de flag-icons reprend par erreur l'écusson de
 *   Sainte-Hélène, d'où cette autre source.)
 */
const LOCAL_FLAGS = new Set(["ac", "ta"]);

/**
 * Drapeau image : rendu fiable sur tous les OS, contrairement aux emojis.
 * Même source que le sélecteur d'indicatif téléphonique existant.
 */
export default function CountryFlag({ code, className }: CountryFlagProps) {
  const iso = code.toLowerCase();
  const local = LOCAL_FLAGS.has(iso);
  const src = local ? `/flags/w40-${iso}.png` : `https://flagcdn.com/w40/${iso}.png`;
  const src2x = local ? `/flags/w80-${iso}.png` : `https://flagcdn.com/w80/${iso}.png`;

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      srcSet={`${src2x} 2x`}
      width={22}
      height={16}
      alt=""
      loading="lazy"
      decoding="async"
      className={cn(
        "h-4 w-[22px] shrink-0 rounded-[3px] object-cover ring-1 ring-black/15",
        className
      )}
    />
  );
}
