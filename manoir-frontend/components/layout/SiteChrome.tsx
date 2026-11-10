"use client";

import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

/**
 * Pages qui possèdent leur propre en-tête : les tableaux de bord (client et
 * administrateur) et les écrans de connexion / inscription plein écran.
 * La navbar et le footer du site vitrine y sont masqués.
 */
const STANDALONE_PREFIXES = ["/espace-client", "/admin", "/auth/login", "/auth/register"];

export function isStandalonePath(pathname: string | null): boolean {
  if (!pathname) return false;
  return STANDALONE_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`)
  );
}

export default function SiteChrome({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  if (isStandalonePath(pathname)) return null;
  return <>{children}</>;
}
