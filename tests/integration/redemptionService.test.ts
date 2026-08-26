import { describe, it, expect } from "vitest";
import { prisma } from "./setup";
import { criarFixtureBase } from "./fixtures";
import { solicitarResgate, resolverResgate } from "@/lib/services/redemptionService";
import { distribuirPontos } from "@/lib/services/pointsService";
import { ApiError } from "@/lib/auth/server";

async function criarItemIndividual(custo: number) {
  return prisma.itemCatalogo.create({
    data: { nome: "Caneca", descricao: "x", custo, categoria: "Brindes", escopo: "individual" },
  });
}

async function criarItemTurma(custo: number) {
  return prisma.itemCatalogo.create({
    data: { nome: "Passeio", descricao: "x", custo, categoria: "Experiencias", escopo: "turma" },
  });
}

describe("RN-04 - resgate individual isolado", () => {
  it("aprovar resgate individual so debita o saldo pessoal ATUAL do aluno - nao mexe em turma/Casa nem acumulado", async () => {
    const { turmaA, alunoA1, professorPec, admin, casaA, anoLetivo } = await criarFixtureBase();

    await distribuirPontos({
      turmaId: turmaA.id,
      alunoIds: [alunoA1.id],
      valor: 50,
      motivo: "Base",
      autorId: professorPec.id,
      autorPapel: "professor",
    });

    const item = await criarItemIndividual(20);
    const resgate = await solicitarResgate({
      itemId: item.id,
      escopo: "individual",
      alunoId: alunoA1.id,
      solicitanteId: alunoA1.id,
    });

    await resolverResgate({
      resgateId: resgate.id,
      aprovadorId: admin.id,
      aprovadorPapel: "admin",
      decisao: "aprovado",
    });

    const aluno = await prisma.usuario.findUniqueOrThrow({ where: { id: alunoA1.id } });
    expect(aluno.saldoAtual).toBe(30); // 50 - 20
    expect(aluno.saldoAcumulado).toBe(50); // resgate NAO mexe no acumulado (RN-04)

    const turmaPeriodo = await prisma.turmaPeriodo.findUniqueOrThrow({
      where: { turmaId_anoLetivoId: { turmaId: turmaA.id, anoLetivoId: anoLetivo.id } },
    });
    expect(turmaPeriodo.saldoAtual).toBe(50); // intacto

    const casaPeriodo = await prisma.casaPeriodo.findUniqueOrThrow({
      where: { casaId_anoLetivoId: { casaId: casaA.id, anoLetivoId: anoLetivo.id } },
    });
    expect(casaPeriodo.saldoAtual).toBe(50); // intacto
  });
});

describe("RN-06 - saldo nunca negativo", () => {
  it("aprovar resgate individual que deixaria saldo negativo falha e nao altera nada", async () => {
    const { alunoA1, admin } = await criarFixtureBase();
    // Aluno comeca com saldo 0 - nenhum credito.

    const item = await criarItemIndividual(20);
    const resgate = await solicitarResgate({
      itemId: item.id,
      escopo: "individual",
      alunoId: alunoA1.id,
      solicitanteId: alunoA1.id,
    });

    await expect(
      resolverResgate({
        resgateId: resgate.id,
        aprovadorId: admin.id,
        aprovadorPapel: "admin",
        decisao: "aprovado",
      })
    ).rejects.toThrow(ApiError);

    const aluno = await prisma.usuario.findUniqueOrThrow({ where: { id: alunoA1.id } });
    expect(aluno.saldoAtual).toBe(0);

    const resgateAtualizado = await prisma.resgate.findUniqueOrThrow({ where: { id: resgate.id } });
    expect(resgateAtualizado.status).toBe("pendente"); // nao foi alterado
  });

  it("aprovar resgate de turma que deixaria saldo negativo falha e nao altera nada", async () => {
    const { turmaA, admin } = await criarFixtureBase();
    // TurmaPeriodo comeca com saldo 0.

    const item = await criarItemTurma(100);
    const resgate = await solicitarResgate({
      itemId: item.id,
      escopo: "turma",
      turmaId: turmaA.id,
      solicitanteId: admin.id,
    });

    await expect(
      resolverResgate({
        resgateId: resgate.id,
        aprovadorId: admin.id,
        aprovadorPapel: "admin",
        decisao: "aprovado",
      })
    ).rejects.toThrow(ApiError);

    const resgateAtualizado = await prisma.resgate.findUniqueOrThrow({ where: { id: resgate.id } });
    expect(resgateAtualizado.status).toBe("pendente");
  });
});
