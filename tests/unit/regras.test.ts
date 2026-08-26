import { describe, it, expect } from "vitest";
import {
  validarLimiteValorPorLote,
  validarMotivo,
  validarValorInteiroPositivo,
  validarDebitoNaoNegativo,
  validarQuemPontuaProfessor,
  validarEscopoPec,
  calcularPropagacaoCredito,
  calcularDebitoResgateIndividual,
  calcularAjusteTurma,
  calcularMediaPorAluno,
  ordenarRankingTurmas,
  excluirProfessoresDoRanking,
  itemPermiteEscopo,
  LIMITE_PROFESSOR_COMUM_POR_LOTE,
} from "@/lib/services/regras";

describe("RN-14 — limite de valor para professor comum", () => {
  it("bloqueia professor comum acima de 10 por aluno/lote", () => {
    const r = validarLimiteValorPorLote(11, { papel: "professor", ehPecDaTurmaAlvo: false });
    expect(r.valido).toBe(false);
  });

  it("permite professor comum exatamente no limite (10)", () => {
    const r = validarLimiteValorPorLote(LIMITE_PROFESSOR_COMUM_POR_LOTE, {
      papel: "professor",
      ehPecDaTurmaAlvo: false,
    });
    expect(r.valido).toBe(true);
  });

  it("PEC nao tem limite na turma que administra", () => {
    const r = validarLimiteValorPorLote(500, { papel: "professor", ehPecDaTurmaAlvo: true });
    expect(r.valido).toBe(true);
  });

  it("admin nunca tem limite", () => {
    const r = validarLimiteValorPorLote(9999, { papel: "admin", ehPecDaTurmaAlvo: false });
    expect(r.valido).toBe(true);
  });

  it("mesmo professor, em turma que NAO administra como PEC, volta a ter limite (secao 12 item 5)", () => {
    const r = validarLimiteValorPorLote(50, { papel: "professor", ehPecDaTurmaAlvo: false });
    expect(r.valido).toBe(false);
  });
});

describe("RN-03 — motivo obrigatorio", () => {
  it("rejeita motivo vazio", () => {
    expect(validarMotivo("").valido).toBe(false);
  });
  it("rejeita motivo so com espacos", () => {
    expect(validarMotivo("    ").valido).toBe(false);
  });
  it("aceita motivo valido", () => {
    expect(validarMotivo("Participacao na aula").valido).toBe(true);
  });
});

describe("Valor inteiro positivo (BosqueCoins sem centavos)", () => {
  it("rejeita zero", () => expect(validarValorInteiroPositivo(0).valido).toBe(false));
  it("rejeita negativo", () => expect(validarValorInteiroPositivo(-5).valido).toBe(false));
  it("rejeita decimal", () => expect(validarValorInteiroPositivo(2.5).valido).toBe(false));
  it("aceita inteiro positivo", () => expect(validarValorInteiroPositivo(5).valido).toBe(true));
});

describe("RN-06 — saldo nunca negativo", () => {
  it("rejeita debito que deixaria saldo negativo", () => {
    expect(validarDebitoNaoNegativo(5, 10).valido).toBe(false);
  });
  it("aceita debito que zera exatamente", () => {
    expect(validarDebitoNaoNegativo(10, 10).valido).toBe(true);
  });
});

describe("RN-12 — so admin pontua professor", () => {
  it("rejeita professor", () => expect(validarQuemPontuaProfessor("professor").valido).toBe(false));
  it("rejeita aluno", () => expect(validarQuemPontuaProfessor("aluno").valido).toBe(false));
  it("aceita admin", () => expect(validarQuemPontuaProfessor("admin").valido).toBe(true));
});

describe("RN-09 — escopo do PEC", () => {
  it("bloqueia turma fora do escopo do PEC no ano vigente", () => {
    const r = validarEscopoPec("turma-3", ["turma-1", "turma-2"]);
    expect(r.valido).toBe(false);
  });
  it("permite turma dentro do escopo", () => {
    const r = validarEscopoPec("turma-2", ["turma-1", "turma-2"]);
    expect(r.valido).toBe(true);
  });
});

describe("RN-01 — propagacao tripla", () => {
  it("credito de N pontos soma N em aluno, turma e casa, atual e acumulado", () => {
    const delta = calcularPropagacaoCredito(7);
    expect(delta.aluno).toEqual({ saldoAtual: 7, saldoAcumulado: 7 });
    expect(delta.turma).toEqual({ saldoAtual: 7, saldoAcumulado: 7 });
    expect(delta.casa).toEqual({ saldoAtual: 7, saldoAcumulado: 7 });
  });
});

describe("RN-04 — resgate individual nao afeta agregados", () => {
  it("so gera delta de saldoAtual do aluno, nada de turma/casa/acumulado", () => {
    const delta = calcularDebitoResgateIndividual(15);
    expect(delta).toEqual({ saldoAtual: -15 });
  });
});

describe("RN-05 — ajuste de PEC so mexe na turma", () => {
  it("credito de ajuste soma em atual e acumulado", () => {
    expect(calcularAjusteTurma(10, "credito")).toEqual({ saldoAtual: 10, saldoAcumulado: 10 });
  });
  it("debito de ajuste subtrai de atual e acumulado", () => {
    expect(calcularAjusteTurma(10, "debito")).toEqual({ saldoAtual: -10, saldoAcumulado: -10 });
  });
});

describe("Ranking de Salas — total vs media por aluno", () => {
  const turmas = [
    { turmaId: "a", nome: "Turma A (5 alunos)", saldoAtual: 100, saldoAcumulado: 100, quantidadeAlunos: 5 },
    { turmaId: "b", nome: "Turma B (12 alunos)", saldoAtual: 180, saldoAcumulado: 180, quantidadeAlunos: 12 },
  ];

  it("modo total: turma com mais pontos brutos vence, mesmo com media menor", () => {
    const ranking = ordenarRankingTurmas(turmas, "total");
    expect(ranking[0]?.turmaId).toBe("b"); // 180 > 100
  });

  it("modo media: turma com menos alunos mas melhor media vence", () => {
    const ranking = ordenarRankingTurmas(turmas, "media");
    // A: 100/5=20, B: 180/12=15 -> A vence na media
    expect(ranking[0]?.turmaId).toBe("a");
  });

  it("media por aluno nao quebra com turma vazia", () => {
    expect(calcularMediaPorAluno(50, 0)).toBe(0);
  });
});

describe("RN-13 — professor fora dos rankings", () => {
  it("filtra entradas com destinoTipo=professor antes de agregar", () => {
    const itens = [
      { destinoTipo: "aluno", valor: 5 },
      { destinoTipo: "professor", valor: 100 },
      { destinoTipo: "turma", valor: 3 },
    ];
    const filtrado = excluirProfessoresDoRanking(itens);
    expect(filtrado).toHaveLength(2);
    expect(filtrado.some((i) => i.destinoTipo === "professor")).toBe(false);
  });
});

describe("Escopo de itens do catalogo", () => {
  it("item 'ambos' aparece em qualquer escopo desejado", () => {
    expect(itemPermiteEscopo("ambos", "individual")).toBe(true);
    expect(itemPermiteEscopo("ambos", "turma")).toBe(true);
  });
  it("item 'individual' nao aparece para escopo turma", () => {
    expect(itemPermiteEscopo("individual", "turma")).toBe(false);
  });
  it("item 'turma' nao aparece para escopo individual", () => {
    expect(itemPermiteEscopo("turma", "individual")).toBe(false);
  });
});
