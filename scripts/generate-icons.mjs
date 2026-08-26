#!/usr/bin/env node
/**
 * Gera public/icons/icon-192.png e icon-512.png a partir do mesmo SVG usado
 * em src/components/ui/coin-icon.tsx (mesmo gradiente dourado, mesmo "B"),
 * para o icone do PWA ser visualmente identico ao icone usado dentro do app
 * (secao 10 - identidade visual). Rode com: node scripts/generate-icons.mjs
 */
import sharp from "sharp";
import { mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const outDir = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "public", "icons");
mkdirSync(outDir, { recursive: true });

function coinSvg(tamanho) {
  return `<svg width="${tamanho}" height="${tamanho}" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
    <rect width="24" height="24" rx="5" fill="#FFFFFF"/>
    <circle cx="12" cy="12" r="10.5" fill="url(#coin-gradient)" stroke="#A8842A" stroke-width="1"/>
    <text x="12" y="16.2" text-anchor="middle" font-family="Arial, sans-serif" font-size="12" font-weight="700" fill="#5A4310">B</text>
    <defs>
      <linearGradient id="coin-gradient" x1="0" y1="0" x2="24" y2="24" gradientUnits="userSpaceOnUse">
        <stop stop-color="#E8CC6E"/>
        <stop offset="1" stop-color="#C98A2C"/>
      </linearGradient>
    </defs>
  </svg>`;
}

for (const tamanho of [192, 512]) {
  const arquivo = path.join(outDir, `icon-${tamanho}.png`);
  await sharp(Buffer.from(coinSvg(tamanho)))
    .resize(tamanho, tamanho)
    .png()
    .toFile(arquivo);
  console.log(`Gerado ${arquivo}`);
}
