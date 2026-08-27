import { describe, it, expect } from "vitest";
import { prisma } from "./setup";
import { criarFixtureBase } from "./fixtures";
import { distribuirPontos, ajustarSaldoTurma } from "@/lib/services/pointsService";
import { investir, resgatarInvestimento } from "@/lib/services/investmentService";
import { solicitarResgate, resolverResgate } from "@/lib/services/redemptionService";

/**
 * Testes de corrida (race conditions) para os 3 achados criticos da
 * auditoria de 2026-08-26: em cada um, o mesmo aluno/PEC dispara N
 * requisicoes concorrentes que, ANTES da correcao, passavam TODAS pela
 * validacao de saldo/status (verificado fora da transacao, nunca
 * reconferido dentro dela). Aqui usamos Promise.allSettled porque
 * esperamos que so uma vença - as demais devem rejeitar com ApiError,
 * nao silenciosamente aplicar o efeito de novo.
 */

async function darSaldo(alunoId: string, turmaId: string, professorId: string, valor: number) {
  await distribuirPontos({
    turmaId,
    alunoIds: [alunoId],
    valor,
    motivo: "Base para teste de corrida",
    autorId: professorId,
    autorPapel: "professor",
  });
}

describe("Corrida - investir em Casa/turma (achado crítico 01)", () => {
  it("5 investimentos concorrentes de todo o saldo: so 1 pode vencer, saldo nunca fica negativo", async () => {
    const { alunoA1, turmaA, casaA, professorPec, anoLetivo } = await criarFixtureBase();
    await darSaldo(alunoA1.id, turmaA.id, professorPec.id, 13);

    const resultados = await Promise.allSettled(
      Array.from({ length: 5 }, () => investir({ alunoId: alunoA1.id, tipo: "casa", valor: 13 }))
    );

    const sucesso = resultados.filter((r) => r.status === "fulfilled");
    const falha = resultados.filter((r) => r.status === "rejected");
    expect(sucesso).toHaveLength(1);
    expect(falha).toHaveLength(4);

    const aluno = await prisma.usuario.findUniqueOrThrow({ where: { id: alunoA1.id } });
    expect(aluno.saldoAtual).toBe(0); // nunca negativo

    const casaPeriodo = await prisma.casaPeriodo.findUniqueOrThrow({
      where: { casaId_anoLetivoId: { casaId: casaA.id, anoLetivoId: anoLetivo.id } },
    });
    expect(casaPeriodo.saldoAtual).toBe(13); // so um investimento foi de fato aplicado
  });
});

describe("Corrida - resgatar investimento (achado crítico 02)", () => {
  it("5 resgates concorrentes do MESMO investimento: so 1 credita, moeda nao duplica", async () => {
    const { alunoA1, turmaA, professorPec } = await criarFixtureBase();
    await darSaldo(alunoA1.id, turmaA.id, professorPec.id, 5);

    // Poupanca: carencia 0 (RN-28), entao o resgate pode acontecer no mesmo
    // instante - o que este teste precisa pra provar a corrida do resgate.
    const investimento = await investir({ alunoId: alunoA1.id, tipo: "poupanca", valor: 5 });
    const investimentoId = (investimento as { id: string }).id;

    const resultados = await Promise.allSettled(
      Array.from({ length: 5 }, () => resgatarInvestimento({ investimentoId, alunoId: alunoA1.id }))
    );

    const sucesso = resultados.filter((r) => r.status === "fulfilled");
    expect(sucesso).toHaveLength(1);

    const aluno = await prisma.usuario.findUniqueOrThrow({ where: { id: alunoA1.id } });
    expect(aluno.saldoAtual).toBe(5); // devolveu exatamente o principal 1 vez (sem juros relevantes em poucos ms)

    const transacoesDeCredito = await prisma.transacao.count({
      where: { destinoId: alunoA1.id, tipo: "credito", motivo: { startsWith: "Resgate de poupanca" } },
    });
    expect(transacoesDeCredito).toBe(1); // o log de auditoria tambem prova que so aconteceu 1 vez
  });
});

describe("Corrida - aprovar resgate do catálogo (achado crítico 03)", () => {
  it("5 aprovações concorrentes do MESMO resgate: so 1 debita, estoque nunca fica negativo", async () => {
    const { alunoA1, turmaA, professorPec, admin } = await criarFixtureBase();
    await darSaldo(alunoA1.id, turmaA.id, professorPec.id, 100);

    const item = await prisma.itemCatalogo.create({
      data: { nome: "Caneca", descricao: "x", custo: 30, categoria: "Brindes", escopo: "individual", quantidadeDisponivel: 1 },
    });

    const resgate = await solicitarResgate({
      itemId: item.id,
      escopo: "individual",
      alunoId: alunoA1.id,
      solicitanteId: alunoA1.id,
    });

    const resultados = await Promise.allSettled(
      Array.from({ length: 5 }, () =>
        resolverResgate({ resgateId: resgate.id, aprovadorId: admin.id, aprovadorPapel: "admin", decisao: "aprovado" })
      )
    );

    const sucesso = resultados.filter((r) => r.status === "fulfilled");
    expect(sucesso).toHaveLength(1);

    const aluno = await prisma.usuario.findUniqueOrThrow({ where: { id: alunoA1.id } });
    expect(aluno.saldoAtual).toBe(70); // 100 - 30, cobrado uma unica vez

    const itemAtualizado = await prisma.itemCatalogo.findUniqueOrThrow({ where: { id: item.id } });
    expect(itemAtualizado.quantidadeDisponivel).toBe(0); // nunca negativo
  });
});

describe("Corrida - ajuste de débito do PEC na turma", () => {
  it("5 débitos concorrentes que juntos excedem o saldo: só os que cabem no saldo passam", async () => {
    const { turmaA, professorPec, anoLetivo } = await criarFixtureBase();
    await ajustarSaldoTurma({
      turmaId: turmaA.id,
      valor: 20,
      direcao: "credito",
      motivo: "Base para teste de corrida",
      autorId: professorPec.id,
      autorPapel: "professor",
    });

    const resultados = await Promise.allSettled(
      Array.from({ length: 5 }, () =>
        ajustarSaldoTurma({
          turmaId: turmaA.id,
          valor: 20,
          direcao: "debito",
          motivo: "Debito concorrente",
          autorId: professorPec.id,
          autorPapel: "professor",
        })
      )
    );

    const sucesso = resultados.filter((r) => r.status === "fulfilled");
    expect(sucesso).toHaveLength(1); // só um débito de 20 cabe no saldo de 20

    const turmaPeriodo = await prisma.turmaPeriodo.findUniqueOrThrow({
      where: { turmaId_anoLetivoId: { turmaId: turmaA.id, anoLetivoId: anoLetivo.id } },
    });
    expect(turmaPeriodo.saldoAtual).toBe(0); // nunca negativo
  });
});
