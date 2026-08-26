"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { Card } from "@/components/ui/card";
import { CoinIcon } from "@/components/ui/coin-icon";
import { RankingTurmas, type TurmaRankingItem } from "@/components/dashboard/ranking-turmas";
import { RankingCasas, type CasaRankingItem } from "@/components/dashboard/ranking-casas";
import Link from "next/link";

interface AnoLetivo {
  id: string;
  nome: string;
  ativo: boolean;
  encerrado: boolean;
}

interface ContextoAluno {
  saldoPessoalAtual: number;
  saldoPessoalAcumulado: number;
  turma: string | null;
  posicaoTurma: number | null;
  posicaoCasa: number | null;
}

interface RankingsResponse {
  anoLetivo: AnoLetivo;
  turmas: TurmaRankingItem[];
  casas: CasaRankingItem[];
  contextoAluno: ContextoAluno | null;
  anosLetivos: AnoLetivo[];
}

export default function DashboardPage() {
  const { data: session } = useSession();
  const [dados, setDados] = useState<RankingsResponse | null>(null);
  const [anoSelecionado, setAnoSelecionado] = useState<string>("");
  const [modoTurmas, setModoTurmas] = useState<"total" | "media">("total");
  const [carregando, setCarregando] = useState(true);

  async function carregar(anoLetivoId?: string) {
    setCarregando(true);
    const params = new URLSearchParams();
    if (anoLetivoId) params.set("anoLetivoId", anoLetivoId);
    params.set("modoTurmas", modoTurmas);
    const res = await fetch(`/api/dashboard/rankings?${params.toString()}`);
    if (res.ok) {
      const json: RankingsResponse = await res.json();
      setDados(json);
      setAnoSelecionado(json.anoLetivo.id);
    }
    setCarregando(false);
  }

  useEffect(() => {
    carregar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [modoTurmas]);

  const papel = session?.user?.papel;

  return (
    <div className="space-y-4">
      {/* Seletor de ano letivo (secao 4.1, item 4) - nao afeta o saldo pessoal do aluno */}
      {dados && dados.anosLetivos.length > 1 && (
        <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pb-1">
          {dados.anosLetivos.map((ano) => (
            <button
              key={ano.id}
              onClick={() => {
                setAnoSelecionado(ano.id);
                carregar(ano.id);
              }}
              className={`shrink-0 rounded-full border px-3 py-1.5 text-xs font-medium ${
                anoSelecionado === ano.id
                  ? "border-gold bg-gold/10 text-gold-dark"
                  : "border-neutral-200 text-neutral-500 dark:border-neutral-700"
              }`}
            >
              {ano.nome} {ano.encerrado ? "(encerrado)" : ""}
            </button>
          ))}
        </div>
      )}

      {/* Contexto pessoal (secao 4.1, item 3) */}
      {papel === "aluno" && dados?.contextoAluno && (
        <Card className="bg-gold-gradient text-graphite">
          <p className="text-xs font-medium opacity-80">Seu saldo (vitalício)</p>
          <p className="mt-1 flex items-center gap-2 text-3xl font-bold" data-testid="saldo-pessoal-atual">
            <CoinIcon className="h-7 w-7" />
            {dados.contextoAluno.saldoPessoalAtual}
          </p>
          <p className="mt-0.5 text-xs opacity-80">Acumulado total: {dados.contextoAluno.saldoPessoalAcumulado}</p>
          <div className="mt-3 flex gap-4 text-xs">
            {dados.contextoAluno.turma && (
              <span>
                {dados.contextoAluno.turma} · #{dados.contextoAluno.posicaoTurma ?? "-"} nas Salas
              </span>
            )}
            {dados.contextoAluno.posicaoCasa && <span>#{dados.contextoAluno.posicaoCasa} na Copa das Casas</span>}
          </div>
        </Card>
      )}

      {(papel === "professor" || papel === "admin") && (
        <Link href="/pontuar">
          <Card className="flex items-center justify-between bg-gold-gradient text-graphite">
            <div>
              <p className="font-display font-semibold">Dar BosqueCoins</p>
              <p className="text-xs opacity-80">Pontuar alunos ou a turma toda</p>
            </div>
            <CoinIcon className="h-8 w-8" />
          </Card>
        </Link>
      )}

      {carregando && !dados ? (
        <p className="py-10 text-center text-sm text-neutral-400">Carregando rankings…</p>
      ) : dados ? (
        <>
          <RankingTurmas dados={dados.turmas} modo={modoTurmas} onModoChange={setModoTurmas} />
          <RankingCasas dados={dados.casas} />
        </>
      ) : null}
    </div>
  );
}
