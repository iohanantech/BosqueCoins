icon-192.png / icon-512.png sao o logotipo do BosqueCoins, fornecido pelo
colegio (imagem, nao gerada por codigo). Sao usados em 3 lugares:
  - favicon da aba (src/app/layout.tsx -> metadata.icons)
  - icone do PWA (public/manifest.json)
  - o icone da MOEDA em toda a interface (src/components/ui/coin-icon.tsx
    aponta pra /icons/icon-192.png)

Trocar esses PNGs troca a moeda em todo lugar - mantenha 192x192 e 512x512.

NAO rode `npm run icons:generate` (scripts/generate-icons.mjs): ele
regenera a partir de um SVG antigo (o "B" dentro de um circulo) e
sobrescreveria o logotipo atual.
