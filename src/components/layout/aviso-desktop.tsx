import { Monitor } from "lucide-react";

/** Aviso mobile para telas naturalmente desktop: importacao e encerramento de ano (secao 9). */
export function AvisoDesktop({ children }: { children: React.ReactNode }) {
  return (
    <div className="mb-4 flex items-start gap-2 rounded-xl2 border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800 sm:hidden dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-300">
      <Monitor className="mt-0.5 h-4 w-4 shrink-0" />
      <p>{children}</p>
    </div>
  );
}
