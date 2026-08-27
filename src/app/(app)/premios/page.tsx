"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CoinIcon } from "@/components/ui/coin-icon";

interface ItemCatalogo {
  id: string;
  nome: string;
  descricao: string;
  custo: number;
  icone: string | null;
  imagemUrl: string | null;
  categoria: string;
  escopo: "turma" | "individual" | "ambos";
  quantidadeDisponivel: number | null;
}

/**
 * Catalogo de recompensas (secao 4.3): aluno ve individual+ambos e resgata
 * para si; PEC ve turma+ambos e resgata em nome da turma (secao 4.4).
 */
export default function PremiosPage() {
  const { data: session } = useSession();
  const papel = session?.user?.papel;
  const escopo = papel === "aluno" ? "individual" : "turma";

  const [itens, setItens] = useState<ItemCatalogo[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [turmaId, setTurmaId] = useState<string>("");
  const [turmasPec, setTurmasPec] = useState<{ id: string; nome: string }[]>([]);
  const [saldoAluno, setSaldoAluno] = useState<number | null>(null);

  useEffect(() => {
    if (!papel) return;
    fetch(`/api/catalog?escopo=${escopo}`)
      .then((r) => r.json())
      .then(setItens)
      .finally(() => setCarregando(false));

    if (papel === "aluno") {
      fetch("/api/dashboard/rankings")
        .then((r) => r.json())
        .then((d) => setSaldoAluno(d?.contextoAluno?.saldoPessoalAtual ?? 0))
        .catch(() => setSaldoAluno(null));
    }

    if (papel !== "aluno") {
      fetch("/api/pec/turmas")
        .then((r) => r.json())
        .then((t) => {
          setTurmasPec(t);
          if (t[0]) setTurmaId(t[0].id);
        });
    }
  }, [papel, escopo]);

  async function resgatar(item: ItemCatalogo) {
    setFeedback(null);
    const body: Record<string, unknown> = { itemId: item.id, escopo };
    if (escopo === "turma") {
      if (!turmaId) {
        setFeedback("Selecione a turma antes de resgatar.");
        return;
      }
      body.turmaId = turmaId;
    }
    const res = await fetch("/api/redemptions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const json = await res.json();
    setFeedback(res.ok ? "Resgate solicitado! Aguarde a aprovação." : json.erro ?? "Não foi possível solicitar o resgate.");
  }

  // Só para o aluno: um item que custa mais do que ele tem não pode ser
  // solicitado (o backend também barra - ver solicitarResgate).
  const semSaldoPara = (item: ItemCatalogo) =>
    papel === "aluno" && saldoAluno !== null && item.custo > saldoAluno;

  return (
    <div className="space-y-4">
      <h1 className="font-display text-lg font-semibold">Prêmios</h1>

      {papel !== "aluno" && turmasPec.length > 0 && (
        <div className="flex gap-2 overflow-x-auto no-scrollbar">
          {turmasPec.map((t) => (
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
      )}

      {feedback && <div className="rounded-xl2 bg-neutral-100 p-3 text-sm dark:bg-graphite-soft">{feedback}</div>}

      {carregando && <p className="py-10 text-center text-sm text-neutral-400">Carregando…</p>}

      <div className="grid grid-cols-2 gap-3">
        {itens.map((item) => (
          <Card key={item.id} className="flex flex-col">
            <div className="mb-2 flex h-16 items-center justify-center rounded-xl2 bg-gold/10 text-3xl">
              {item.icone ?? "🎁"}
            </div>
            <p className="text-sm font-semibold">{item.nome}</p>
            <p className="mb-2 line-clamp-2 text-xs text-neutral-500 dark:text-neutral-400">{item.descricao}</p>
            <div className="mt-auto flex items-center justify-between">
              <span className="flex items-center gap-1 text-sm font-semibold text-gold-dark">
                <CoinIcon className="h-4 w-4" />
                {item.custo}
              </span>
              {item.quantidadeDisponivel !== null && <Badge variant="warning">{item.quantidadeDisponivel} rest.</Badge>}
            </div>
            <Button
              size="sm"
              className="mt-2 w-full"
              disabled={semSaldoPara(item)}
              onClick={() => resgatar(item)}
            >
              {semSaldoPara(item) ? "Saldo insuficiente" : "Resgatar"}
            </Button>
          </Card>
        ))}
        {!carregando && itens.length === 0 && (
          <p className="col-span-2 py-10 text-center text-sm text-neutral-400">Nenhum item disponível neste escopo.</p>
        )}
      </div>
    </div>
  );
}
