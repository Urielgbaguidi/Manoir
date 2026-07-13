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
        // Couleurs du macaron Le Manoir
        cream: "#F5F0E6",
        "cream-dark": "#EBE5D5",
        bark: "#3D2817",
        "bark-light": "#5C3D2E",
        olive: "#6B7B3E",
        "olive-light": "#8A9E52",
        terracotta: "#8B5A2B",
        "terracotta-light": "#A67C52",
        sand: "#D4C4A8",
        charcoal: "#2C2C2C"
      },
      fontFamily: {
        body: ["var(--font-body)", "Inter", "sans-serif"],
        display: ["var(--font-display)", "Cormorant Garamond", "serif"]
      },
      borderRadius: {
        DEFAULT: "8px"
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
        }
      },
      animation: {
        marquee: "marquee 26s linear infinite",
        grain: "grain 8s steps(6) infinite"
      }
    }
  },
  plugins: []
};

export default config;
