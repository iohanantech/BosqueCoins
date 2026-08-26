"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CoinIcon } from "@/components/ui/coin-icon";
import { formatarData } from "@/lib/utils";

interface TransacaoAluno {
  id: string;
  valor: number;
  motivo: string;
  tipo: string;
  criadoEm: string;
}

interface Lote {
  loteId: string;
  valor: number;
  motivo: string;
  criadoEm: string;
  quantidadeAlunos: number;
  destinoIds: string[];
}

export default function ExtratoPage() {
  const { data: session } = useSession();
  const [carregando, setCarregando] = useState(true);
  const [transacoesAluno, setTransacoesAluno] = useState<TransacaoAluno[] | null>(null);
  const [lotes, setLotes] = useState<Lote[] | null>(null);
  const [loteExpandido, setLoteExpandido] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/extrato")
      .then((r) => r.json())
      .then((data) => {
        if (data.transacoes) setTransacoesAluno(data.transacoes);
        if (data.lotes) setLotes(data.lotes);
      })
      .finally(() => setCarregando(false));
  }, []);

  const papel = session?.user?.papel;

  return (
    <div className="space-y-3">
      <h1 className="font-display text-lg font-semibold">Extrato</h1>

      {carregando && <p className="py-10 text-center text-sm text-neutral-400">Carregando…</p>}

      {/* Visao do ALUNO: uma linha por transacao, mesmo vinda de lote (secao 4.5) */}
      {papel === "aluno" && transacoesAluno && (
        <div className="space-y-2">
          {transacoesAluno.map((t) => (
            <Card key={t.id} className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium">{t.motivo}</p>
                <p className="text-xs text-neutral-400">{formatarData(t.criadoEm)}</p>
              </div>
              <span
                className={`flex items-center gap-1 text-sm font-semibold ${
                  t.tipo === "debito" ? "text-red-600" : "text-emerald-600"
                }`}
              >
                <CoinIcon className="h-4 w-4" />
                {t.tipo === "debito" ? "-" : "+"}
                {t.valor}
              </span>
            </Card>
          ))}
          {transacoesAluno.length === 0 && <p className="py-10 text-center text-sm text-neutral-400">Nenhum lançamento ainda.</p>}
        </div>
      )}

      {/* Visao PROFESSOR/PEC/ADMIN: agrupado por lote, expansivel (secao 4.5) */}
      {papel !== "aluno" && lotes && (
        <div className="space-y-2">
          {lotes.map((lote) => (
            <Card key={lote.loteId}>
              <button
                className="flex w-full items-center justify-between text-left"
                onClick={() => setLoteExpandido(loteExpandido === lote.loteId ? null : lote.loteId)}
              >
                <div>
                  <p className="text-sm font-medium">
                    {lote.valor} BosqueCoins para {lote.quantidadeAlunos} aluno{lote.quantidadeAlunos > 1 ? "s" : ""}
                  </p>
                  <p className="text-xs text-neutral-400">
                    {lote.motivo} · {formatarData(lote.criadoEm)}
                  </p>
                </div>
                <Badge variant="gold">{lote.quantidadeAlunos}</Badge>
              </button>
              {loteExpandido === lote.loteId && (
                <ul className="mt-3 space-y-1 border-t border-neutral-100 pt-2 text-xs text-neutral-500 dark:border-neutral-800">
                  {lote.destinoIds.map((id) => (
                    <li key={id} className="font-mono">
                      {id}
                    </li>
                  ))}
                </ul>
              )}
            </Card>
          ))}
          {lotes.length === 0 && <p className="py-10 text-center text-sm text-neutral-400">Nenhum lançamento ainda.</p>}
        </div>
      )}
    </div>
  );
}
