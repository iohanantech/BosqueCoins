"use client";

import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { CoinIcon } from "@/components/ui/coin-icon";
import { cn } from "@/lib/utils";

export interface TurmaRankingItem {
  turmaId: string;
  nome: string;
  saldoAtual: number;
  saldoAcumulado: number;
  quantidadeAlunos: number;
  valorOrdenacao: number;
}

/**
 * Ranking de Salas (secao 4.1): alterna entre Total e Média por aluno.
 * Mobile: atual em destaque, acumulado como texto secundário no mesmo card
 * (evita duplicar rolagem - secao 9).
 */
export function RankingTurmas({ dados, modo, onModoChange }: { dados: TurmaRankingItem[]; modo: "total" | "media"; onModoChange: (m: "total" | "media") => void }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>🏫 Ranking das Salas</CardTitle>
        <div className="flex rounded-full bg-neutral-100 p-0.5 text-xs font-medium dark:bg-graphite">
          {(["total", "media"] as const).map((m) => (
            <button
              key={m}
              onClick={() => onModoChange(m)}
              className={cn(
                "rounded-full px-3 py-1.5 transition",
                modo === m ? "bg-white text-neutral-900 shadow-sm dark:bg-graphite-soft dark:text-white" : "text-neutral-500"
              )}
            >
              {m === "total" ? "Total" : "Média"}
            </button>
          ))}
        </div>
      </CardHeader>

      <ul className="space-y-2">
        {dados.map((t, idx) => (
          <li key={t.turmaId} className="flex items-center justify-between rounded-xl2 bg-neutral-50 px-3 py-2.5 dark:bg-graphite">
            <div className="flex items-center gap-3">
              <span
                className={cn(
                  "flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold",
                  idx === 0 ? "bg-gold-gradient text-graphite" : "bg-neutral-200 text-neutral-600 dark:bg-graphite-soft dark:text-neutral-300"
                )}
              >
                {idx + 1}
              </span>
              <div>
                <p className="text-sm font-medium">{t.nome}</p>
                <p className="text-xs text-neutral-500 dark:text-neutral-400">{t.quantidadeAlunos} alunos</p>
              </div>
            </div>
            <div className="text-right">
              <p className="flex items-center justify-end gap-1 text-sm font-semibold">
                <CoinIcon className="h-3.5 w-3.5" />
                {modo === "media" ? t.valorOrdenacao.toFixed(1) : t.saldoAtual}
              </p>
              <p className="text-[11px] text-neutral-400">acumulado {t.saldoAcumulado}</p>
            </div>
          </li>
        ))}
        {dados.length === 0 && <p className="py-4 text-center text-sm text-neutral-400">Nenhuma turma neste ano letivo ainda.</p>}
      </ul>
    </Card>
  );
}
