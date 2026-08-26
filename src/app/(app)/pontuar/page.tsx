"use client";

import { useEffect, useState } from "react";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input, Textarea } from "@/components/ui/input";
import { CoinIcon } from "@/components/ui/coin-icon";
import { cn } from "@/lib/utils";

interface Aluno {
  id: string;
  nome: string;
  email: string;
}

interface Turma {
  id: string;
  nome: string;
  serie: string;
  alunos: Aluno[];
}

/**
 * Fluxo de pontuar em poucos toques (secao 9): turma -> marcar aluno(s) por
 * checkbox (um, varios ou todos) -> valor -> motivo -> confirmar.
 * Otimizado para repeticao: mantem a turma selecionada apos confirmar,
 * limpa so as marcacoes de aluno (secao 9).
 */
export default function PontuarPage() {
  const [turmas, setTurmas] = useState<Turma[]>([]);
  const [turmaId, setTurmaId] = useState<string>("");
  const [alunosMarcados, setAlunosMarcados] = useState<Set<string>>(new Set());
  const [valor, setValor] = useState("");
  const [motivo, setMotivo] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [feedback, setFeedback] = useState<{ tipo: "sucesso" | "erro"; texto: string } | null>(null);

  useEffect(() => {
    fetch("/api/turmas")
      .then((r) => r.json())
      .then((data: Turma[]) => setTurmas(data))
      .catch(() => setTurmas([]));
  }, []);

  const turmaAtual = turmas.find((t) => t.id === turmaId);

  function alternarAluno(id: string) {
    setAlunosMarcados((prev) => {
      const novo = new Set(prev);
      if (novo.has(id)) novo.delete(id);
      else novo.add(id);
      return novo;
    });
  }

  function marcarTodos() {
    if (!turmaAtual) return;
    setAlunosMarcados(new Set(turmaAtual.alunos.map((a) => a.id)));
  }

  function limparMarcacoes() {
    setAlunosMarcados(new Set());
  }

  async function confirmar() {
    setFeedback(null);
    const valorNum = Number(valor);
    if (!turmaId || alunosMarcados.size === 0) {
      setFeedback({ tipo: "erro", texto: "Selecione a turma e ao menos um aluno." });
      return;
    }
    if (!Number.isInteger(valorNum) || valorNum <= 0) {
      setFeedback({ tipo: "erro", texto: "O valor deve ser um número inteiro positivo." });
      return;
    }
    if (!motivo.trim()) {
      setFeedback({ tipo: "erro", texto: "O motivo é obrigatório." });
      return;
    }

    setEnviando(true);
    try {
      const res = await fetch("/api/points/individual", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ turmaId, alunoIds: Array.from(alunosMarcados), valor: valorNum, motivo }),
      });
      const json = await res.json();
      if (!res.ok) {
        setFeedback({ tipo: "erro", texto: json.erro ?? "Não foi possível registrar os pontos." });
      } else {
        setFeedback({ tipo: "sucesso", texto: `${valorNum} BosqueCoins dados para ${json.quantidadeAlunos} aluno(s)!` });
        // Mantem a turma selecionada, limpa so alunos/valor/motivo (secao 9 - otimizar p/ repeticao)
        limparMarcacoes();
        setValor("");
        setMotivo("");
      }
    } finally {
      setEnviando(false);
    }
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>1. Escolha a turma</CardTitle>
        </CardHeader>
        <div className="flex flex-wrap gap-2">
          {turmas.map((t) => (
            <button
              key={t.id}
              onClick={() => {
                setTurmaId(t.id);
                limparMarcacoes();
              }}
              className={cn(
                "rounded-full border px-3.5 py-2 text-sm font-medium",
                turmaId === t.id ? "border-gold bg-gold/10 text-gold-dark" : "border-neutral-200 dark:border-neutral-700"
              )}
            >
              {t.nome}
            </button>
          ))}
          {turmas.length === 0 && <p className="text-sm text-neutral-400">Nenhuma turma disponível.</p>}
        </div>
      </Card>

      {turmaAtual && (
        <Card>
          <CardHeader>
            <CardTitle>2. Marque os alunos</CardTitle>
            <div className="flex gap-2">
              <button onClick={marcarTodos} className="text-xs font-medium text-gold-dark">
                Marcar todos
              </button>
              <button onClick={limparMarcacoes} className="text-xs font-medium text-neutral-400">
                Limpar
              </button>
            </div>
          </CardHeader>
          <ul className="max-h-72 space-y-1 overflow-y-auto">
            {turmaAtual.alunos.map((aluno) => (
              <li key={aluno.id}>
                <label className="flex items-center gap-3 rounded-xl2 px-2 py-2.5 active:bg-neutral-100 dark:active:bg-graphite">
                  <input
                    type="checkbox"
                    className="h-5 w-5 accent-[#D4AF37]"
                    checked={alunosMarcados.has(aluno.id)}
                    onChange={() => alternarAluno(aluno.id)}
                  />
                  <span className="text-sm">{aluno.nome}</span>
                </label>
              </li>
            ))}
            {turmaAtual.alunos.length === 0 && (
              <p className="py-4 text-center text-sm text-neutral-400">Nenhum aluno matriculado nesta turma este ano.</p>
            )}
          </ul>
          <p className="mt-2 text-xs text-neutral-400">{alunosMarcados.size} selecionado(s)</p>
        </Card>
      )}

      {turmaAtual && alunosMarcados.size > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>3. Valor e motivo</CardTitle>
          </CardHeader>
          <div className="space-y-3">
            <div>
              <label className="mb-1 block text-xs font-medium text-neutral-500">Valor (BosqueCoins)</label>
              <Input inputMode="numeric" pattern="[0-9]*" value={valor} onChange={(e) => setValor(e.target.value.replace(/\D/g, ""))} placeholder="Ex.: 5" />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-neutral-500">Motivo</label>
              <Textarea value={motivo} onChange={(e) => setMotivo(e.target.value)} placeholder="Ex.: Participação na aula de Matemática" rows={2} />
            </div>
          </div>
        </Card>
      )}

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

      {turmaAtual && alunosMarcados.size > 0 && (
        <Button size="lg" className="w-full" disabled={enviando || !valor || !motivo.trim()} onClick={confirmar}>
          <CoinIcon className="h-5 w-5" />
          {enviando ? "Enviando…" : `Confirmar para ${alunosMarcados.size} aluno(s)`}
        </Button>
      )}
    </div>
  );
}
