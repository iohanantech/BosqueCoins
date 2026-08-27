"use client";

import { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CoinIcon } from "@/components/ui/coin-icon";
import { AvisoDesktop } from "@/components/layout/aviso-desktop";
import { formatarData } from "@/lib/utils";

interface Aluno {
  id: string;
  nome: string;
  email: string;
}

interface ContextoAluno {
  saldoPessoalAtual: number;
  saldoPessoalAcumulado: number;
  turma: string | null;
  posicaoTurma: number | null;
  posicaoCasa: number | null;
}

interface Investimento {
  id: string;
  tipo: string;
  status: "ativo" | "resgatado";
  valorPrincipal: number;
  valorAtual: number;
  valorResgatado: number | null;
}

interface ResumoInvestimentos {
  totalReversivelAtivo: number;
  totalColetivoInvestido: number;
  totalDoado: number;
}

interface TransacaoAluno {
  id: string;
  valor: number;
  motivo: string;
  tipo: string;
  criadoEm: string;
}

interface ResgateAluno {
  id: string;
  status: "pendente" | "aprovado" | "recusado";
  valorDebitado: number;
  criadoEm: string;
  item: { nome: string };
}

const NOMES_TIPO: Record<string, string> = {
  casa: "Casa",
  turma: "Turma",
  cdb: "CDB",
  poupanca: "Poupança",
  fundo_imobiliario: "Fundo Imobiliário",
  tesouro_direto: "Tesouro Direto",
  dizimo: "Dízimo (Igreja)",
  lar_idoso: "Lar do Idoso",
};

/**
 * "Ver a visão do aluno" (pedido do admin) - somente leitura: mostra o que o
 * aluno selecionado veria no proprio dashboard/investir/extrato, sem
 * nenhum botao de acao (investir/resgatar/etc). Nao e um login como o
 * aluno - so consulta os mesmos dados via os endpoints existentes, que ja
 * aceitam ?alunoId= para admin (RN-08 preservada: so admin pode passar esse
 * parametro, o proprio aluno so ve os dados dele mesmo).
 */
export default function AdminVisaoAlunoPage() {
  const [alunos, setAlunos] = useState<Aluno[]>([]);
  const [alunoId, setAlunoId] = useState("");
  const [carregando, setCarregando] = useState(false);

  const [contexto, setContexto] = useState<ContextoAluno | null>(null);
  const [resumoInvest, setResumoInvest] = useState<ResumoInvestimentos | null>(null);
  const [investimentos, setInvestimentos] = useState<Investimento[]>([]);
  const [transacoes, setTransacoes] = useState<TransacaoAluno[]>([]);
  const [resgates, setResgates] = useState<ResgateAluno[]>([]);

  useEffect(() => {
    fetch("/api/usuarios?papel=aluno")
      .then((r) => r.json())
      .then(setAlunos);
  }, []);

  useEffect(() => {
    if (!alunoId) {
      setContexto(null);
      setResumoInvest(null);
      setInvestimentos([]);
      setTransacoes([]);
      setResgates([]);
      return;
    }
    setCarregando(true);
    Promise.all([
      fetch(`/api/dashboard/rankings?alunoId=${alunoId}`).then((r) => r.json()),
      fetch(`/api/investimentos?alunoId=${alunoId}&resumo=true`).then((r) => r.json()),
      fetch(`/api/investimentos?alunoId=${alunoId}`).then((r) => r.json()),
      fetch(`/api/extrato?alunoId=${alunoId}`).then((r) => r.json()),
    ]).then(([rankings, resumo, listaInvestimentos, extrato]) => {
      setContexto(rankings.contextoAluno ?? null);
      setResumoInvest(resumo);
      setInvestimentos(Array.isArray(listaInvestimentos) ? listaInvestimentos : []);
      setTransacoes(extrato.transacoes ?? []);
      setResgates(extrato.resgates ?? []);
      setCarregando(false);
    });
  }, [alunoId]);

  const alunoSelecionado = alunos.find((a) => a.id === alunoId);
  const ativos = investimentos.filter((i) => i.status === "ativo");
  const historico = investimentos.filter((i) => i.status === "resgatado");

  return (
    <div className="space-y-4">
      <h1 className="font-display text-lg font-semibold">Ver a visão do aluno</h1>
      <AvisoDesktop>Esta tela funciona melhor em um computador.</AvisoDesktop>
      <p className="text-xs text-neutral-500 dark:text-neutral-400">
        Somente leitura: mostra o que o aluno vê (saldo, investimentos, extrato), sem nenhuma ação em nome dele.
      </p>

      <Card>
        <label className="mb-1.5 block text-xs font-medium text-neutral-500">Escolha um aluno</label>
        <select
          className="h-11 w-full rounded-xl2 border border-neutral-300 bg-white px-3 text-sm dark:border-neutral-700 dark:bg-graphite-soft"
          value={alunoId}
          onChange={(e) => setAlunoId(e.target.value)}
        >
          <option value="">Selecione…</option>
          {alunos.map((a) => (
            <option key={a.id} value={a.id}>
              {a.nome} ({a.email})
            </option>
          ))}
        </select>
      </Card>

      {carregando && <p className="py-6 text-center text-sm text-neutral-400">Carregando…</p>}

      {!carregando && alunoSelecionado && (
        <>
          <Badge variant="warning">Visão de {alunoSelecionado.nome} — só leitura</Badge>

          {contexto && (
            <Card className="bg-gold-gradient text-white">
              <p className="text-xs font-medium opacity-80">Saldo (vitalício)</p>
              <p className="mt-1 flex items-center gap-2 text-3xl font-bold">
                <CoinIcon className="h-7 w-7" />
                {contexto.saldoPessoalAtual}
              </p>
              <p className="mt-0.5 text-xs opacity-80">Acumulado total: {contexto.saldoPessoalAcumulado}</p>
              <div className="mt-3 flex gap-4 text-xs">
                {contexto.turma && (
                  <span>
                    {contexto.turma} · #{contexto.posicaoTurma ?? "-"} nas Salas
                  </span>
                )}
                {contexto.posicaoCasa && <span>#{contexto.posicaoCasa} na Copa das Casas do Bosque</span>}
              </div>
            </Card>
          )}

          {resumoInvest && (
            <Card>
              <p className="text-sm font-semibold">Investimentos</p>
              <p className="mt-1 text-xs text-neutral-500 dark:text-neutral-400">
                {resumoInvest.totalReversivelAtivo} rendendo · {resumoInvest.totalColetivoInvestido} investidos na Casa/turma
                {resumoInvest.totalDoado > 0 ? ` · ${resumoInvest.totalDoado} doados` : ""}
              </p>
            </Card>
          )}

          {ativos.length > 0 && (
            <Card>
              <p className="mb-2 text-sm font-semibold">Investimentos ativos</p>
              <ul className="space-y-2">
                {ativos.map((inv) => (
                  <li key={inv.id} className="flex items-center justify-between rounded-xl2 bg-neutral-50 p-2.5 text-sm dark:bg-graphite">
                    <span>{NOMES_TIPO[inv.tipo] ?? inv.tipo}</span>
                    <span className="text-xs text-neutral-500 dark:text-neutral-400">
                      {inv.valorPrincipal} investidos · agora vale {inv.valorAtual}
                    </span>
                  </li>
                ))}
              </ul>
            </Card>
          )}

          {historico.length > 0 && (
            <Card>
              <p className="mb-2 text-sm font-semibold">Histórico de resgates de investimento</p>
              <ul className="space-y-2">
                {historico.map((inv) => (
                  <li key={inv.id} className="rounded-xl2 bg-neutral-50 p-2.5 text-xs dark:bg-graphite">
                    {NOMES_TIPO[inv.tipo] ?? inv.tipo}: {inv.valorPrincipal} investidos · resgatado por {inv.valorResgatado}
                  </li>
                ))}
              </ul>
            </Card>
          )}

          <Card>
            <p className="mb-2 text-sm font-semibold">Extrato</p>
            {transacoes.length === 0 && <p className="text-xs text-neutral-400">Nenhum lançamento ainda.</p>}
            <div className="space-y-2">
              {transacoes.map((t) => (
                <div key={t.id} className="flex items-center justify-between rounded-xl2 bg-neutral-50 p-2.5 dark:bg-graphite">
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
                </div>
              ))}
            </div>
          </Card>

          {resgates.length > 0 && (
            <Card>
              <p className="mb-2 text-sm font-semibold">Resgates do catálogo</p>
              <ul className="space-y-2">
                {resgates.map((r) => (
                  <li key={r.id} className="flex items-center justify-between rounded-xl2 bg-neutral-50 p-2.5 text-sm dark:bg-graphite">
                    <div>
                      <p>{r.item.nome}</p>
                      <p className="text-xs text-neutral-400">{formatarData(r.criadoEm)}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-neutral-500">{r.valorDebitado} BC</span>
                      <Badge variant={r.status === "aprovado" ? "success" : r.status === "recusado" ? "danger" : "warning"}>
                        {r.status}
                      </Badge>
                    </div>
                  </li>
                ))}
              </ul>
            </Card>
          )}
        </>
      )}
    </div>
  );
}
