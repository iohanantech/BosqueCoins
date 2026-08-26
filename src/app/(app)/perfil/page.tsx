"use client";

import { useSession, signOut } from "next-auth/react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CoinIcon } from "@/components/ui/coin-icon";

export default function PerfilPage() {
  const { data: session } = useSession();

  const papelLabel: Record<string, string> = {
    admin: "Administrador",
    professor: "Professor",
    aluno: "Aluno",
  };

  return (
    <div className="space-y-4">
      <h1 className="font-display text-lg font-semibold">Perfil</h1>
      <Card className="flex items-center gap-3">
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-gold-gradient">
          <CoinIcon className="h-7 w-7" />
        </div>
        <div>
          <p className="font-medium">{session?.user?.name}</p>
          <p className="text-xs text-neutral-500 dark:text-neutral-400">{session?.user?.email}</p>
          <p className="mt-1 text-xs font-medium text-gold-dark">{papelLabel[session?.user?.papel ?? ""] ?? ""}</p>
        </div>
      </Card>
      <Button variant="outline" className="w-full" onClick={() => signOut({ callbackUrl: "/login" })}>
        Sair da conta
      </Button>
    </div>
  );
}
