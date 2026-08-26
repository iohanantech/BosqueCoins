"use client";

import { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";

interface Turma {
  id: string;
  nome: string;
  serie: string;
  ativo: boolean;
  alunos: { id: string; nome: string }[];
}

interface Professor {
  id: string;
  nome: string;
}

interface Aluno {
  id: string;
  nome: string;
  email: string;
}

const TURMA_VAZIA = { nome: "", serie: "" };

export default function AdminTurmasPage() {
  const [turmas, setTurmas] = useState<Turma[]>([]);
  const [professores, setProfessores] = useState<Professor[]>([]);
  const [alunos, setAlunos] = useState<Aluno[]>([]);
  const [selecoes, setSelecoes] = useState<Record<string, string>>({});
  const [alunoParaAdicionar, setAlunoParaAdicionar] = useState<Record<string, string>>({});
  const [feedback, setFeedback] = useState<string | null>(null);

  const [formNova, setFormNova] = useState(TURMA_VAZIA);
  const [salvando, setSalvando] = useState(false);
  const [erroNova, setErroNova] = useState<string | null>(null);

  const [editandoId, setEditandoId] = useState<string | null>(null);
  const [formEdicao, setFormEdicao] = useState(TURMA_VAZIA);
  const [erroEdicao, setErroEdicao] = useState<string | null>(null);

  function carregar() {
    fetch("/api/turmas?todas=true")
      .then((r) => r.json())
      .then(setTurmas);
    fetch("/api/usuarios?papel=professor")
      .then((r) => r.json())
      .then(setProfessores);
    fetch("/api/usuarios?papel=aluno")
      .then((r) => r.json())
      .then(setAlunos);
  }

  useEffect(carregar, []);

  async function criar() {
    setErroNova(null);
    setSalvando(true);
    try {
      const res = await fetch("/api/turmas", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formNova),
      });
      const json = await res.json();
      if (!res.ok) {
        setErroNova(json.erro ?? "Não foi possível criar a turma.");
        return;
      }
      setFormNova(TURMA_VAZIA);
      carregar();
    } finally {
      setSalvando(false);
    }
  }

  function iniciarEdicao(turma: Turma) {
    setEditandoId(turma.id);
    setFormEdicao({ nome: turma.nome, serie: turma.serie });
    setErroEdicao(null);
  }

  async function salvarEdicao(id: string) {
    setErroEdicao(null);
    setSalvando(true);
    try {
      const res = await fetch(`/api/turmas/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formEdicao),
      });
      const json = await res.json();
      if (!res.ok) {
        setErroEdicao(json.erro ?? "Não foi possível salvar.");
        return;
      }
      setEditandoId(null);
      carregar();
    } finally {
      setSalvando(false);
    }
  }

  async function alternarAtivo(turma: Turma) {
    await fetch(`/api/turmas/${turma.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ativo: !turma.ativo }),
    });
    carregar();
  }

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

  async function adicionarAluno(turmaId: string) {
    const alunoId = alunoParaAdicionar[turmaId];
    if (!alunoId) return;
    const res = await fetch(`/api/turmas/${turmaId}/alunos`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ alunoIds: [alunoId] }),
    });
    setFeedback(res.ok ? "Aluno matriculado nesta turma." : "Não foi possível matricular o aluno.");
    if (res.ok) {
      setAlunoParaAdicionar({ ...alunoParaAdicionar, [turmaId]: "" });
      carregar();
    }
  }

  async function removerAluno(turmaId: string, alunoId: string) {
    const res = await fetch(`/api/turmas/${turmaId}/alunos`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ alunoId }),
    });
    setFeedback(res.ok ? "Aluno removido da turma." : "Não foi possível remover o aluno.");
    if (res.ok) carregar();
  }

  return (
    <div className="space-y-4">
      <h1 className="font-display text-lg font-semibold">Turmas</h1>
      {feedback && <p className="text-xs text-neutral-500">{feedback}</p>}

      <Card>
        <p className="mb-3 text-sm font-semibold">Nova turma (Sala)</p>
        <div className="space-y-2">
          <Input placeholder="Nome (ex.: Turma 1A)" value={formNova.nome} onChange={(e) => setFormNova({ ...formNova, nome: e.target.value })} />
          <Input placeholder="Série (ex.: 1º ano)" value={formNova.serie} onChange={(e) => setFormNova({ ...formNova, serie: e.target.value })} />
          {erroNova && <p className="text-xs text-red-600">{erroNova}</p>}
          <Button className="w-full" disabled={salvando || !formNova.nome || !formNova.serie} onClick={criar}>
            {salvando ? "Salvando…" : "Criar turma"}
          </Button>
        </div>
      </Card>

      <div className="space-y-3">
        {turmas.map((t) =>
          editandoId === t.id ? (
            <Card key={t.id}>
              <div className="space-y-2">
                <Input placeholder="Nome" value={formEdicao.nome} onChange={(e) => setFormEdicao({ ...formEdicao, nome: e.target.value })} />
                <Input placeholder="Série" value={formEdicao.serie} onChange={(e) => setFormEdicao({ ...formEdicao, serie: e.target.value })} />
                {erroEdicao && <p className="text-xs text-red-600">{erroEdicao}</p>}
                <div className="flex gap-2">
                  <Button size="sm" disabled={salvando || !formEdicao.nome || !formEdicao.serie} onClick={() => salvarEdicao(t.id)}>
                    {salvando ? "Salvando…" : "Salvar"}
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => setEditandoId(null)}>
                    Cancelar
                  </Button>
                </div>
              </div>
            </Card>
          ) : (
            <Card key={t.id}>
              <div className="mb-1 flex items-center justify-between">
                <p className="text-sm font-semibold">{t.nome}</p>
                <Badge variant={t.ativo ? "success" : "danger"}>{t.ativo ? "Ativa" : "Inativa"}</Badge>
              </div>
              <p className="mb-2 text-xs text-neutral-500">
                {t.serie} · {t.alunos.length} alunos matriculados este ano
              </p>
              <div className="mb-2 flex gap-2">
                <Button size="sm" variant="outline" onClick={() => iniciarEdicao(t)}>
                  Editar
                </Button>
                <Button size="sm" variant="outline" onClick={() => alternarAtivo(t)}>
                  {t.ativo ? "Desativar" : "Ativar"}
                </Button>
              </div>
              <div className="mb-2 flex gap-2">
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

              <div className="border-t border-neutral-200 pt-2 dark:border-neutral-700">
                <p className="mb-1.5 text-xs font-medium text-neutral-500">Alunos matriculados</p>
                {t.alunos.length === 0 ? (
                  <p className="mb-2 text-xs text-neutral-400">Nenhum aluno nesta turma ainda.</p>
                ) : (
                  <div className="mb-2 flex flex-wrap gap-1.5">
                    {t.alunos.map((a) => (
                      <span
                        key={a.id}
                        className="flex items-center gap-1 rounded-full border border-neutral-200 px-2 py-1 text-xs dark:border-neutral-700"
                      >
                        {a.nome}
                        <button
                          type="button"
                          onClick={() => removerAluno(t.id, a.id)}
                          className="text-neutral-400 hover:text-red-600"
                          aria-label={`Remover ${a.nome}`}
                        >
                          ×
                        </button>
                      </span>
                    ))}
                  </div>
                )}
                <div className="flex gap-2">
                  <select
                    className="h-10 flex-1 rounded-xl2 border border-neutral-300 bg-white px-2 text-xs dark:border-neutral-700 dark:bg-graphite-soft"
                    value={alunoParaAdicionar[t.id] ?? ""}
                    onChange={(e) => setAlunoParaAdicionar({ ...alunoParaAdicionar, [t.id]: e.target.value })}
                  >
                    <option value="">Adicionar aluno…</option>
                    {alunos
                      .filter((a) => !t.alunos.some((ta) => ta.id === a.id))
                      .map((a) => (
                        <option key={a.id} value={a.id}>
                          {a.nome}
                        </option>
                      ))}
                  </select>
                  <Button size="sm" onClick={() => adicionarAluno(t.id)} disabled={!alunoParaAdicionar[t.id]}>
                    Adicionar
                  </Button>
                </div>
              </div>
            </Card>
          )
        )}
      </div>
    </div>
  );
}
