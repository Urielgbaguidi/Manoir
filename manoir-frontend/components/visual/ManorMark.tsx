type ManorMarkProps = {
  className?: string;
  style?: React.CSSProperties;
};

/**
 * Silhouette line-art du manoir (façade + palmiers), inspirée du logo.
 * Utilisée en filigrane géant derrière certaines sections.
 */
export default function ManorMark({ className, style }: ManorMarkProps) {
  return (
    <svg
      viewBox="0 0 240 200"
      fill="none"
      aria-hidden="true"
      className={className}
      style={style}
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {/* Sol */}
      <path d="M18 176 H222" strokeOpacity="0.5" />

      {/* Corps central */}
      <path d="M84 60 H156 V176 H84 Z" />
      {/* Étages */}
      <path d="M84 92 H156" strokeOpacity="0.7" />
      <path d="M84 124 H156" strokeOpacity="0.7" />
      {/* Toit / parapet */}
      <path d="M80 60 H160 M88 60 V52 H152 V60" strokeOpacity="0.8" />

      {/* Fenêtres étage haut */}
      <path d="M96 70 H112 V86 H96 Z" strokeOpacity="0.6" />
      <path d="M128 70 H144 V86 H128 Z" strokeOpacity="0.6" />
      {/* Fenêtres étage milieu */}
      <path d="M96 102 H112 V118 H96 Z" strokeOpacity="0.6" />
      <path d="M128 102 H144 V118 H128 Z" strokeOpacity="0.6" />
      {/* Porte arquée */}
      <path d="M110 176 V140 Q120 130 130 140 V176" strokeOpacity="0.8" />

      {/* Aile gauche */}
      <path d="M60 84 H84 M60 84 V176 H84" strokeOpacity="0.75" />
      <path d="M66 100 H78 V116 H66 Z" strokeOpacity="0.5" />
      {/* Aile droite */}
      <path d="M156 84 H180 M180 84 V176" strokeOpacity="0.75" />
      <path d="M162 100 H174 V116 H162 Z" strokeOpacity="0.5" />

      {/* Palmier gauche */}
      <g strokeOpacity="0.7">
        <path d="M40 176 C40 150 40 128 40 112" />
        <path d="M40 112 C30 104 22 104 14 108" />
        <path d="M40 112 C32 100 26 96 20 92" />
        <path d="M40 112 C40 100 40 92 40 86" />
        <path d="M40 112 C48 100 54 96 60 92" />
        <path d="M40 112 C50 104 58 104 66 108" />
      </g>
      {/* Palmier droit */}
      <g strokeOpacity="0.7">
        <path d="M200 176 C200 150 200 128 200 112" />
        <path d="M200 112 C190 104 182 104 174 108" />
        <path d="M200 112 C192 100 186 96 180 92" />
        <path d="M200 112 C200 100 200 92 200 86" />
        <path d="M200 112 C208 100 214 96 220 92" />
        <path d="M200 112 C210 104 218 104 226 108" />
      </g>
    </svg>
  );
}
