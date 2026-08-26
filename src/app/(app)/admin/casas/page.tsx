"use client";

import { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";

interface Casa {
  id: string;
  nome: string;
  corPrimariaHex: string;
  corSecundariaHex: string;
  ativo: boolean;
}

/**
 * Cadastro fixo das 4 Casas (secao 1) - nao escopado por ano, so a
 * pontuacao zera anualmente. Cores sao aproximacoes (ver CLAUDE.md).
 */
export default function AdminCasasPage() {
  const [casas, setCasas] = useState<Casa[]>([]);

  useEffect(() => {
    fetch("/api/casas").then((r) => r.json()).then(setCasas);
  }, []);

  return (
    <div className="space-y-4">
      <h1 className="font-display text-lg font-semibold">Casas</h1>
      <p className="text-xs text-neutral-500 dark:text-neutral-400">
        Cadastro fixo (4 Casas oficiais). O aluno permanece na mesma Casa entre anos letivos - só a pontuação zera.
      </p>
      <div className="grid grid-cols-2 gap-3">
        {casas.map((c) => (
          <Card key={c.id} style={{ borderTop: `4px solid ${c.corPrimariaHex}` }}>
            <div className="mb-2 flex gap-1.5">
              <span className="h-5 w-5 rounded-full" style={{ backgroundColor: c.corPrimariaHex }} />
              <span className="h-5 w-5 rounded-full" style={{ backgroundColor: c.corSecundariaHex }} />
            </div>
            <p className="text-sm font-semibold">{c.nome}</p>
          </Card>
        ))}
      </div>
    </div>
  );
}
