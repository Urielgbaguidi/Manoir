type BotanicalLeafProps = {
  className?: string;
  variant?: "olive" | "palm";
  style?: React.CSSProperties;
};

/**
 * Feuillage vectoriel inspiré du logo Le Manoir (feuilles d'olivier / palmes).
 * Purement décoratif — utilisé en filigrane animé dans les arrière-plans.
 */
export default function BotanicalLeaf({ className, variant = "olive", style }: BotanicalLeafProps) {
  if (variant === "palm") {
    return (
      <svg viewBox="0 0 120 120" fill="none" aria-hidden="true" className={className} style={style}>
        <g stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" opacity="0.9">
          <path d="M60 118 C60 90 60 60 60 30" />
          {[-52, -34, -16, 16, 34, 52].map((dx, i) => (
            <path
              key={i}
              d={`M60 ${30 + Math.abs(dx) * 0.35} C${60 + dx * 0.5} ${
                18 + Math.abs(dx) * 0.15
              } ${60 + dx} 8 ${60 + dx * 1.15} 2`}
            />
          ))}
        </g>
      </svg>
    );
  }

  return (
    <svg viewBox="0 0 64 96" fill="none" aria-hidden="true" className={className} style={style}>
      <path
        d="M32 2 C13 20, 11 56, 32 94 C53 56, 51 20, 32 2 Z"
        fill="currentColor"
        fillOpacity="0.16"
      />
      <path
        d="M32 2 C13 20, 11 56, 32 94 C53 56, 51 20, 32 2 Z"
        stroke="currentColor"
        strokeWidth="1.3"
        strokeOpacity="0.85"
      />
      <path d="M32 8 L32 88" stroke="currentColor" strokeWidth="1.1" strokeOpacity="0.7" />
      <g stroke="currentColor" strokeWidth="0.9" strokeOpacity="0.55">
        <path d="M32 26 C25 30 21 34 18 42" />
        <path d="M32 26 C39 30 43 34 46 42" />
        <path d="M32 46 C25 50 21 54 18 62" />
        <path d="M32 46 C39 50 43 54 46 62" />
      </g>
    </svg>
  );
}
