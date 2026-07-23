import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./lib/**/*.{js,ts,jsx,tsx,mdx}"
  ],
  theme: {
    extend: {
      colors: {
        // Palette macaron Le Manoir (clair / accents)
        cream: "#F5F0E6",
        "cream-dark": "#EBE5D5",
        bark: "#3D2817",
        "bark-light": "#5C3D2E",
        olive: "#6B7B3E",
        "olive-light": "#8A9E52",
        terracotta: "#8B5A2B",
        "terracotta-light": "#A67C52",
        sand: "#D4C4A8",
        charcoal: "#2C2C2C",
        // Palette nuit chaude & crémeuse (thème sombre cinématique)
        night: "#1A1308",
        "night-800": "#241A0E",
        "night-700": "#312410",
        espresso: "#3C2C15",
        gold: "#C9A45C",
        "gold-light": "#E4C888"
      },
      fontFamily: {
        body: ["var(--font-body)", "Inter", "system-ui", "sans-serif"],
        display: ["var(--font-display)", "Bricolage Grotesque", "sans-serif"],
        mono: ["var(--font-mono)", "ui-monospace", "monospace"]
      },
      borderRadius: {
        DEFAULT: "8px"
      },
      backdropBlur: {
        xs: "2px"
      },
      boxShadow: {
        glass:
          "0 8px 32px rgba(0,0,0,0.35), inset 0 1px 0 rgba(255,255,255,0.22), inset 0 -1px 0 rgba(0,0,0,0.18)",
        "glass-lg":
          "0 24px 70px -18px rgba(0,0,0,0.6), inset 0 1px 0 rgba(255,255,255,0.28), inset 0 -1px 0 rgba(0,0,0,0.22)",
        glow: "0 0 60px -12px rgba(201,164,92,0.45)"
      },
      keyframes: {
        marquee: {
          "0%": { transform: "translateX(0)" },
          "100%": { transform: "translateX(-50%)" }
        },
        grain: {
          "0%, 100%": { transform: "translate(0, 0)" },
          "25%": { transform: "translate(-2%, 1%)" },
          "50%": { transform: "translate(1%, -2%)" },
          "75%": { transform: "translate(2%, 2%)" }
        },
        float: {
          "0%, 100%": { transform: "translateY(0)" },
          "50%": { transform: "translateY(-26px)" }
        },
        "float-slow": {
          "0%, 100%": { transform: "translate(0,0)" },
          "33%": { transform: "translate(3%, -4%)" },
          "66%": { transform: "translate(-3%, 3%)" }
        },
        aurora: {
          "0%, 100%": { transform: "translate(0, 0)" },
          "50%": { transform: "translate(2%, -3%)" }
        },
        sheen: {
          "0%": { transform: "translateX(-120%) skewX(-18deg)" },
          "60%, 100%": { transform: "translateX(220%) skewX(-18deg)" }
        },
        shimmer: {
          "0%": { backgroundPosition: "-200% 0" },
          "100%": { backgroundPosition: "200% 0" }
        },
        "fade-up": {
          "0%": { opacity: "0", transform: "translateY(24px)" },
          "100%": { opacity: "1", transform: "translateY(0)" }
        },
        "spin-slow": {
          to: { transform: "rotate(360deg)" }
        }
      },
      animation: {
        marquee: "marquee 26s linear infinite",
        grain: "grain 8s steps(6) infinite",
        float: "float 9s ease-in-out infinite",
        "float-slow": "float-slow 22s ease-in-out infinite",
        aurora: "aurora 26s ease-in-out infinite",
        sheen: "sheen 6s ease-in-out infinite",
        shimmer: "shimmer 2.4s linear infinite",
        "fade-up": "fade-up 0.9s cubic-bezier(0.22,1,0.36,1) both",
        "spin-slow": "spin-slow 40s linear infinite"
      }
    }
  },
  plugins: []
};

export default config;
