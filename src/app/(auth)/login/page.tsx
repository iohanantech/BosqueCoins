"use client";

import { signIn } from "next-auth/react";
import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { CoinIcon } from "@/components/ui/coin-icon";
import { Button } from "@/components/ui/button";
import { AUTH_ERROR_CODES } from "@/lib/auth/options";
import Image from "next/image";

const MENSAGENS_ERRO: Record<string, string> = {
  [AUTH_ERROR_CODES.DOMINIO_INVALIDO]: "Use seu e-mail institucional do colégio (@bosquemananciais.org.br).",
  [AUTH_ERROR_CODES.CONTA_NAO_CADASTRADA]: "Conta não cadastrada, procure a coordenação.",
  [AUTH_ERROR_CODES.CONTA_INATIVA]: "Sua conta está inativa. Procure a coordenação.",
  Configuration: "Erro de configuração do login. Tente novamente mais tarde.",
};

interface DevUsuario {
  id: string;
  nome: string;
  email: string;
  papel: "admin" | "professor" | "aluno";
}

/**
 * Seletor de login de desenvolvimento (Fase 2 do CONTINUACAO.md): so aparece
 * quando /api/dev/usuarios responde (provider "dev" habilitado no servidor).
 * Nunca deve aparecer em producao - ver DEV_AUTH_ENABLED em lib/auth/options.ts.
 */
function DevLoginPicker() {
  const [usuarios, setUsuarios] = useState<DevUsuario[] | null>(null);

  useEffect(() => {
    fetch("/api/dev/usuarios")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => setUsuarios(data?.usuarios ?? []))
      .catch(() => setUsuarios([]));
  }, []);

  if (!usuarios || usuarios.length === 0) return null;

  return (
    <div className="mt-6 w-full rounded-xl2 border border-amber-200 bg-amber-50 p-3 text-left dark:border-amber-900 dark:bg-amber-950/30">
      <p className="mb-2 text-xs font-semibold text-amber-800 dark:text-amber-300">
        Login de desenvolvimento (nunca disponível em produção)
      </p>
      <select
        className="w-full rounded-lg border border-amber-300 bg-white p-2 text-sm dark:border-amber-800 dark:bg-graphite"
        defaultValue=""
        onChange={(e) => {
          const email = e.target.value;
          if (email) signIn("dev", { email, callbackUrl: "/dashboard" });
        }}
      >
        <option value="" disabled>
          Escolha um usuário...
        </option>
        {usuarios.map((u) => (
          <option key={u.id} value={u.email}>
            {u.nome} — {u.papel} ({u.email})
          </option>
        ))}
      </select>
    </div>
  );
}

function LoginContent() {
  const params = useSearchParams();
  const erro = params.get("error");

  return (
    <div className="flex min-h-dvh flex-col items-center justify-center bg-gradient-to-b from-neutral-50 to-neutral-100 px-6 dark:from-graphite dark:to-graphite-soft">
      <div className="w-full max-w-sm text-center">
        <div className="mx-auto mb-6 flex h-24 w-24 items-center justify-center">
  <Image src="/logo.png" alt="BosqueCoins" width={96} height={96} className="h-full w-full object-contain" priority />
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

        <DevLoginPicker />
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
