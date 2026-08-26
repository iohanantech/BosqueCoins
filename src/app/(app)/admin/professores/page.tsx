"use client";

import { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input, Textarea } from "@/components/ui/input";

interface Professor {
  id: string;
  nome: string;
  email: string;
  saldoAtual: number;
  saldoAcumulado: number;
}

interface Turma {
  id: string;
  nome: string;
}

/**
 * Fluxo separado, so admin (secao 4.2.1). Nao propaga para turma/Casa (RN-12/13):
 * professor tem saldo proprio, mas nunca entra em ranking.
 */
export default function AdminProfessoresPage() {
  const [professores, setProfessores] = useState<Professor[]>([]);
  const [turmas, setTurmas] = useState<Turma[]>([]);
  const [destinoId, setDestinoId] = useState("");
  const [valor, setValor] = useState("");
  const [motivo, setMotivo] = useState("");
  const [feedback, setFeedback] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  const [novoNome, setNovoNome] = useState("");
  const [novoEmail, setNovoEmail] = useState("");
  const [turmasPecSelecionadas, setTurmasPecSelecionadas] = useState<Set<string>>(new Set());
  const [salvandoNovo, setSalvandoNovo] = useState(false);
  const [erroNovo, setErroNovo] = useState<string | null>(null);

  function carregarProfessores() {
    fetch("/api/usuarios?papel=professor")
      .then((r) => (r.ok ? r.json() : []))
      .then(setProfessores)
      .catch(() => setProfessores([]));
  }

  useEffect(() => {
    carregarProfessores();
    fetch("/api/turmas")
      .then((r) => (r.ok ? r.json() : []))
      .then(setTurmas)
      .catch(() => setTurmas([]));
  }, []);

  function alternarTurmaPec(turmaId: string) {
    setTurmasPecSelecionadas((prev) => {
      const novo = new Set(prev);
      if (novo.has(turmaId)) novo.delete(turmaId);
      else novo.add(turmaId);
      return novo;
    });
  }

  async function criarProfessor() {
    setErroNovo(null);
    setSalvandoNovo(true);
    try {
      const res = await fetch("/api/admin/professores", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nome: novoNome,
          email: novoEmail,
          turmasPecIds: Array.from(turmasPecSelecionadas),
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        setErroNovo(json.erro ?? "Não foi possível cadastrar o professor.");
        return;
      }
      setNovoNome("");
      setNovoEmail("");
      setTurmasPecSelecionadas(new Set());
      carregarProfessores();
    } finally {
      setSalvandoNovo(false);
    }
  }

  async function enviar() {
    setFeedback(null);
    const valorNum = Number(valor);
    if (!destinoId || !Number.isInteger(valorNum) || valorNum <= 0 || !motivo.trim()) {
      setFeedback("Preencha professor, valor (inteiro positivo) e motivo.");
      return;
    }
    setEnviando(true);
    try {
      const res = await fetch("/api/points/professor", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ professorDestinoId: destinoId, valor: valorNum, motivo }),
      });
      const json = await res.json();
      setFeedback(res.ok ? "BosqueCoins dados ao professor!" : json.erro ?? "Erro ao dar pontos.");
      if (res.ok) {
        setValor("");
        setMotivo("");
      }
    } finally {
      setEnviando(false);
    }
  }

  return (
    <div className="space-y-4">
      <h1 className="font-display text-lg font-semibold">Professores</h1>

      <Card className="space-y-2">
        <p className="text-sm font-semibold">Novo professor</p>
        <Input placeholder="Nome" value={novoNome} onChange={(e) => setNovoNome(e.target.value)} />
        <Input
          placeholder="E-mail institucional"
          type="email"
          value={novoEmail}
          onChange={(e) => setNovoEmail(e.target.value)}
        />

        {turmas.length > 0 && (
          <div>
            <p className="mb-1.5 text-xs font-medium text-neutral-500">É PEC de quais turmas? (opcional)</p>
            <div className="flex flex-wrap gap-2">
              {turmas.map((t) => {
                const marcado = turmasPecSelecionadas.has(t.id);
                return (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => alternarTurmaPec(t.id)}
                    className={`rounded-full border px-3 py-1.5 text-xs font-medium ${
                      marcado ? "border-gold bg-gold/10 text-gold-dark" : "border-neutral-200 dark:border-neutral-700"
                    }`}
                  >
                    {t.nome}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {erroNovo && <p className="text-xs text-red-600">{erroNovo}</p>}
        <Button className="w-full" disabled={salvandoNovo || !novoNome || !novoEmail} onClick={criarProfessor}>
          {salvandoNovo ? "Salvando…" : "Cadastrar professor"}
        </Button>
      </Card>

      <h2 className="font-display text-base font-semibold">Pontuar professores</h2>
      <p className="text-xs text-neutral-500 dark:text-neutral-400">
        Reconhecimento puro (RN-13): esses pontos nunca aparecem em nenhum ranking e não podem ser trocados no catálogo.
      </p>

      <Card className="space-y-2">
        <select
          className="h-11 w-full rounded-xl2 border border-neutral-300 bg-white px-3 text-sm dark:border-neutral-700 dark:bg-graphite-soft"
          value={destinoId}
          onChange={(e) => setDestinoId(e.target.value)}
        >
          <option value="">Selecione o professor</option>
          {professores.map((p) => (
            <option key={p.id} value={p.id}>
              {p.nome} (saldo: {p.saldoAtual})
            </option>
          ))}
        </select>
        <Input inputMode="numeric" placeholder="Valor" value={valor} onChange={(e) => setValor(e.target.value.replace(/\D/g, ""))} />
        <Textarea placeholder="Motivo (obrigatório)" value={motivo} onChange={(e) => setMotivo(e.target.value)} rows={2} />
        {feedback && <p className="text-xs text-neutral-600 dark:text-neutral-300">{feedback}</p>}
        <Button className="w-full" disabled={enviando} onClick={enviar}>
          {enviando ? "Enviando…" : "Dar BosqueCoins"}
        </Button>
      </Card>
    </div>
  );
}
