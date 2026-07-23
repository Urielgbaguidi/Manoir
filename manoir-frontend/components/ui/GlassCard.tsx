import { cn } from "@/lib/utils";

type GlassVariant = "default" | "warm" | "dark" | "light";

type GlassCardProps = {
  children: React.ReactNode;
  className?: string;
  variant?: GlassVariant;
  hover?: boolean;
  sheen?: boolean;
  edge?: boolean;
};

const variantClass: Record<GlassVariant, string> = {
  default: "glass",
  warm: "glass-warm",
  dark: "glass-dark",
  light: "glass-light"
};

/**
 * Carte "liquid glass" réutilisable : matériau translucide + arête spéculaire
 * + balayage de lumière au survol.
 */
export default function GlassCard({
  children,
  className,
  variant = "warm",
  hover = true,
  sheen = true,
  edge = true
}: GlassCardProps) {
  return (
    <div
      className={cn(
        "group relative overflow-hidden rounded-3xl",
        variantClass[variant],
        edge && "glass-edge",
        hover && "glass-hover",
        className
      )}
    >
      {sheen && <span className="sheen" />}
      <div className="relative z-[1]">{children}</div>
    </div>
  );
}
