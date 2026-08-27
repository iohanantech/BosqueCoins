import { describe, it, expect, vi } from "vitest";
import { NextRequest } from "next/server";
import { prisma } from "./setup";
import { criarFixtureBase } from "./fixtures";
import { distribuirPontos } from "@/lib/services/pointsService";
import { buscarRankingTurmas } from "@/lib/services/rankingService";

let sessao: { user: { id: string; email?: string; papel: "admin" | "professor" | "aluno" } } | null = null;
vi.mock("next-auth", () => ({ getServerSession: () => Promise.resolve(sessao) }));

describe("P4 - so um professor pode ser PEC de uma turma", () => {
  it("atribuir um ALUNO como PEC falha com 400; nenhum vinculo e criado", async () => {
    const { admin, alunoA1, turmaA } = await criarFixtureBase();
    sessao = { user: { id: admin.id, email: admin.email, papel: "admin" } };
    const { POST } = await import("@/app/api/admin/pec-turmas/route");
    const res = await POST(
      new NextRequest("http://x/api/admin/pec-turmas", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ professorId: alunoA1.id, turmaId: turmaA.id }),
      })
    );
    expect(res.status).toBe(400);
    expect(await prisma.professorPecTurma.count({ where: { professorId: alunoA1.id } })).toBe(0);
  });

  it("atribuir um professor de verdade continua funcionando (201)", async () => {
    const { admin, professorComum, turmaB } = await criarFixtureBase();
    sessao = { user: { id: admin.id, email: admin.email, papel: "admin" } };
    const { POST } = await import("@/app/api/admin/pec-turmas/route");
    const res = await POST(
      new NextRequest("http://x/api/admin/pec-turmas", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ professorId: professorComum.id, turmaId: turmaB.id }),
      })
    );
    expect(res.status).toBe(201);
  });

  it("turma inexistente falha com 404", async () => {
    const { admin, professorComum } = await criarFixtureBase();
    sessao = { user: { id: admin.id, email: admin.email, papel: "admin" } };
    const { POST } = await import("@/app/api/admin/pec-turmas/route");
    const res = await POST(
      new NextRequest("http://x/api/admin/pec-turmas", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ professorId: professorComum.id, turmaId: "00000000-0000-0000-0000-000000000000" }),
      })
    );
    expect(res.status).toBe(404);
  });
});

describe("P5 - a data do lancamento e sempre a do servidor", () => {
  it("o campo `data` no payload de /points/individual e ignorado (nao forja o extrato)", async () => {
    const { turmaA, alunoA1, professorPec } = await criarFixtureBase();
    sessao = { user: { id: professorPec.id, papel: "professor" } };
    const { POST } = await import("@/app/api/points/individual/route");
    const antes = Date.now();
    const res = await POST(
      new NextRequest("http://x/api/points/individual", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          turmaId: turmaA.id,
          alunoIds: [alunoA1.id],
          valor: 5,
          motivo: "teste",
          data: "2020-01-01T00:00:00.000Z", // forjado - deve ser ignorado
        }),
      })
    );
    expect(res.status).toBe(201);

    const t = await prisma.transacao.findFirstOrThrow({ where: { destinoId: alunoA1.id } });
    expect(t.criadoEm.getTime()).toBeGreaterThanOrEqual(antes - 1000);
    expect(t.criadoEm.getFullYear()).toBe(new Date().getFullYear());
  });
});

describe("P9 - contagem de alunos do ranking numa consulta so", () => {
  it("buscarRankingTurmas devolve quantidadeAlunos correta por turma", async () => {
    const { turmaA, turmaB, anoLetivo, alunoA1, alunoA2, alunoB1, professorPec } = await criarFixtureBase();
    // fixture: alunoA1 e alunoA2 em turmaA, alunoB1 em turmaB.
    await distribuirPontos({
      turmaId: turmaA.id,
      alunoIds: [alunoA1.id],
      valor: 10,
      motivo: "base",
      autorId: professorPec.id,
      autorPapel: "professor",
    });

    const ranking = await buscarRankingTurmas(anoLetivo.id, "total");
    const a = ranking.find((r) => r.turmaId === turmaA.id)!;
    const b = ranking.find((r) => r.turmaId === turmaB.id)!;
    expect(a.quantidadeAlunos).toBe(2);
    expect(b.quantidadeAlunos).toBe(1);
    void alunoA2;
    void alunoB1;
  });
});
