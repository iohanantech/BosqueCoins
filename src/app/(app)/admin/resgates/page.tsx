"use client";

import { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CoinIcon } from "@/components/ui/coin-icon";

interface Resgate {
  id: string;
  status: string;
  valorDebitado: number;
  escopoUsado: string;
  item: { nome: string };
}

export default function AdminResgatesPage() {
  const [resgates, setResgates] = useState<Resgate[]>([]);

  function carregar() {
    fetch("/api/redemptions").then((r) => r.json()).then(setResgates);
  }
  useEffect(carregar, []);

  async function resolver(id: string, decisao: "aprovado" | "recusado") {
    await fetch(`/api/redemptions/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ decisao }),
    });
    carregar();
  }

  const pendentes = resgates.filter((r) => r.status === "pendente");
  const resolvidos = resgates.filter((r) => r.status !== "pendente");

  return (
    <div className="space-y-4">
      <h1 className="font-display text-lg font-semibold">Resgates</h1>

      <Card>
        <p className="mb-2 text-sm font-semibold">Pendentes ({pendentes.length})</p>
        <div className="space-y-2">
          {pendentes.map((r) => (
            <div key={r.id} className="flex items-center justify-between rounded-xl2 bg-neutral-50 p-2.5 dark:bg-graphite">
              <div>
                <p className="text-sm font-medium">{r.item.nome}</p>
                <p className="flex items-center gap-1 text-xs text-neutral-500">
                  <CoinIcon className="h-3 w-3" />
                  {r.valorDebitado} · <Badge>{r.escopoUsado}</Badge>
                </p>
              </div>
              <div className="flex gap-1.5">
                <Button size="sm" onClick={() => resolver(r.id, "aprovado")}>Aprovar</Button>
                <Button size="sm" variant="outline" onClick={() => resolver(r.id, "recusado")}>Recusar</Button>
              </div>
            </div>
          ))}
          {pendentes.length === 0 && <p className="text-sm text-neutral-400">Nenhum resgate pendente.</p>}
        </div>
      </Card>

      <Card>
        <p className="mb-2 text-sm font-semibold">Histórico</p>
        <div className="space-y-2">
          {resolvidos.map((r) => (
            <div key={r.id} className="flex items-center justify-between text-sm">
              <span>{r.item.nome}</span>
              <Badge variant={r.status === "aprovado" ? "success" : "danger"}>{r.status}</Badge>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}
