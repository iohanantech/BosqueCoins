"use client";

import { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input, Textarea } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { CoinIcon } from "@/components/ui/coin-icon";

interface Turma {
  id: string;
  nome: string;
  alunos: { id: string; nome: string }[];
}

interface Resgate {
  id: string;
  status: string;
  valorDebitado: number;
  escopoUsado: string;
  turmaId: string | null;
  alunoId: string | null;
  item: { nome: string };
}

/**
 * Painel do PEC (secao 2): so as turmas atribuidas a ele. Ajustes manuais
 * de saldo (RN-05) e aprovacao de resgates de turma (secao 4.4).
 */
export default function PecPage() {
  const [turmas, setTurmas] = useState<Turma[]>([]);
  const [turmaId, setTurmaId] = useState("");
  const [resgates, setResgates] = useState<Resgate[]>([]);
  const [ajusteValor, setAjusteValor] = useState("");
  const [ajusteMotivo, setAjusteMotivo] = useState("");
  const [ajusteDirecao, setAjusteDirecao] = useState<"credito" | "debito">("credito");
  const [feedback, setFeedback] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/pec/turmas")
      .then((r) => r.json())
      .then(async (minhasTurmas) => {
        const todas: Turma[] = await fetch("/api/turmas").then((r) => r.json());
        const filtradas = todas.filter((t) => minhasTurmas.some((m: { id: string }) => m.id === t.id));
        setTurmas(filtradas);
        if (filtradas[0]) setTurmaId(filtradas[0].id);
      });
    fetch("/api/redemptions")
      .then((r) => r.json())
      .then(setResgates);
  }, []);

  async function enviarAjuste() {
    setFeedback(null);
    const valorNum = Number(ajusteValor);
    if (!turmaId || !Number.isInteger(valorNum) || valorNum <= 0 || !ajusteMotivo.trim()) {
      setFeedback("Preencha valor (inteiro positivo) e motivo.");
      return;
    }
    const res = await fetch("/api/points/turma", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ turmaId, valor: valorNum, direcao: ajusteDirecao, motivo: ajusteMotivo }),
    });
    const json = await res.json();
    setFeedback(res.ok ? "Ajuste registrado." : json.erro ?? "Não foi possível ajustar.");
    if (res.ok) {
      setAjusteValor("");
      setAjusteMotivo("");
    }
  }

  async function resolver(resgateId: string, decisao: "aprovado" | "recusado") {
    await fetch(`/api/redemptions/${resgateId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ decisao }),
    });
    fetch("/api/redemptions")
      .then((r) => r.json())
      .then(setResgates);
  }

  const pendentes = resgates.filter((r) => r.status === "pendente");

  return (
    <div className="space-y-4">
      <h1 className="font-display text-lg font-semibold">Painel do PEC</h1>

      {turmas.length === 0 && <p className="text-sm text-neutral-400">Você não é PEC de nenhuma turma neste ano letivo.</p>}

      {turmas.length > 0 && (
        <>
          <div className="flex gap-2 overflow-x-auto no-scrollbar">
            {turmas.map((t) => (
              <button
                key={t.id}
                onClick={() => setTurmaId(t.id)}
                className={`shrink-0 rounded-full border px-3 py-1.5 text-xs font-medium ${
                  turmaId === t.id ? "border-gold bg-gold/10 text-gold-dark" : "border-neutral-200 dark:border-neutral-700"
                }`}
              >
                {t.nome}
              </button>
            ))}
          </div>

          <Card>
            <p className="mb-2 text-sm font-semibold">Ajuste manual de saldo</p>
            <div className="mb-2 flex gap-2">
              <button
                onClick={() => setAjusteDirecao("credito")}
                className={`rounded-full border px-3 py-1.5 text-xs ${ajusteDirecao === "credito" ? "border-emerald-400 bg-emerald-50 text-emerald-700" : "border-neutral-200"}`}
              >
                Crédito
              </button>
              <button
                onClick={() => setAjusteDirecao("debito")}
                className={`rounded-full border px-3 py-1.5 text-xs ${ajusteDirecao === "debito" ? "border-red-400 bg-red-50 text-red-700" : "border-neutral-200"}`}
              >
                Débito
              </button>
            </div>
            <div className="space-y-2">
              <Input inputMode="numeric" placeholder="Valor" value={ajusteValor} onChange={(e) => setAjusteValor(e.target.value.replace(/\D/g, ""))} />
              <Textarea placeholder="Motivo (obrigatório)" value={ajusteMotivo} onChange={(e) => setAjusteMotivo(e.target.value)} rows={2} />
              {feedback && <p className="text-xs text-neutral-600 dark:text-neutral-300">{feedback}</p>}
              <Button className="w-full" onClick={enviarAjuste}>
                Registrar ajuste
              </Button>
            </div>
          </Card>
        </>
      )}

      <Card>
        <p className="mb-2 text-sm font-semibold">Resgates pendentes</p>
        <div className="space-y-2">
          {pendentes.map((r) => (
            <div key={r.id} className="flex items-center justify-between rounded-xl2 bg-neutral-50 p-2.5 dark:bg-graphite">
              <div>
                <p className="text-sm font-medium">{r.item.nome}</p>
                <p className="flex items-center gap-1 text-xs text-neutral-500">
                  <CoinIcon className="h-3 w-3" />
                  {r.valorDebitado} · <Badge variant="default">{r.escopoUsado}</Badge>
                </p>
              </div>
              <div className="flex gap-1.5">
                <Button size="sm" onClick={() => resolver(r.id, "aprovado")}>
                  Aprovar
                </Button>
                <Button size="sm" variant="outline" onClick={() => resolver(r.id, "recusado")}>
                  Recusar
                </Button>
              </div>
            </div>
          ))}
          {pendentes.length === 0 && <p className="text-sm text-neutral-400">Nenhum resgate pendente.</p>}
        </div>
      </Card>
    </div>
  );
}
