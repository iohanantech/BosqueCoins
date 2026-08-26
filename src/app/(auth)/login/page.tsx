"use client";

import { signIn } from "next-auth/react";
import { useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { CoinIcon } from "@/components/ui/coin-icon";
import { Button } from "@/components/ui/button";
import { AUTH_ERROR_CODES } from "@/lib/auth/options";

const MENSAGENS_ERRO: Record<string, string> = {
  [AUTH_ERROR_CODES.DOMINIO_INVALIDO]: "Use seu e-mail institucional do colégio (@bosquemananciais.org.br).",
  [AUTH_ERROR_CODES.CONTA_NAO_CADASTRADA]: "Conta não cadastrada, procure a coordenação.",
  [AUTH_ERROR_CODES.CONTA_INATIVA]: "Sua conta está inativa. Procure a coordenação.",
  Configuration: "Erro de configuração do login. Tente novamente mais tarde.",
};

function LoginContent() {
  const params = useSearchParams();
  const erro = params.get("error");

  return (
    <div className="flex min-h-dvh flex-col items-center justify-center bg-gradient-to-b from-neutral-50 to-neutral-100 px-6 dark:from-graphite dark:to-graphite-soft">
      <div className="w-full max-w-sm text-center">
        <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-gold-gradient shadow-lg">
          <CoinIcon className="h-11 w-11" />
        </div>
        <h1 className="font-display text-2xl font-bold">BosqueCoins</h1>
        <p className="mt-1 text-sm text-neutral-500 dark:text-neutral-400">
          Gamificação escolar do Colégio Bosque dos Mananciais
        </p>

        {erro && (
          <div className="mt-6 rounded-xl2 border border-red-200 bg-red-50 p-3 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300">
            {MENSAGENS_ERRO[erro] ?? "Não foi possível entrar. Tente novamente."}
          </div>
        )}

        <Button
          size="lg"
          className="mt-8 w-full"
          onClick={() => signIn("google", { callbackUrl: "/dashboard" })}
        >
          Entrar com Google
        </Button>
        <p className="mt-4 text-xs text-neutral-400">
          Acesso restrito a e-mails @bosquemananciais.org.br já cadastrados pela coordenação.
        </p>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginContent />
    </Suspense>
  );
}
