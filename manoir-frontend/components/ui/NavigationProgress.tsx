"use client";

import { usePathname } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { surActiviteReseau } from "@/lib/api";

/** Au-dela, on considere l'action perdue et on rend la barre plutot que de la figer. */
const SECURITE_MS = 15_000;

/**
 * Delai laisse a un clic pour declencher un appel serveur.
 *
 * Un bouton qui ouvre seulement une fenetre ne parle jamais au serveur : sans
 * ce garde-fou, la barre resterait affichee pour rien.
 */
const ATTENTE_APPEL_MS = 400;

/**
 * Retour visuel d'activite, en haut de l'ecran.
 *
 * Repond a deux gestes que rien ne signalait :
 *
 *  - le clic sur un lien, ou l'ecran reste identique tant que la page suivante
 *    n'est pas prete ;
 *  - le clic sur un bouton — reserver, annuler, payer, supprimer — ou l'attente
 *    tient a l'appel serveur.
 *
 * Elle ne mesure rien : personne ne connait la duree a l'avance. Elle avance
 * franchement puis ralentit vers 90 %, et ne se remplit qu'a l'arrivee reelle.
 */
export default function NavigationProgress() {
  const pathname = usePathname();
  const [actif, setActif] = useState(false);
  const [progression, setProgression] = useState(0);

  const avancement = useRef<number | null>(null);
  const securite = useRef<number | null>(null);
  const masquage = useRef<number | null>(null);
  const guetteurAppel = useRef<number | null>(null);
  // Un clic attend un appel serveur : tant que ce drapeau est leve, la fin de
  // l'activite reseau doit rendre la main a la barre.
  const enAttente = useRef(false);

  const arreter = useCallback((reference: React.RefObject<number | null>) => {
    if (reference.current !== null) {
      window.clearTimeout(reference.current);
      window.clearInterval(reference.current);
      reference.current = null;
    }
  }, []);

  const terminer = useCallback(() => {
    enAttente.current = false;
    [avancement, securite, guetteurAppel].forEach(arreter);
    setProgression(100);

    arreter(masquage);
    masquage.current = window.setTimeout(() => {
      setActif(false);
      setProgression(0);
    }, 260);
  }, [arreter]);

  const demarrer = useCallback(() => {
    [avancement, securite, masquage, guetteurAppel].forEach(arreter);
    enAttente.current = true;
    setActif(true);
    setProgression(8);

    // Progression decroissante : franche au debut, de plus en plus lente,
    // sans jamais atteindre 100 % d'elle-meme.
    avancement.current = window.setInterval(() => {
      setProgression((courante) =>
        courante >= 90 ? courante : courante + Math.max(0.6, (90 - courante) / 12)
      );
    }, 180);

    securite.current = window.setTimeout(terminer, SECURITE_MS);
  }, [arreter, terminer]);

  // Fin d'une action : plus aucun appel en cours.
  useEffect(
    () =>
      surActiviteReseau((appelsEnCours) => {
        if (!enAttente.current) return;

        if (appelsEnCours > 0) {
          // L'appel est parti : on annule le renoncement programme au clic.
          arreter(guetteurAppel);

          return;
        }

        terminer();
      }),
    [arreter, terminer]
  );

  // Le changement d'adresse signe l'arrivee d'une navigation.
  useEffect(() => {
    if (enAttente.current) terminer();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname]);

  useEffect(() => {
    const auClic = (evenement: MouseEvent) => {
      // Clic droit, molette, ou combinaison qui ouvre un nouvel onglet : le
      // visiteur reste sur la page.
      if (
        evenement.defaultPrevented ||
        evenement.button !== 0 ||
        evenement.metaKey ||
        evenement.ctrlKey ||
        evenement.shiftKey ||
        evenement.altKey
      ) {
        return;
      }

      const cible = evenement.target as HTMLElement | null;
      const lien = cible?.closest?.("a");

      if (lien instanceof HTMLAnchorElement) {
        if (lien.target === "_blank" || lien.hasAttribute("download")) return;

        const href = lien.getAttribute("href");

        if (!href || href.startsWith("#")) return;

        const destination = new URL(lien.href, window.location.href);

        if (destination.origin !== window.location.origin) return;

        // Deja sur cette adresse : rien ne sera charge.
        if (
          destination.pathname === window.location.pathname &&
          destination.search === window.location.search
        ) {
          return;
        }

        demarrer();

        return;
      }

      const bouton = cible?.closest?.('button, [role="button"]');

      if (!(bouton instanceof HTMLElement) || bouton.hasAttribute("disabled")) return;

      demarrer();

      // Un bouton qui n'ouvre qu'une fenetre ne contacte pas le serveur : si
      // rien ne part, la barre se termine d'elle-meme.
      guetteurAppel.current = window.setTimeout(terminer, ATTENTE_APPEL_MS);
    };

    const auRetour = () => demarrer();

    document.addEventListener("click", auClic, true);
    window.addEventListener("popstate", auRetour);

    return () => {
      document.removeEventListener("click", auClic, true);
      window.removeEventListener("popstate", auRetour);
      [avancement, securite, masquage, guetteurAppel].forEach(arreter);
    };
  }, [demarrer, terminer, arreter]);

  if (!actif) return null;

  return (
    <div aria-hidden="true" className="pointer-events-none fixed inset-x-0 top-0 z-[200] h-[3px]">
      <div
        className="h-full bg-gradient-to-r from-gold-light via-gold to-olive-light transition-[width] duration-200 ease-out"
        style={{
          width: `${progression}%`,
          boxShadow: "0 0 10px rgba(196, 154, 74, 0.65)"
        }}
      />
    </div>
  );
}
