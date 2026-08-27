"use client";

import { useEffect, useState } from "react";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { CoinIcon } from "@/components/ui/coin-icon";
import { InstrucoesInvestimento } from "@/components/dashboard/instrucoes-investimento";
import { cn } from "@/lib/utils";

type TipoInvestimento = "casa" | "turma" | "cdb" | "poupanca" | "fundo_imobiliario" | "tesouro_direto" | "dizimo" | "lar_idoso";

interface OpcaoDestino {
  tipo: TipoInvestimento;
  nome: string;
  descricao: string;
  irreversivel: boolean;
  doacao?: boolean; // troca o verbo "investir" por "doar" na UI - mesmo fluxo, so a palavra muda
  taxaMensal?: number;
}

const OPCOES: OpcaoDestino[] = [
  { tipo: "casa", nome: "Casa", descricao: "Vira ponto pra sempre no placar da sua Casa.", irreversivel: true },
  { tipo: "turma", nome: "Turma", descricao: "Vira ponto pra sempre no placar da sua turma.", irreversivel: true },
  { tipo: "cdb", nome: "CDB", descricao: "Rende juros enquanto aplicado. Pode resgatar quando quiser.", irreversivel: false, taxaMensal: 0.11 },
  { tipo: "poupanca", nome: "Poupança", descricao: "Rende um pouco menos, sempre disponível.", irreversivel: false, taxaMensal: 0.06 },
  { tipo: "fundo_imobiliario", nome: "Fundo Imobiliário", descricao: "Rende parecido com \"aluguel\".", irreversivel: false, taxaMensal: 0.09 },
  { tipo: "tesouro_direto", nome: "Tesouro Direto", descricao: "Rendimento constante, mais \"seguro\".", irreversivel: false, taxaMensal: 0.105 },
  { tipo: "dizimo", nome: "Dízimo (Igreja)", descricao: "Uma doação pra igreja. Sem volta — um ato de generosidade.", irreversivel: true, doacao: true },
  { tipo: "lar_idoso", nome: "Lar do Idoso", descricao: "Uma doação pro lar dos idosos. Sem volta — um ato de generosidade.", irreversivel: true, doacao: true },
];

interface Investimento {
  id: string;
  tipo: TipoInvestimento;
  status: "ativo" | "resgatado";
  valorPrincipal: number;
  valorAtual: number;
  valorResgatado: number | null;
  dataInvestimento: string;
  dataResgate: string | null;
}

export default function InvestirPage() {
  const [saldoAtual, setSaldoAtual] = useState<number | null>(null);
  const [investimentos, setInvestimentos] = useState<Investimento[]>([]);
  const [tipoSelecionado, setTipoSelecionado] = useState<TipoInvestimento | null>(null);
  const [valor, setValor] = useState("");
  const [confirmando, setConfirmando] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [feedback, setFeedback] = useState<{ tipo: "sucesso" | "erro"; texto: string } | null>(null);

  async function carregarTudo() {
    const [rankings, meusInvestimentos] = await Promise.all([
      fetch("/api/dashboard/rankings").then((r) => r.json()),
      fetch("/api/investimentos").then((r) => r.json()),
    ]);
    setSaldoAtual(rankings?.contextoAluno?.saldoPessoalAtual ?? 0);
    setInvestimentos(meusInvestimentos);
  }

  useEffect(() => {
    carregarTudo();
  }, []);

  const opcaoSelecionada = OPCOES.find((o) => o.tipo === tipoSelecionado);
  const ativos = investimentos.filter((i) => i.status === "ativo");
  const historico = investimentos.filter((i) => i.status === "resgatado");

  function escolherTipo(tipo: TipoInvestimento) {
    setTipoSelecionado(tipo);
    setConfirmando(false);
    setFeedback(null);
  }

  async function confirmarInvestimento() {
    const valorNum = Number(valor);
    if (!tipoSelecionado || !Number.isInteger(valorNum) || valorNum <= 0) {
      setFeedback({ tipo: "erro", texto: "Informe um valor inteiro positivo." });
      return;
    }
    setEnviando(true);
    const res = await fetch("/api/investimentos", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tipo: tipoSelecionado, valor: valorNum }),
    });
    const json = await res.json();
    if (res.ok) {
      const texto = opcaoSelecionada?.doacao
        ? `${valorNum} BosqueCoins doados para ${opcaoSelecionada?.nome}!`
        : `${valorNum} BosqueCoins investidos em ${opcaoSelecionada?.nome}!`;
      setFeedback({ tipo: "sucesso", texto });
      setValor("");
      setConfirmando(false);
      setTipoSelecionado(null);
      carregarTudo();
    } else {
      setFeedback({ tipo: "erro", texto: json.erro ?? "Não foi possível investir." });
    }
    setEnviando(false);
  }

  async function resgatar(investimentoId: string) {
    const res = await fetch(`/api/investimentos/${investimentoId}/resgatar`, { method: "POST" });
    const json = await res.json();
    if (res.ok) {
      setFeedback({ tipo: "sucesso", texto: `Resgatado: ${json.valorResgatado} BosqueCoins de volta ao seu saldo.` });
      carregarTudo();
    } else {
      setFeedback({ tipo: "erro", texto: json.erro ?? "Não foi possível resgatar." });
    }
  }

  function nomeDoTipo(tipo: TipoInvestimento) {
    return OPCOES.find((o) => o.tipo === tipo)?.nome ?? tipo;
  }

  return (
    <div className="space-y-4">
      <Card className="bg-gold-gradient text-white">
        <p className="text-xs font-medium opacity-80">Saldo disponível pra investir</p>
        <p className="mt-1 flex items-center gap-2 text-3xl font-bold" data-testid="saldo-investir">
          <CoinIcon className="h-7 w-7" />
          {saldoAtual ?? "…"}
        </p>
      </Card>

      <InstrucoesInvestimento />

      <Card>
        <CardHeader>
          <CardTitle>Para onde investir?</CardTitle>
        </CardHeader>
        <p className="mb-3 text-xs text-neutral-400">
          As taxas de CDB/Poupança/Fundo Imobiliário/Tesouro Direto são ao mês, fictícias e simplificadas, só para fins de aprendizado — não são dados reais de mercado.
        </p>
        <div className="grid grid-cols-2 gap-2">
          {OPCOES.map((o) => (
            <button
              key={o.tipo}
              data-testid={`opcao-investir-${o.tipo}`}
              onClick={() => escolherTipo(o.tipo)}
              className={cn(
                "rounded-xl2 border p-3 text-left transition",
                tipoSelecionado === o.tipo ? "border-gold bg-gold/10" : "border-neutral-200 dark:border-neutral-700"
              )}
            >
              <div className="flex items-center justify-between">
                <p className="text-sm font-semibold">{o.nome}</p>
                {o.irreversivel ? (
                  <Badge variant="danger">Sem volta</Badge>
                ) : (
                  <Badge variant="gold">{((o.taxaMensal ?? 0) * 100).toFixed(1)}% a.m.</Badge>
                )}
              </div>
              <p className="mt-1 text-xs text-neutral-500 dark:text-neutral-400">{o.descricao}</p>
            </button>
          ))}
        </div>
      </Card>

      {feedback && (
        <div className={cn("rounded-xl2 p-3 text-sm", feedback.tipo === "sucesso" ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-700")}>
          {feedback.texto}
        </div>
      )}

      {opcaoSelecionada && (
        <Card>
          <CardHeader>
            <CardTitle>
              {opcaoSelecionada.doacao ? "Quanto doar para" : "Quanto investir em"} {opcaoSelecionada.nome}?
            </CardTitle>
          </CardHeader>
          <Input
            inputMode="numeric"
            pattern="[0-9]*"
            value={valor}
            onChange={(e) => setValor(e.target.value.replace(/\D/g, ""))}
            placeholder="Ex.: 20"
          />

          {opcaoSelecionada.irreversivel ? (
            !confirmando ? (
              <Button className="mt-3 w-full" variant="destructive" disabled={!valor} onClick={() => setConfirmando(true)}>
                {opcaoSelecionada.doacao ? "Doar (irreversível)" : "Investir (irreversível)"}
              </Button>
            ) : (
              <div className="mt-3 space-y-2 rounded-xl2 border border-red-200 bg-red-50 p-3 dark:border-red-900 dark:bg-red-950/30">
                <p className="text-xs text-red-700 dark:text-red-300">
                  {opcaoSelecionada.doacao
                    ? `Tem certeza? Depois de doar para ${opcaoSelecionada.nome}, esse valor não volta pro seu saldo — é definitivo.`
                    : `Tem certeza? Depois de investir em ${opcaoSelecionada.nome}, esse valor não volta pro seu saldo — é definitivo.`}
                </p>
                <div className="flex gap-2">
                  <Button size="sm" variant="destructive" disabled={enviando} onClick={confirmarInvestimento}>
                    {enviando ? "Enviando…" : opcaoSelecionada.doacao ? "Sim, doar" : "Sim, investir"}
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => setConfirmando(false)}>
                    Cancelar
                  </Button>
                </div>
              </div>
            )
          ) : (
            <Button className="mt-3 w-full" disabled={!valor || enviando} onClick={confirmarInvestimento}>
              {enviando ? "Investindo…" : "Investir"}
            </Button>
          )}
        </Card>
      )}

      {ativos.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Seus investimentos ativos</CardTitle>
          </CardHeader>
          <ul className="space-y-2">
            {ativos.map((inv) => (
              <li key={inv.id} className="flex items-center justify-between rounded-xl2 bg-neutral-50 p-2.5 dark:bg-graphite">
                <div>
                  <p className="text-sm font-medium">{nomeDoTipo(inv.tipo)}</p>
                  <p className="text-xs text-neutral-400">
                    {inv.valorPrincipal} investidos · agora vale {inv.valorAtual}
                  </p>
                </div>
                <Button size="sm" variant="outline" onClick={() => resgatar(inv.id)}>
                  Resgatar
                </Button>
              </li>
            ))}
          </ul>
        </Card>
      )}

      {historico.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Histórico de resgates</CardTitle>
          </CardHeader>
          <ul className="space-y-2">
            {historico.map((inv) => (
              <li key={inv.id} className="rounded-xl2 bg-neutral-50 p-2.5 text-xs dark:bg-graphite">
                <p className="font-medium">{nomeDoTipo(inv.tipo)}</p>
                <p className="text-neutral-400">
                  {inv.valorPrincipal} investidos · resgatado por {inv.valorResgatado}
                </p>
              </li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  );
}
