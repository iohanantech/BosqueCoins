import { describe, it, expect } from "vitest";
import { prisma } from "./setup";
import { criarFixtureBase } from "./fixtures";
import { distribuirPontos } from "@/lib/services/pointsService";
import { investir, resgatarInvestimento, resumoInvestimentos, listarInvestimentos } from "@/lib/services/investmentService";
import { calcularValorComJuros } from "@/lib/services/regras";
import { TAXAS_MENSAIS } from "@/lib/config/taxasInvestimento";
import { ApiError } from "@/lib/auth/server";

const DIA = 24 * 60 * 60 * 1000;

async function darSaldo(alunoId: string, turmaId: string, professorId: string, valor: number) {
  await distribuirPontos({
    turmaId,
    alunoIds: [alunoId],
    valor,
    motivo: "Base para teste",
    autorId: professorId,
    autorPapel: "professor",
  });
}

describe("RN-15/17/18 - investir em tipo reversivel (CDB)", () => {
  it("debita o aluno e cria um Investimento ativo com a taxa vigente", async () => {
    const { alunoA1, turmaA, professorPec } = await criarFixtureBase();
    await darSaldo(alunoA1.id, turmaA.id, professorPec.id, 100);

    const investimento = await investir({ alunoId: alunoA1.id, tipo: "cdb", valor: 40 });

    const aluno = await prisma.usuario.findUniqueOrThrow({ where: { id: alunoA1.id } });
    expect(aluno.saldoAtual).toBe(60);
    expect(aluno.saldoAcumulado).toBe(100); // investir nao mexe no acumulado

    expect(investimento).toHaveProperty("id");
    const registro = await prisma.investimento.findUniqueOrThrow({ where: { id: (investimento as { id: string }).id } });
    expect(registro.status).toBe("ativo");
    expect(registro.valorPrincipal).toBe(40);
    expect(registro.taxaMensal).toBe(TAXAS_MENSAIS.cdb);
  });

  it("RN-15/RN-06 - investir mais que o saldo disponivel falha", async () => {
    const { alunoA1, turmaA, professorPec } = await criarFixtureBase();
    await darSaldo(alunoA1.id, turmaA.id, professorPec.id, 10);

    await expect(investir({ alunoId: alunoA1.id, tipo: "cdb", valor: 11 })).rejects.toThrow(ApiError);

    const aluno = await prisma.usuario.findUniqueOrThrow({ where: { id: alunoA1.id } });
    expect(aluno.saldoAtual).toBe(10); // nao mudou
  });
});

describe("RN-18/RN-19 - resgatar um investimento reversivel devolve principal + juros", () => {
  it("juros calculados batem com calcularValorComJuros para os dias decorridos", async () => {
    const { alunoA1, turmaA, professorPec } = await criarFixtureBase();
    await darSaldo(alunoA1.id, turmaA.id, professorPec.id, 100);

    const investimento = await investir({ alunoId: alunoA1.id, tipo: "cdb", valor: 50 });
    const investimentoId = (investimento as { id: string }).id;

    // "Avanca o tempo" manipulando dataInvestimento direto no banco (60 dias atras).
    const seiscentaDiasAtras = new Date(Date.now() - 60 * 24 * 60 * 60 * 1000);
    await prisma.investimento.update({ where: { id: investimentoId }, data: { dataInvestimento: seiscentaDiasAtras } });

    const resultado = await resgatarInvestimento({ investimentoId, alunoId: alunoA1.id });

    const esperado = calcularValorComJuros(50, TAXAS_MENSAIS.cdb, 60);
    expect(resultado.valorResgatado).toBe(esperado);
    expect(resultado.status).toBe("resgatado");

    const aluno = await prisma.usuario.findUniqueOrThrow({ where: { id: alunoA1.id } });
    // saldo esperado: 100 - 50 (investiu) + esperado (resgatou)
    expect(aluno.saldoAtual).toBe(100 - 50 + esperado);
    // acumulado: 100 (base) + juros (principal do resgate nao conta, so o juro)
    expect(aluno.saldoAcumulado).toBe(100 + (esperado - 50));
  });

  it("RN-20 - resgatar um investimento ja resgatado falha, sem alterar nada de novo", async () => {
    const { alunoA1, turmaA, professorPec } = await criarFixtureBase();
    await darSaldo(alunoA1.id, turmaA.id, professorPec.id, 100);

    const investimento = await investir({ alunoId: alunoA1.id, tipo: "poupanca", valor: 30 });
    const investimentoId = (investimento as { id: string }).id;

    await resgatarInvestimento({ investimentoId, alunoId: alunoA1.id });
    const saldoAposPrimeiroResgate = (await prisma.usuario.findUniqueOrThrow({ where: { id: alunoA1.id } })).saldoAtual;

    await expect(resgatarInvestimento({ investimentoId, alunoId: alunoA1.id })).rejects.toThrow(ApiError);

    const saldoFinal = (await prisma.usuario.findUniqueOrThrow({ where: { id: alunoA1.id } })).saldoAtual;
    expect(saldoFinal).toBe(saldoAposPrimeiroResgate); // nao mudou de novo
  });
});

describe("RN-16 - investir em Casa/turma e irreversivel", () => {
  it("investir em Casa credita a Casa do proprio aluno, debita o aluno, e NAO cria Investimento", async () => {
    const { alunoA1, turmaA, casaA, professorPec, anoLetivo } = await criarFixtureBase();
    await darSaldo(alunoA1.id, turmaA.id, professorPec.id, 100);

    await investir({ alunoId: alunoA1.id, tipo: "casa", valor: 35 });

    const aluno = await prisma.usuario.findUniqueOrThrow({ where: { id: alunoA1.id } });
    expect(aluno.saldoAtual).toBe(65);
    expect(aluno.saldoAcumulado).toBe(100); // investir nao mexe no acumulado do aluno

    const casaPeriodo = await prisma.casaPeriodo.findUniqueOrThrow({
      where: { casaId_anoLetivoId: { casaId: casaA.id, anoLetivoId: anoLetivo.id } },
    });
    expect(casaPeriodo.saldoAtual).toBe(35);
    expect(casaPeriodo.saldoAcumulado).toBe(35);

    const registros = await prisma.investimento.findMany({ where: { alunoId: alunoA1.id } });
    expect(registros).toHaveLength(0); // irreversivel nao gera Investimento resgatavel
  });

  it("investir em turma credita a turma matriculada do aluno no ano vigente", async () => {
    const { alunoA1, turmaA, professorPec, anoLetivo } = await criarFixtureBase();
    await darSaldo(alunoA1.id, turmaA.id, professorPec.id, 100);

    await investir({ alunoId: alunoA1.id, tipo: "turma", valor: 20 });

    const turmaPeriodo = await prisma.turmaPeriodo.findUniqueOrThrow({
      where: { turmaId_anoLetivoId: { turmaId: turmaA.id, anoLetivoId: anoLetivo.id } },
    });
    expect(turmaPeriodo.saldoAtual).toBe(20);
  });

  it("nao existe nenhum caminho de codigo que reverta um investimento em Casa/turma", async () => {
    const { alunoA1, turmaA, professorPec } = await criarFixtureBase();
    await darSaldo(alunoA1.id, turmaA.id, professorPec.id, 100);
    await investir({ alunoId: alunoA1.id, tipo: "casa", valor: 20 });

    // Nao ha Investimento para resgatar - tentar resgatar qualquer id aleatorio falha.
    await expect(resgatarInvestimento({ investimentoId: "00000000-0000-0000-0000-000000000000", alunoId: alunoA1.id })).rejects.toThrow(
      ApiError
    );
  });
});

describe("Doação (Dízimo/Lar do Idoso) - irreversível, sem placar coletivo", () => {
  it("debita o aluno, gera 1 transacao de debito, e NAO credita nenhuma Casa/turma nem cria Investimento", async () => {
    const { alunoA1, turmaA, casaA, professorPec, anoLetivo } = await criarFixtureBase();
    await darSaldo(alunoA1.id, turmaA.id, professorPec.id, 100);

    await investir({ alunoId: alunoA1.id, tipo: "dizimo", valor: 25 });

    const aluno = await prisma.usuario.findUniqueOrThrow({ where: { id: alunoA1.id } });
    expect(aluno.saldoAtual).toBe(75);
    expect(aluno.saldoAcumulado).toBe(100); // doacao nao mexe no acumulado, igual investir

    const casaPeriodo = await prisma.casaPeriodo.findUniqueOrThrow({
      where: { casaId_anoLetivoId: { casaId: casaA.id, anoLetivoId: anoLetivo.id } },
    });
    expect(casaPeriodo.saldoAtual).toBe(0); // NAO foi creditada - doacao nao e coletivo

    const turmaPeriodo = await prisma.turmaPeriodo.findUniqueOrThrow({
      where: { turmaId_anoLetivoId: { turmaId: turmaA.id, anoLetivoId: anoLetivo.id } },
    });
    expect(turmaPeriodo.saldoAtual).toBe(0);

    const registros = await prisma.investimento.findMany({ where: { alunoId: alunoA1.id } });
    expect(registros).toHaveLength(0); // irreversivel, sem registro resgatavel (igual Casa/turma)

    const transacoes = await prisma.transacao.findMany({ where: { origemUsuarioId: alunoA1.id, tipo: "debito" } });
    expect(transacoes).toHaveLength(1);
    expect(transacoes[0]?.motivo).toContain("Dízimo");
  });

  it("investir em lar_idoso tambem funciona, e nao pode ser resgatado", async () => {
    const { alunoA1, turmaA, professorPec } = await criarFixtureBase();
    await darSaldo(alunoA1.id, turmaA.id, professorPec.id, 50);

    await investir({ alunoId: alunoA1.id, tipo: "lar_idoso", valor: 10 });

    const aluno = await prisma.usuario.findUniqueOrThrow({ where: { id: alunoA1.id } });
    expect(aluno.saldoAtual).toBe(40);

    await expect(
      resgatarInvestimento({ investimentoId: "00000000-0000-0000-0000-000000000000", alunoId: alunoA1.id })
    ).rejects.toThrow(ApiError);
  });

  it("RN-06 - doar mais do que o saldo disponivel falha, sem alterar nada", async () => {
    const { alunoA1, turmaA, professorPec } = await criarFixtureBase();
    await darSaldo(alunoA1.id, turmaA.id, professorPec.id, 10);

    await expect(investir({ alunoId: alunoA1.id, tipo: "dizimo", valor: 11 })).rejects.toThrow(ApiError);

    const aluno = await prisma.usuario.findUniqueOrThrow({ where: { id: alunoA1.id } });
    expect(aluno.saldoAtual).toBe(10);
  });

  it("resumoInvestimentos soma o total doado separadamente do total coletivo", async () => {
    const { alunoA1, turmaA, professorPec } = await criarFixtureBase();
    await darSaldo(alunoA1.id, turmaA.id, professorPec.id, 100);

    await investir({ alunoId: alunoA1.id, tipo: "casa", valor: 20 });
    await investir({ alunoId: alunoA1.id, tipo: "dizimo", valor: 15 });
    await investir({ alunoId: alunoA1.id, tipo: "lar_idoso", valor: 5 });

    const resumo = await resumoInvestimentos(alunoA1.id);
    expect(resumo.totalColetivoInvestido).toBe(20);
    expect(resumo.totalDoado).toBe(20); // 15 + 5
  });
});

describe("RN-28 - carência de resgate por tipo (poupança 0, FII 7, Tesouro 15, CDB 30)", () => {
  it("poupança pode ser resgatada no mesmo dia (carência 0)", async () => {
    const { alunoA1, turmaA, professorPec } = await criarFixtureBase();
    await darSaldo(alunoA1.id, turmaA.id, professorPec.id, 50);

    const inv = await investir({ alunoId: alunoA1.id, tipo: "poupanca", valor: 20 });
    await expect(resgatarInvestimento({ investimentoId: (inv as { id: string }).id, alunoId: alunoA1.id })).resolves.toBeTruthy();
  });

  it("CDB no dia 0 é bloqueado; após 30 dias aplicado, resgata", async () => {
    const { alunoA1, turmaA, professorPec } = await criarFixtureBase();
    await darSaldo(alunoA1.id, turmaA.id, professorPec.id, 50);

    const inv = await investir({ alunoId: alunoA1.id, tipo: "cdb", valor: 20 });
    const id = (inv as { id: string }).id;

    await expect(resgatarInvestimento({ investimentoId: id, alunoId: alunoA1.id })).rejects.toMatchObject({ status: 400 });
    // continua ativo, nada creditado
    expect((await prisma.investimento.findUniqueOrThrow({ where: { id } })).status).toBe("ativo");
    expect((await prisma.usuario.findUniqueOrThrow({ where: { id: alunoA1.id } })).saldoAtual).toBe(30);

    await prisma.investimento.update({ where: { id }, data: { dataInvestimento: new Date(Date.now() - 30 * DIA) } });
    await expect(resgatarInvestimento({ investimentoId: id, alunoId: alunoA1.id })).resolves.toBeTruthy();
  });

  it("FII: bloqueado no dia 3, liberado no dia 7", async () => {
    const { alunoA1, turmaA, professorPec } = await criarFixtureBase();
    await darSaldo(alunoA1.id, turmaA.id, professorPec.id, 50);

    const inv = await investir({ alunoId: alunoA1.id, tipo: "fundo_imobiliario", valor: 20 });
    const id = (inv as { id: string }).id;

    await prisma.investimento.update({ where: { id }, data: { dataInvestimento: new Date(Date.now() - 3 * DIA) } });
    await expect(resgatarInvestimento({ investimentoId: id, alunoId: alunoA1.id })).rejects.toMatchObject({ status: 400 });

    await prisma.investimento.update({ where: { id }, data: { dataInvestimento: new Date(Date.now() - 7 * DIA) } });
    await expect(resgatarInvestimento({ investimentoId: id, alunoId: alunoA1.id })).resolves.toBeTruthy();
  });

  it("listarInvestimentos expõe diasRestantesCarencia (Tesouro no dia 5 -> faltam 10)", async () => {
    const { alunoA1, turmaA, professorPec } = await criarFixtureBase();
    await darSaldo(alunoA1.id, turmaA.id, professorPec.id, 50);

    const inv = await investir({ alunoId: alunoA1.id, tipo: "tesouro_direto", valor: 20 });
    const id = (inv as { id: string }).id;
    await prisma.investimento.update({ where: { id }, data: { dataInvestimento: new Date(Date.now() - 5 * DIA) } });

    const lista = await listarInvestimentos(alunoA1.id);
    const item = lista.find((i) => i.id === id)!;
    expect(item.carenciaDias).toBe(15);
    expect(item.diasRestantesCarencia).toBe(10);
  });
});
