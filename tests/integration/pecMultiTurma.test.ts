import { describe, it, expect, vi } from "vitest";
import { NextRequest } from "next/server";
import { prisma } from "./setup";
import { criarFixtureBase } from "./fixtures";
import { distribuirPontos } from "@/lib/services/pointsService";

/**
 * PEC administrando MULTIPLAS turmas simultaneamente (secao 12, pressuposto
 * 5 - a especificacao permite isso). Item pendente do CLAUDE.md (Fase 5):
 * confirma que o vinculo professor_pec_turmas funciona corretamente quando
 * ha mais de uma linha para o mesmo professor no mesmo ano letivo.
 */

let sessaoMockada: { user: { id: string; papel: "admin" | "professor" | "aluno" } } | null = null;
vi.mock("next-auth", () => ({ getServerSession: () => Promise.resolve(sessaoMockada) }));

async function tornarPecDaTurmaB(professorId: string, turmaBId: string, anoLetivoId: string) {
  await prisma.professorPecTurma.create({ data: { professorId, turmaId: turmaBId, anoLetivoId } });
}

describe("PEC de multiplas turmas ao mesmo tempo", () => {
  it("sem limite de RN-14 em NENHUMA das duas turmas que administra", async () => {
    const { turmaA, turmaB, alunoA1, alunoB1, professorPec, anoLetivo } = await criarFixtureBase();
    await tornarPecDaTurmaB(professorPec.id, turmaB.id, anoLetivo.id);

    await distribuirPontos({
      turmaId: turmaA.id,
      alunoIds: [alunoA1.id],
      valor: 300,
      motivo: "Turma A",
      autorId: professorPec.id,
      autorPapel: "professor",
    });
    await distribuirPontos({
      turmaId: turmaB.id,
      alunoIds: [alunoB1.id],
      valor: 400,
      motivo: "Turma B",
      autorId: professorPec.id,
      autorPapel: "professor",
    });

    const a1 = await prisma.usuario.findUniqueOrThrow({ where: { id: alunoA1.id } });
    const b1 = await prisma.usuario.findUniqueOrThrow({ where: { id: alunoB1.id } });
    expect(a1.saldoAtual).toBe(300);
    expect(b1.saldoAtual).toBe(400);
  });

  it("pode fazer ajuste manual de saldo (RN-05) nas DUAS turmas via API (RN-09)", async () => {
    const { turmaA, turmaB, professorPec, anoLetivo } = await criarFixtureBase();
    await tornarPecDaTurmaB(professorPec.id, turmaB.id, anoLetivo.id);
    sessaoMockada = { user: { id: professorPec.id, papel: "professor" } };
    const { POST } = await import("@/app/api/points/turma/route");

    for (const turma of [turmaA, turmaB]) {
      const req = new NextRequest("http://localhost/api/points/turma", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ turmaId: turma.id, valor: 25, direcao: "credito", motivo: "Ajuste" }),
      });
      const res = await POST(req);
      expect(res.status).toBe(201);
    }

    const periodoA = await prisma.turmaPeriodo.findUniqueOrThrow({
      where: { turmaId_anoLetivoId: { turmaId: turmaA.id, anoLetivoId: anoLetivo.id } },
    });
    const periodoB = await prisma.turmaPeriodo.findUniqueOrThrow({
      where: { turmaId_anoLetivoId: { turmaId: turmaB.id, anoLetivoId: anoLetivo.id } },
    });
    expect(periodoA.saldoAtual).toBe(25);
    expect(periodoB.saldoAtual).toBe(25);
  });

  it("GET /api/redemptions inclui resgates (turma e individuais) das DUAS turmas administradas", async () => {
    const { turmaB, alunoA1, alunoB1, professorPec, anoLetivo } = await criarFixtureBase();
    await tornarPecDaTurmaB(professorPec.id, turmaB.id, anoLetivo.id);

    const itemIndividual = await prisma.itemCatalogo.create({
      data: { nome: "Caneca", descricao: "x", custo: 10, categoria: "Brindes", escopo: "individual" },
    });
    const itemTurma = await prisma.itemCatalogo.create({
      data: { nome: "Passeio", descricao: "x", custo: 10, categoria: "Experiencias", escopo: "turma" },
    });

    await prisma.resgate.create({
      data: {
        anoLetivoId: anoLetivo.id,
        itemId: itemIndividual.id,
        escopoUsado: "individual",
        alunoId: alunoA1.id,
        solicitanteId: alunoA1.id,
        valorDebitado: 10,
      },
    });
    await prisma.resgate.create({
      data: {
        anoLetivoId: anoLetivo.id,
        itemId: itemIndividual.id,
        escopoUsado: "individual",
        alunoId: alunoB1.id,
        solicitanteId: alunoB1.id,
        valorDebitado: 10,
      },
    });
    await prisma.resgate.create({
      data: {
        anoLetivoId: anoLetivo.id,
        itemId: itemTurma.id,
        escopoUsado: "turma",
        turmaId: turmaB.id,
        solicitanteId: professorPec.id,
        valorDebitado: 10,
      },
    });

    sessaoMockada = { user: { id: professorPec.id, papel: "professor" } };
    const { GET } = await import("@/app/api/redemptions/route");
    const res = await GET();
    const resgates = (await res.json()) as { alunoId: string | null; turmaId: string | null }[];

    expect(resgates).toHaveLength(3);
    expect(resgates.some((r) => r.alunoId === alunoA1.id)).toBe(true);
    expect(resgates.some((r) => r.alunoId === alunoB1.id)).toBe(true);
    expect(resgates.some((r) => r.turmaId === turmaB.id)).toBe(true);
  });

  it("RN-09 continua valendo: PEC de A e B nao pode agir numa terceira turma que nao administra", async () => {
    const { turmaB, professorPec, anoLetivo } = await criarFixtureBase();
    await tornarPecDaTurmaB(professorPec.id, turmaB.id, anoLetivo.id);

    const turmaC = await prisma.turma.create({ data: { nome: "Turma C", serie: "3º ano" } });
    await prisma.turmaPeriodo.create({ data: { turmaId: turmaC.id, anoLetivoId: anoLetivo.id } });

    sessaoMockada = { user: { id: professorPec.id, papel: "professor" } };
    const { POST } = await import("@/app/api/points/turma/route");
    const req = new NextRequest("http://localhost/api/points/turma", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ turmaId: turmaC.id, valor: 25, direcao: "credito", motivo: "Ajuste" }),
    });
    const res = await POST(req);
    expect(res.status).toBe(403);
  });
});
