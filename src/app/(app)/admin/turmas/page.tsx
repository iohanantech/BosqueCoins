"use client";

import { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

interface Turma {
  id: string;
  nome: string;
  serie: string;
  alunos: { id: string; nome: string }[];
}

interface Professor {
  id: string;
  nome: string;
}

export default function AdminTurmasPage() {
  const [turmas, setTurmas] = useState<Turma[]>([]);
  const [professores, setProfessores] = useState<Professor[]>([]);
  const [selecoes, setSelecoes] = useState<Record<string, string>>({});
  const [feedback, setFeedback] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/turmas").then((r) => r.json()).then(setTurmas);
    fetch("/api/usuarios?papel=professor").then((r) => r.json()).then(setProfessores);
  }, []);

  async function atribuirPec(turmaId: string) {
    const professorId = selecoes[turmaId];
    if (!professorId) return;
    const res = await fetch("/api/admin/pec-turmas", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ professorId, turmaId }),
    });
    setFeedback(res.ok ? "PEC atribuído com sucesso." : "Não foi possível atribuir.");
  }

  return (
    <div className="space-y-4">
      <h1 className="font-display text-lg font-semibold">Turmas</h1>
      {feedback && <p className="text-xs text-neutral-500">{feedback}</p>}
      <div className="space-y-3">
        {turmas.map((t) => (
          <Card key={t.id}>
            <p className="text-sm font-semibold">{t.nome}</p>
            <p className="mb-2 text-xs text-neutral-500">{t.alunos.length} alunos matriculados este ano</p>
            <div className="flex gap-2">
              <select
                className="h-10 flex-1 rounded-xl2 border border-neutral-300 bg-white px-2 text-xs dark:border-neutral-700 dark:bg-graphite-soft"
                value={selecoes[t.id] ?? ""}
                onChange={(e) => setSelecoes({ ...selecoes, [t.id]: e.target.value })}
              >
                <option value="">Atribuir PEC…</option>
                {professores.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.nome}
                  </option>
                ))}
              </select>
              <Button size="sm" onClick={() => atribuirPec(t.id)} disabled={!selecoes[t.id]}>
                Atribuir
              </Button>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
