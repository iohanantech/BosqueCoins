"use client";

import { useEffect, useRef, useState } from "react";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { CoinIcon } from "@/components/ui/coin-icon";
import { cn } from "@/lib/utils";

interface AlunoResultado {
  id: string;
  nome: string;
  turma: string | null;
}

interface StatusSemana {
  podeEnviar: boolean;
  totalEnviadoNaJanela: number;
  valorPresente: number;
  diasAteLiberar: number;
}

export default function PresentearPage() {
  const [status, setStatus] = useState<StatusSemana | null>(null);
  const [saldoAtual, setSaldoAtual] = useState<number | null>(null);

  const [busca, setBusca] = useState("");
  const [resultados, setResultados] = useState<AlunoResultado[]>([]);
  const [buscando, setBuscando] = useState(false);
  const [selecionado, setSelecionado] = useState<AlunoResultado | null>(null);

  const [mensagem, setMensagem] = useState("");
  const [confirmando, setConfirmando] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [feedback, setFeedback] = useState<{ tipo: "sucesso" | "erro"; texto: string } | null>(null);

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  async function carregarStatus() {
    const [st, rankings] = await Promise.all([
      fetch("/api/presentes").then((r) => r.json()),
      fetch("/api/dashboard/rankings").then((r) => r.json()),
    ]);
    setStatus(st);
    setSaldoAtual(rankings?.contextoAluno?.saldoPessoalAtual ?? 0);
  }

  useEffect(() => {
    carregarStatus();
  }, []);

  useEffect(() => {
    if (selecionado || busca.trim().length < 2) {
      setResultados([]);
      return;
    }
    if (debounceRef.current) clearTimeout(debounceRef.current);
    setBuscando(true);
    debounceRef.current = setTimeout(async () => {
      const res = await fetch(`/api/alunos/busca?q=${encodeURIComponent(busca.trim())}`);
      const json = res.ok ? await res.json() : [];
      setResultados(json);
      setBuscando(false);
    }, 300);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [busca, selecionado]);

  const valorPresente = status?.valorPresente ?? 10;
  const limiteUsado = status ? !status.podeEnviar : false;
  const saldoInsuficiente = saldoAtual !== null && saldoAtual < valorPresente;

  function escolher(aluno: AlunoResultado) {
    setSelecionado(aluno);
    setBusca(aluno.nome);
    setResultados([]);
    setConfirmando(false);
    setFeedback(null);
  }

  function limparSelecao() {
    setSelecionado(null);
    setBusca("");
    setConfirmando(false);
  }

  async function confirmarEnvio() {
    if (!selecionado) return;
    setEnviando(true);
    const res = await fetch("/api/presentes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ destinatarioId: selecionado.id, mensagem: mensagem.trim() || undefined }),
    });
    const json = await res.json();
    if (res.ok) {
      setFeedback({ tipo: "sucesso", texto: `Você enviou ${valorPresente} BosqueCoins para ${selecionado.nome}!` });
      setMensagem("");
      setConfirmando(false);
      setSelecionado(null);
      setBusca("");
      carregarStatus();
    } else {
      setFeedback({ tipo: "erro", texto: json.erro ?? "Não foi possível enviar o presente." });
    }
    setEnviando(false);
  }

  return (
    <div className="space-y-4">
      <Card className="bg-gold-gradient text-white">
        <p className="text-xs font-medium opacity-80">Seu saldo disponível</p>
        <p className="mt-1 flex items-center gap-2 text-3xl font-bold" data-testid="saldo-presentear">
          <CoinIcon className="h-7 w-7" />
          {saldoAtual ?? "…"}
        </p>
      </Card>

      {/* RN-27: avisa ANTES de escolher o destinatario que o limite da semana ja foi usado. */}
      {limiteUsado && (
        <div className="rounded-xl2 bg-amber-50 p-3 text-sm text-amber-800 dark:bg-amber-950/40 dark:text-amber-200" data-testid="aviso-limite-semanal">
          Você já enviou seu presente desta semana. Volte em {status?.diasAteLiberar} dia
          {(status?.diasAteLiberar ?? 0) > 1 ? "s" : ""} para presentear outro colega.
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Presentear um colega</CardTitle>
        </CardHeader>
        <p className="mb-3 text-xs text-neutral-500 dark:text-neutral-400">
          Envie {valorPresente} BosqueCoins do seu saldo para outro aluno. A transferência é imediata e não volta atrás.
        </p>

        <label className="mb-1 block text-xs font-medium text-neutral-500 dark:text-neutral-400">Nome do colega</label>
        <div className="relative">
          <Input
            inputMode="text"
            value={busca}
            disabled={limiteUsado}
            onChange={(e) => {
              setBusca(e.target.value);
              if (selecionado) setSelecionado(null);
            }}
            placeholder="Comece a digitar o nome…"
          />
          {selecionado && (
            <button
              type="button"
              onClick={limparSelecao}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-neutral-400 underline"
            >
              trocar
            </button>
          )}
          {!selecionado && (buscando || resultados.length > 0) && busca.trim().length >= 2 && (
            <ul className="absolute z-10 mt-1 w-full overflow-hidden rounded-xl2 border border-neutral-200 bg-white shadow-lg dark:border-neutral-700 dark:bg-graphite">
              {buscando && <li className="px-3 py-2 text-xs text-neutral-400">Buscando…</li>}
              {!buscando &&
                resultados.map((a) => (
                  <li key={a.id}>
                    <button
                      type="button"
                      data-testid={`resultado-${a.id}`}
                      onClick={() => escolher(a)}
                      className="flex w-full items-center justify-between px-3 py-2 text-left text-sm hover:bg-neutral-50 dark:hover:bg-neutral-800"
                    >
                      <span className="font-medium">{a.nome}</span>
                      <span className="text-xs text-neutral-400">{a.turma ?? "sem turma"}</span>
                    </button>
                  </li>
                ))}
              {!buscando && resultados.length === 0 && (
                <li className="px-3 py-2 text-xs text-neutral-400">Nenhum aluno encontrado.</li>
              )}
            </ul>
          )}
        </div>

        {selecionado && (
          <div className="mt-4 space-y-3">
            <div className="flex items-center gap-2 rounded-xl2 bg-gold/10 p-3 text-sm">
              <CoinIcon className="h-5 w-5 text-gold" />
              <span>
                Você vai enviar <strong>{valorPresente} BosqueCoins</strong> para <strong>{selecionado.nome}</strong>.
              </span>
            </div>

            <div>
              <label className="mb-1 block text-xs font-medium text-neutral-500 dark:text-neutral-400">
                Escreva um recado (opcional)
              </label>
              <Input
                inputMode="text"
                maxLength={60}
                value={mensagem}
                onChange={(e) => setMensagem(e.target.value)}
                placeholder="Ex.: Parabéns pela apresentação!"
              />
              <p className="mt-1 text-right text-[11px] text-neutral-400">{mensagem.length}/60</p>
            </div>

            {!confirmando ? (
              <Button
                className="w-full"
                disabled={saldoInsuficiente}
                onClick={() => setConfirmando(true)}
              >
                {saldoInsuficiente ? "Saldo insuficiente" : "Enviar presente"}
              </Button>
            ) : (
              <div className="space-y-2 rounded-xl2 border border-gold/40 bg-gold/5 p-3">
                <p className="text-xs text-neutral-600 dark:text-neutral-300">
                  Confirmar? O valor sai do seu saldo na hora e não volta atrás.
                </p>
                <div className="flex gap-2">
                  <Button size="sm" disabled={enviando} onClick={confirmarEnvio}>
                    {enviando ? "Enviando…" : "Sim, enviar"}
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => setConfirmando(false)}>
                    Cancelar
                  </Button>
                </div>
              </div>
            )}
          </div>
        )}
      </Card>

      {feedback && (
        <div
          className={cn(
            "rounded-xl2 p-3 text-sm",
            feedback.tipo === "sucesso" ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-700"
          )}
        >
          {feedback.texto}
        </div>
      )}
    </div>
  );
}
