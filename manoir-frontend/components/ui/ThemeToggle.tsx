"use client";

import { Moon, Sun } from "lucide-react";
import { useEffect, useState } from "react";

type Theme = "dark" | "light";

/**
 * Bascule clair / sombre. Écrit `data-theme` sur <html> et persiste dans
 * localStorage. Le thème initial est aussi posé par un script inline dans
 * le <head> (voir app/layout.tsx) pour éviter le flash au chargement.
 */
export default function ThemeToggle() {
  const [theme, setTheme] = useState<Theme>("dark");
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    const current = (document.documentElement.getAttribute("data-theme") as Theme) || "dark";
    setTheme(current);
  }, []);

  const toggle = () => {
    const next: Theme = theme === "dark" ? "light" : "dark";
    setTheme(next);
    document.documentElement.setAttribute("data-theme", next);
    try {
      localStorage.setItem("theme", next);
    } catch {
      /* stockage indisponible : on ignore */
    }
  };

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={theme === "dark" ? "Passer au thème clair" : "Passer au thème sombre"}
      title={theme === "dark" ? "Thème clair" : "Thème sombre"}
      className="grid size-10 place-items-center rounded-full border border-gold/25 bg-white/5 text-cream backdrop-blur-md transition hover:border-gold/60 hover:bg-gold/15"
    >
      {mounted && theme === "light" ? <Moon size={17} /> : <Sun size={17} />}
    </button>
  );
}
