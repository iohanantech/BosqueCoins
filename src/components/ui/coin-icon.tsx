import { cn } from "@/lib/utils";

/** Icone de moeda consistente do BosqueCoins (secao 10), usado em toda a interface. */
export function CoinIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={cn("h-5 w-5", className)} aria-hidden="true">
      <circle cx="12" cy="12" r="10" fill="url(#coin-gradient)" stroke="#15803D" strokeWidth="1" />
      <text x="12" y="16" textAnchor="middle" fontSize="11" fontWeight="700" fill="#052e16">
        B
      </text>
      <defs>
        <linearGradient id="coin-gradient" x1="0" y1="0" x2="24" y2="24" gradientUnits="userSpaceOnUse">
          <stop stopColor="#4ADE80" />
          <stop offset="1" stopColor="#16A34A" />
        </linearGradient>
      </defs>
    </svg>
  );
}
