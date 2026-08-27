import Image from "next/image";
import { cn } from "@/lib/utils";

/**
 * Icone da moeda BosqueCoins (secao 10), usado em toda a interface. E o MESMO
 * simbolo do favicon / icone do PWA (public/icons/icon-192.png) - manter os
 * dois em sincronia: trocar o PNG troca a moeda em todo lugar.
 * O drop-shadow leve mantem o simbolo legivel tambem sobre os cards de saldo
 * (fundo verde), ja que o PNG tem fundo transparente.
 */
export function CoinIcon({ className }: { className?: string }) {
  return (
    <Image
      src="/icons/icon-192.png"
      alt=""
      width={20}
      height={20}
      aria-hidden="true"
      className={cn("inline-block h-5 w-5 object-contain drop-shadow-[0_1px_1.5px_rgba(0,0,0,0.25)]", className)}
    />
  );
}
