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

    // Da saldo tambem pra turma/Casa (independente do credito ao aluno, ja
    // que RN-01 nao propaga mais - ver INVESTIMENTOS.md), so pra confirmar
    // que o resgate INDIVIDUAL nao mexe nesses valores de jeito nenhum.
    await prisma.turmaPeriodo.update({
      where: { turmaId_anoLetivoId: { turmaId: turmaA.id, anoLetivoId: anoLetivo.id } },
      data: { saldoAtual: 50 },
    });
    await prisma.casaPeriodo.update({
      where: { casaId_anoLetivoId: { casaId: casaA.id, anoLetivoId: anoLetivo.id } },
      data: { saldoAtual: 50 },
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

describe("Solicitar resgate individual sem saldo e barrado JA no pedido", () => {
  it("aluno com saldo 0 nao consegue nem solicitar um item que custa 20 - nenhum resgate e criado", async () => {
    const { alunoA1 } = await criarFixtureBase();
    // Aluno comeca com saldo 0 - nenhum credito.

    const item = await criarItemIndividual(20);
    await expect(
      solicitarResgate({ itemId: item.id, escopo: "individual", alunoId: alunoA1.id, solicitanteId: alunoA1.id })
    ).rejects.toMatchObject({ status: 400 });

    expect(await prisma.resgate.count()).toBe(0);
  });
});

describe("RN-06 - saldo nunca negativo", () => {
  it("aprovar resgate individual quando o saldo caiu DEPOIS do pedido falha e nao altera nada", async () => {
    const { alunoA1, admin, turmaA, professorPec } = await criarFixtureBase();

    // Aluno tem saldo suficiente no momento do pedido...
    await distribuirPontos({
      turmaId: turmaA.id,
      alunoIds: [alunoA1.id],
      valor: 20,
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

    // ...mas gasta em outra coisa antes de a aprovacao acontecer.
    await prisma.usuario.update({ where: { id: alunoA1.id }, data: { saldoAtual: 0 } });

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
