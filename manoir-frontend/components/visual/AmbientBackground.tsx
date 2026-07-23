import BotanicalLeaf from "./BotanicalLeaf";

/**
 * Arrière-plan ambiant global (fixe, derrière tout le contenu).
 * Dégradé + aurores + feuillages + grain. Sensible au thème via des classes
 * dédiées (.ambient-*) surchargées dans globals.css sous [data-theme="light"].
 * 100% CSS/SVG, aucun coût JS.
 */
export default function AmbientBackground() {
  return (
    <div
      aria-hidden="true"
      className="ambient pointer-events-none fixed inset-0 -z-10 overflow-hidden grain-layer"
    >
      {/* Base : dégradé (thème) */}
      <div className="ambient-base absolute inset-0" />

      {/* Aurores lumineuses */}
      <div className="ambient-aurora absolute -left-[10%] top-[6%] h-[52vh] w-[52vh] rounded-full bg-olive/20 blur-[120px]" />
      <div className="ambient-aurora absolute right-[-8%] top-[34%] h-[46vh] w-[46vh] rounded-full bg-terracotta/25 blur-[130px] [animation-delay:-6s]" />
      <div className="ambient-aurora absolute bottom-[-12%] left-[28%] h-[54vh] w-[54vh] rounded-full bg-gold/15 blur-[140px] [animation-delay:-11s]" />

      {/* Feuillages flottants (filigrane botanique) */}
      <BotanicalLeaf
        variant="olive"
        className="ambient-flora absolute left-[4%] top-[12%] w-24 rotate-[18deg] text-olive-light/10 md:w-40"
      />
      <BotanicalLeaf
        variant="olive"
        className="ambient-flora absolute right-[6%] top-[58%] w-28 -rotate-[24deg] text-olive/10 [animation-delay:-8s] md:w-48"
      />
      <BotanicalLeaf
        variant="palm"
        className="ambient-flora absolute bottom-[8%] left-[46%] w-28 rotate-[8deg] text-terracotta-light/10 [animation-delay:-14s] md:w-44"
      />

      {/* Voile de contraste bas + vignette (thème) */}
      <div className="ambient-veil absolute inset-x-0 bottom-0 h-1/3" />
      <div className="ambient-vignette absolute inset-0" />
    </div>
  );
}
