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

/**
 * Fluxo separado, so admin (secao 4.2.1). Nao propaga para turma/Casa (RN-12/13):
 * professor tem saldo proprio, mas nunca entra em ranking.
 */
export default function AdminProfessoresPage() {
  const [professores, setProfessores] = useState<Professor[]>([]);
  const [destinoId, setDestinoId] = useState("");
  const [valor, setValor] = useState("");
  const [motivo, setMotivo] = useState("");
  const [feedback, setFeedback] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  useEffect(() => {
    // Reaproveita /api/turmas? Nao - precisamos de uma lista de usuarios papel=professor.
    // Endpoint dedicado nao foi criado neste MVP; buscamos via extrato admin nao serve.
    // Simplificacao: assume-se um endpoint futuro /api/usuarios?papel=professor.
    fetch("/api/usuarios?papel=professor")
      .then((r) => (r.ok ? r.json() : []))
      .then(setProfessores)
      .catch(() => setProfessores([]));
  }, []);

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
      <h1 className="font-display text-lg font-semibold">Pontuar professores</h1>
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
