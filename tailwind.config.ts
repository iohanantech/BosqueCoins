import type { Config } from "tailwindcss";

// Design tokens per ESPECIFICACAO.md secao 10:
// - Base neutra (branco / cinza-claro, modo escuro em grafite)
// - Dourado reservado para destaques (nao usar em grandes areas de fundo)
// - 4 cores das Casas sao aproximacoes documentadas na secao 12.1 do CLAUDE.md
const config: Config = {
  darkMode: "class",
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        gold: {
          DEFAULT: "#D4AF37",
          light: "#E8CC6E",
          dark: "#A8842A",
        },
        amber: {
          accent: "#C98A2C",
        },
        graphite: {
          DEFAULT: "#1C1C1E",
          soft: "#2C2C2E",
        },
        // Cores oficiais das 4 Casas (aproximacoes - ver CLAUDE.md secao "Pressupostos")
        casa: {
          camapua: { primary: "#B8860B", secondary: "#8B0000" }, // amarelo escuro / vermelho escuro
          caratuva: { primary: "#0B3D91", secondary: "#00B7C3" }, // azul escuro / ciano
          marumbi: { primary: "#F5E050", secondary: "#111111" }, // amarelo claro / preto
          morrodocal: { primary: "#14532D", secondary: "#4ADE80" }, // verde escuro / verde claro
        },
      },
      fontFamily: {
        sans: ["var(--font-inter)", "system-ui", "sans-serif"],
        display: ["var(--font-poppins)", "system-ui", "sans-serif"],
      },
      backgroundImage: {
        "gold-gradient": "linear-gradient(135deg, #E8CC6E 0%, #D4AF37 45%, #C98A2C 100%)",
      },
      borderRadius: {
        xl2: "1.25rem",
      },
    },
  },
  plugins: [],
};

export default config;
