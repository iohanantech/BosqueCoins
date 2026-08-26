import { describe, it, expect } from "vitest";
import { prisma } from "./setup";
import { criarFixtureBase } from "./fixtures";
import { distribuirPontos, pontuarProfessor, ajustarSaldoTurma } from "@/lib/services/pointsService";
import { buscarRankingTurmas, buscarRankingCasas } from "@/lib/services/rankingService";
import { ApiError } from "@/lib/auth/server";

describe("RN-01 + RN-02 - propagacao tripla atomica", () => {
  it("credita aluno, turma e Casa ao mesmo tempo, atual e acumulado", async () => {
    const { turmaA, alunoA1, professorComum, anoLetivo, casaA } = await criarFixtureBase();

    await distribuirPontos({
      turmaId: turmaA.id,
      alunoIds: [alunoA1.id],
      valor: 7,
      motivo: "Participação",
      autorId: professorComum.id,
      autorPapel: "professor",
    });

    const aluno = await prisma.usuario.findUniqueOrThrow({ where: { id: alunoA1.id } });
    expect(aluno.saldoAtual).toBe(7);
    expect(aluno.saldoAcumulado).toBe(7);

    const turmaPeriodo = await prisma.turmaPeriodo.findUniqueOrThrow({
      where: { turmaId_anoLetivoId: { turmaId: turmaA.id, anoLetivoId: anoLetivo.id } },
    });
    expect(turmaPeriodo.saldoAtual).toBe(7);
    expect(turmaPeriodo.saldoAcumulado).toBe(7);

    const casaPeriodo = await prisma.casaPeriodo.findUniqueOrThrow({
      where: { casaId_anoLetivoId: { casaId: casaA.id, anoLetivoId: anoLetivo.id } },
    });
    expect(casaPeriodo.saldoAtual).toBe(7);
    expect(casaPeriodo.saldoAcumulado).toBe(7);
  });

  it("gera uma transacao por aluno, todas com o mesmo loteId", async () => {
    const { turmaA, alunoA1, alunoA2, professorComum } = await criarFixtureBase();

    const { loteId } = await distribuirPontos({
      turmaId: turmaA.id,
      alunoIds: [alunoA1.id, alunoA2.id],
      valor: 3,
      motivo: "Trabalho em grupo",
      autorId: professorComum.id,
      autorPapel: "professor",
    });

    const transacoes = await prisma.transacao.findMany({ where: { loteId } });
    expect(transacoes).toHaveLength(2);
    expect(transacoes.every((t) => t.loteId === loteId)).toBe(true);
  });
});

describe("RN-14 - limite de 10 por lote para professor comum", () => {
  it("professor comum nao pode dar mais de 10 por aluno por lote", async () => {
    const { turmaA, alunoA1, professorComum } = await criarFixtureBase();

    await expect(
      distribuirPontos({
        turmaId: turmaA.id,
        alunoIds: [alunoA1.id],
        valor: 11,
        motivo: "x",
        autorId: professorComum.id,
        autorPapel: "professor",
      })
    ).rejects.toThrow(ApiError);
  });

  it("PEC pode dar mais de 10 (ex.: 500) na turma que administra", async () => {
    const { turmaA, alunoA1, professorPec } = await criarFixtureBase();

    await distribuirPontos({
      turmaId: turmaA.id,
      alunoIds: [alunoA1.id],
      valor: 500,
      motivo: "Premio especial",
      autorId: professorPec.id,
      autorPapel: "professor",
    });

    const aluno = await prisma.usuario.findUniqueOrThrow({ where: { id: alunoA1.id } });
    expect(aluno.saldoAtual).toBe(500);
  });

  it("o mesmo professor PEC volta ao limite de 10 numa turma que nao administra", async () => {
    const { turmaB, alunoB1, professorPec } = await criarFixtureBase();

    await expect(
      distribuirPontos({
        turmaId: turmaB.id,
        alunoIds: [alunoB1.id],
        valor: 50,
        motivo: "x",
        autorId: professorPec.id,
        autorPapel: "professor",
      })
    ).rejects.toThrow(ApiError);
  });
});

describe("RN-12 + RN-13 - credito a professor", () => {
  it("so admin pode creditar professor", async () => {
    const { professorComum, professorPec } = await criarFixtureBase();

    await expect(
      pontuarProfessor({
        professorDestinoId: professorPec.id,
        valor: 20,
        motivo: "Dedicacao",
        autorId: professorComum.id,
        autorPapel: "professor",
      })
    ).rejects.toThrow(ApiError);
  });

  it("credito a professor nao propaga para turma/Casa nem entra no ranking", async () => {
    const { admin, professorPec, turmaA, anoLetivo } = await criarFixtureBase();

    await pontuarProfessor({
      professorDestinoId: professorPec.id,
      valor: 40,
      motivo: "Dedicacao",
      autorId: admin.id,
      autorPapel: "admin",
    });

    const professor = await prisma.usuario.findUniqueOrThrow({ where: { id: professorPec.id } });
    expect(professor.saldoAtual).toBe(40);

    const turmaPeriodo = await prisma.turmaPeriodo.findUniqueOrThrow({
      where: { turmaId_anoLetivoId: { turmaId: turmaA.id, anoLetivoId: anoLetivo.id } },
    });
    expect(turmaPeriodo.saldoAtual).toBe(0);

    const rankingTurmas = await buscarRankingTurmas(anoLetivo.id);
    const rankingCasas = await buscarRankingCasas(anoLetivo.id);
    expect(rankingTurmas.every((t) => t.saldoAtual === 0)).toBe(true);
    expect(rankingCasas.every((c) => c.saldoAtual === 0)).toBe(true);

    const transacao = await prisma.transacao.findFirst({ where: { destinoId: professorPec.id } });
    expect(transacao?.destinoTipo).toBe("professor");
  });
});

describe("RN-05 - ajuste manual de saldo da turma", () => {
  it("ajuste so mexe no saldo da turma, nunca em aluno/Casa", async () => {
    const { turmaA, professorPec, alunoA1, casaA, anoLetivo } = await criarFixtureBase();

    await ajustarSaldoTurma({
      turmaId: turmaA.id,
      valor: 30,
      direcao: "credito",
      motivo: "Correcao",
      autorId: professorPec.id,
      autorPapel: "professor",
    });

    const turmaPeriodo = await prisma.turmaPeriodo.findUniqueOrThrow({
      where: { turmaId_anoLetivoId: { turmaId: turmaA.id, anoLetivoId: anoLetivo.id } },
    });
    expect(turmaPeriodo.saldoAtual).toBe(30);

    const aluno = await prisma.usuario.findUniqueOrThrow({ where: { id: alunoA1.id } });
    expect(aluno.saldoAtual).toBe(0);

    const casaPeriodo = await prisma.casaPeriodo.findUniqueOrThrow({
      where: { casaId_anoLetivoId: { casaId: casaA.id, anoLetivoId: anoLetivo.id } },
    });
    expect(casaPeriodo.saldoAtual).toBe(0);
  });
});
