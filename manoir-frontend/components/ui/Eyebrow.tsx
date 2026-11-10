import { cn } from "@/lib/utils";

/**
 * Sur-titre éditorial : filet doré + petites capitales.
 * Remplace les anciennes pastilles à étoile (icône « sparkles »).
 * `centered` ajoute un filet de chaque côté pour les titres centrés.
 */
export default function Eyebrow({
  children,
  centered = false,
  className
}: {
  children: React.ReactNode;
  centered?: boolean;
  className?: string;
}) {
  return (
    <p className={cn("eyebrow inline-flex items-center gap-3", className)}>
      <span aria-hidden className="h-px w-8 bg-current opacity-60" />
      <span>{children}</span>
      {centered && <span aria-hidden className="h-px w-8 bg-current opacity-60" />}
    </p>
  );
}
