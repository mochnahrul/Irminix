import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        canvas: "#F7F5F0", // Warm Alabaster Paper
        surface: {
          DEFAULT: "#FFFFFF", // Crisp Manuscript Card
          elevated: "#FDFCFA",
          subtle: "#EFECE5", // Recessed Stone Surface
        },
        border: {
          DEFAULT: "rgba(28, 35, 31, 0.09)",
          focus: "rgba(36, 106, 86, 0.35)",
          subtle: "rgba(28, 35, 31, 0.05)",
        },
        irminsul: {
          DEFAULT: "#246A56", // Calm Botanical Sage-Teal
          hover: "#1D5646",
          soft: "#EBF3F0",
          gold: "#9C7A3C", // Muted Brass / Archive Gold
          goldSoft: "#F7F1E3",
        },
        ink: {
          primary: "#1C231F", // Deep Botanical Charcoal
          secondary: "#5B655F", // Muted Sage Slate
          dim: "#8A948E",
        },
      },
      fontFamily: {
        serif: ["'Instrument Serif'", "Georgia", "serif"],
        heading: ["'Plus Jakarta Sans'", "sans-serif"],
        sans: ["'Inter'", "-apple-system", "sans-serif"],
        mono: ["'JetBrains Mono'", "monospace"],
      },
      borderRadius: {
        sm: "6px",
        md: "8px",
        DEFAULT: "12px",
        lg: "12px",
        xl: "16px",
        "2xl": "20px",
      },
      boxShadow: {
        card: "0 1px 3px rgba(28, 35, 31, 0.04), 0 6px 18px rgba(28, 35, 31, 0.03)",
        hover: "0 4px 14px rgba(28, 35, 31, 0.07)",
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
};

export default config;
