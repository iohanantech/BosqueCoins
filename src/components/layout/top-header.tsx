"use client";

import { CoinIcon } from "@/components/ui/coin-icon";
import { signOut } from "next-auth/react";
import { LogOut } from "lucide-react";

export function TopHeader({ nome, papel }: { nome: string; papel: string }) {
  const papelLabel: Record<string, string> = {
    admin: "Administrador",
    professor: "Professor",
    aluno: "Aluno",
  };

  return (
    <header className="sticky top-0 z-30 flex items-center justify-between border-b border-neutral-200 bg-white/95 px-4 py-3 backdrop-blur dark:border-neutral-800 dark:bg-graphite/95">
      <div className="flex items-center gap-2">
        <CoinIcon className="h-7 w-7" />
        <div>
          <p className="font-display text-sm font-semibold leading-tight">{nome}</p>
          <p className="text-xs text-neutral-500 dark:text-neutral-400">{papelLabel[papel] ?? papel}</p>
        </div>
      </div>
      <button
        onClick={() => signOut({ callbackUrl: "/login" })}
        className="flex h-9 w-9 items-center justify-center rounded-full text-neutral-500 hover:bg-neutral-100 dark:hover:bg-graphite-soft"
        aria-label="Sair"
      >
        <LogOut className="h-4 w-4" />
      </button>
    </header>
  );
}
