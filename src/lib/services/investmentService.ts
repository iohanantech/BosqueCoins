import { prisma } from "@/lib/db";
import { ApiError } from "@/lib/auth/server";
import {
  validarValorInteiroPositivo,
  validarDebitoNaoNegativo,
  ehInvestimentoReversivel,
  ehDoacao,
  validarPodeResgatar,
  validarCarenciaResgate,
  calcularDeltaInvestimentoColetivo,
  calcularValorComJuros,
  type TipoInvestimento,
} from "@/lib/services/regras";
import { TAXAS_MENSAIS, CARENCIA_RESGATE_DIAS, type TipoInvestimentoReversivel } from "@/lib/config/taxasInvestimento";

import { getAnoLetivoAtivo } from "@/lib/services/pointsService";

const carenciaDe = (tipo: TipoInvestimento) => CARENCIA_RESGATE_DIAS[tipo as TipoInvestimentoReversivel] ?? 0;

/**
 * Dias corridos desde o investimento, NUNCA negativo. Um investimento recem
 * criado pode dar -1 aqui por milissegundos de defasagem entre o relogio do
 * app e o do Postgres (`now()`) - o que faria a carencia de resgate (RN-28)
 * "faltar 1 dia" ate para a poupanca (carencia 0) e os juros ficarem
 * negativos. Trava em 0.
 */
const diasAplicado = (dataInvestimento: Date) =>
  Math.max(0, Math.floor((Date.now() - dataInvestimento.getTime()) / (1000 * 60 * 60 * 24)));

type TipoDoacao = "dizimo" | "lar_idoso";

const NOMES_DOACAO: Record<TipoDoacao, string> = {
  dizimo: "Dízimo (Igreja)",
  lar_idoso: "Lar do Idoso",
};

export interface InvestirInput {
  alunoId: string;
  tipo: TipoInvestimento;
  valor: number;
}

/**
 * RN-15..RN-21 (INVESTIMENTOS.md) — substitui a propagacao automatica que a
 * RN-01 original fazia. O aluno decide o destino do proprio saldo:
 *  - casa/turma: irreversivel, credita direto o periodo do ano vigente (RN-16).
 *  - dizimo/lar_idoso: irreversivel, e uma DOACAO - so debita o aluno, nao
 *    credita nenhum placar dentro do sistema (nao existe "Casa" pra igreja
 *    ou pro lar do idoso).
 *  - cdb/poupanca/fundo_imobiliario/tesouro_direto: reversivel, cria um
 *    Investimento com a taxa congelada no momento (RN-17/18).
 * Em todos os casos, debita o saldo ATUAL do aluno (nao mexe no acumulado -
 * e "dinheiro que ele ja tinha" mudando de lugar, nao um credito novo).
 */
export async function investir(input: InvestirInput) {
  const { alunoId, tipo, valor } = input;

  const valorCheck = validarValorInteiroPositivo(valor);
  if (!valorCheck.valido) throw new ApiError(400, valorCheck.erro!);

  const aluno = await prisma.usuario.findUnique({ where: { id: alunoId } });
  if (!aluno || aluno.papel !== "aluno") {
    throw new ApiError(400, "Destino invalido: precisa ser um usuario com papel de aluno.");
  }

  // RN-15/RN-06: saldo atual precisa ser suficiente.
  const saldoCheck = validarDebitoNaoNegativo(aluno.saldoAtual, valor);
  if (!saldoCheck.valido) throw new ApiError(400, saldoCheck.erro!);

  const anoLetivo = await getAnoLetivoAtivo();

  if (tipo === "casa" || tipo === "turma") {
    return investirColetivo({ aluno, tipo, valor, anoLetivoId: anoLetivo.id });
  }

  if (ehDoacao(tipo)) {
    return investirDoacao({ aluno, tipo: tipo as TipoDoacao, valor, anoLetivoId: anoLetivo.id });
  }

  return investirReversivel({ aluno, tipo: tipo as TipoInvestimentoReversivel, valor, anoLetivoId: anoLetivo.id });
}

async function investirColetivo(params: {
  aluno: { id: string; casaId: string | null };
  tipo: "casa" | "turma";
  valor: number;
  anoLetivoId: string;
}) {
  const { aluno, tipo, valor, anoLetivoId } = params;
  const delta = calcularDeltaInvestimentoColetivo(valor);

  return prisma.$transaction(async (tx) => {
    // RN-06/RN-15: debito condicional dentro da transacao - a checagem feita
    // antes de abrir a transacao (em investir()) NAO e suficiente sozinha:
    // duas requisicoes concorrentes passam ambas por ela antes de qualquer
    // uma debitar, permitindo saldo negativo. Aqui o proprio UPDATE so afeta
    // a linha se saldoAtual >= valor ainda for verdade NAQUELE INSTANTE -
    // quem perder a corrida tem count === 0 e a transacao e abortada.
    const debitado = await tx.usuario.updateMany({
      where: { id: aluno.id, saldoAtual: { gte: valor } },
      data: { saldoAtual: { decrement: valor } },
    });
    if (debitado.count === 0) throw new ApiError(400, "Saldo atual insuficiente para esta operação.");

    if (tipo === "casa") {
      if (!aluno.casaId) throw new ApiError(400, "Este aluno não tem Casa vinculada.");
      const casaPeriodo = await tx.casaPeriodo.upsert({
        where: { casaId_anoLetivoId: { casaId: aluno.casaId, anoLetivoId } },
        update: {},
        create: { casaId: aluno.casaId, anoLetivoId },
      });
      await tx.casaPeriodo.update({
        where: { id: casaPeriodo.id },
        data: { saldoAtual: { increment: delta.saldoAtual }, saldoAcumulado: { increment: delta.saldoAcumulado } },
      });

      await tx.transacao.create({
        data: {
          anoLetivoId,
          tipo: "debito",
          valor,
          motivo: "Investimento (irreversível) na Casa",
          origemUsuarioId: aluno.id,
          destinoTipo: "aluno",
          destinoId: aluno.id,
        },
      });
      await tx.transacao.create({
        data: {
          anoLetivoId,
          tipo: "credito",
          valor,
          motivo: "Investimento de aluno (irreversível)",
          origemUsuarioId: aluno.id,
          destinoTipo: "casa",
          destinoId: aluno.casaId,
        },
      });
    } else {
      const matricula = await tx.matricula.findUnique({
        where: { alunoId_anoLetivoId: { alunoId: aluno.id, anoLetivoId } },
      });
      if (!matricula) throw new ApiError(400, "Este aluno não está matriculado em nenhuma turma no ano letivo vigente.");

      const turmaPeriodo = await tx.turmaPeriodo.upsert({
        where: { turmaId_anoLetivoId: { turmaId: matricula.turmaId, anoLetivoId } },
        update: {},
        create: { turmaId: matricula.turmaId, anoLetivoId },
      });
      await tx.turmaPeriodo.update({
        where: { id: turmaPeriodo.id },
        data: { saldoAtual: { increment: delta.saldoAtual }, saldoAcumulado: { increment: delta.saldoAcumulado } },
      });

      await tx.transacao.create({
        data: {
          anoLetivoId,
          tipo: "debito",
          valor,
          motivo: "Investimento (irreversível) na turma",
          origemUsuarioId: aluno.id,
          destinoTipo: "aluno",
          destinoId: aluno.id,
        },
      });
      await tx.transacao.create({
        data: {
          anoLetivoId,
          tipo: "credito",
          valor,
          motivo: "Investimento de aluno (irreversível)",
          origemUsuarioId: aluno.id,
          destinoTipo: "turma",
          destinoId: matricula.turmaId,
        },
      });
    }

    return { tipo, valor };
  });
}

/**
 * Doacao (Dizimo/Lar do Idoso): irreversivel como investir em Casa/turma,
 * mas sem placar coletivo pra creditar - o valor so sai do saldo do aluno.
 * Gera uma unica Transacao de debito (RN-21 - toda operacao de investimento
 * gera Transacao), sem contrapartida de credito dentro do sistema.
 */
async function investirDoacao(params: { aluno: { id: string }; tipo: TipoDoacao; valor: number; anoLetivoId: string }) {
  const { aluno, tipo, valor, anoLetivoId } = params;

  return prisma.$transaction(async (tx) => {
    // Mesmo debito condicional das outras rotas de investimento - ver
    // comentario em investirColetivo acima.
    const debitado = await tx.usuario.updateMany({
      where: { id: aluno.id, saldoAtual: { gte: valor } },
      data: { saldoAtual: { decrement: valor } },
    });
    if (debitado.count === 0) throw new ApiError(400, "Saldo atual insuficiente para esta operação.");

    await tx.transacao.create({
      data: {
        anoLetivoId,
        tipo: "debito",
        valor,
        motivo: `Doação (irreversível): ${NOMES_DOACAO[tipo]}`,
        origemUsuarioId: aluno.id,
        destinoTipo: "aluno",
        destinoId: aluno.id,
      },
    });

    return { tipo, valor };
  });
}

async function investirReversivel(params: {
  aluno: { id: string };
  tipo: TipoInvestimentoReversivel;
  valor: number;
  anoLetivoId: string;
}) {
  const { aluno, tipo, valor, anoLetivoId } = params;
  const taxaMensal = TAXAS_MENSAIS[tipo];

  return prisma.$transaction(async (tx) => {
    // Mesmo debito condicional de investirColetivo - ver comentario acima.
    const debitado = await tx.usuario.updateMany({
      where: { id: aluno.id, saldoAtual: { gte: valor } },
      data: { saldoAtual: { decrement: valor } },
    });
    if (debitado.count === 0) throw new ApiError(400, "Saldo atual insuficiente para esta operação.");

    const investimento = await tx.investimento.create({
      data: {
        alunoId: aluno.id,
        tipo,
        valorPrincipal: valor,
        taxaMensal,
        status: "ativo",
      },
    });

    await tx.transacao.create({
      data: {
        anoLetivoId,
        tipo: "debito",
        valor,
        motivo: `Investimento em ${tipo}`,
        origemUsuarioId: aluno.id,
        destinoTipo: "aluno",
        destinoId: aluno.id,
      },
    });

    return investimento;
  });
}

export interface ResgatarInvestimentoInput {
  investimentoId: string;
  alunoId: string; // dono do investimento (RN-08 checado na rota via garantirAcessoProprioOuAdmin)
}

/** RN-17/RN-19/RN-20: resgata um investimento reversivel, devolvendo principal + juros. */
export async function resgatarInvestimento(input: ResgatarInvestimentoInput) {
  const investimento = await prisma.investimento.findUnique({ where: { id: input.investimentoId } });
  if (!investimento) throw new ApiError(404, "Investimento não encontrado.");
  if (investimento.alunoId !== input.alunoId) {
    throw new ApiError(403, "Este investimento não pertence a este aluno.");
  }

  const podeResgatar = validarPodeResgatar(investimento.tipo, investimento.status);
  if (!podeResgatar.valido) throw new ApiError(400, podeResgatar.erro!);

  const diasDecorridos = diasAplicado(investimento.dataInvestimento);

  // RN-28: carencia de resgate por tipo (poupanca 0, FII 7, Tesouro 15, CDB 30).
  const carenciaCheck = validarCarenciaResgate(diasDecorridos, carenciaDe(investimento.tipo));
  if (!carenciaCheck.valido) throw new ApiError(400, carenciaCheck.erro!);

  const valorComJuros = calcularValorComJuros(investimento.valorPrincipal, investimento.taxaMensal, diasDecorridos);
  const juros = valorComJuros - investimento.valorPrincipal;

  const anoLetivo = await getAnoLetivoAtivo();

  return prisma.$transaction(async (tx) => {
    // RN-20: fecha o investimento PRIMEIRO, de forma condicional a ele ainda
    // estar "ativo" naquele instante - so quem vence a corrida (count === 1)
    // segue para creditar o aluno. A checagem feita antes da transacao
    // (validarPodeResgatar acima) e so um fast-fail para o caso comum; sem
    // esta segunda checagem atomica, N requisicoes concorrentes creditam o
    // mesmo investimento N vezes (moeda duplicada, nao so saldo negativo).
    const fechado = await tx.investimento.updateMany({
      where: { id: investimento.id, status: "ativo" },
      data: { status: "resgatado", dataResgate: new Date(), valorResgatado: valorComJuros },
    });
    if (fechado.count === 0) throw new ApiError(400, "Este investimento já foi resgatado.");

    await tx.usuario.update({
      where: { id: investimento.alunoId },
      data: {
        // RN-19: principal volta sem alterar acumulado (ja era do aluno); juros somam nos dois.
        saldoAtual: { increment: valorComJuros },
        saldoAcumulado: { increment: juros },
      },
    });

    const atualizado = await tx.investimento.findUniqueOrThrow({ where: { id: investimento.id } });

    await tx.transacao.create({
      data: {
        anoLetivoId: anoLetivo.id,
        tipo: "credito",
        valor: valorComJuros,
        motivo: `Resgate de ${investimento.tipo}: ${investimento.valorPrincipal} principal + ${juros} juros`,
        origemUsuarioId: investimento.alunoId,
        destinoTipo: "aluno",
        destinoId: investimento.alunoId,
      },
    });

    return atualizado;
  });
}

/** Lista os investimentos do aluno, com o valor atual (com juros) calculado on-the-fly para os ativos. */
export async function listarInvestimentos(alunoId: string) {
  const investimentos = await prisma.investimento.findMany({
    where: { alunoId },
    orderBy: { dataInvestimento: "desc" },
  });

  return investimentos.map((inv) => {
    const carenciaDias = carenciaDe(inv.tipo);
    if (inv.status !== "ativo") {
      return { ...inv, valorAtual: inv.valorResgatado ?? inv.valorPrincipal, carenciaDias, diasRestantesCarencia: 0 };
    }
    const diasDecorridos = diasAplicado(inv.dataInvestimento);
    return {
      ...inv,
      valorAtual: calcularValorComJuros(inv.valorPrincipal, inv.taxaMensal, diasDecorridos),
      carenciaDias,
      // RN-28: quantos dias ainda faltam pra liberar o resgate (0 = ja pode).
      diasRestantesCarencia: Math.max(0, carenciaDias - diasDecorridos),
    };
  });
}

/**
 * Resumo usado no card "Investir" do dashboard do aluno: total ativo em
 * investimentos reversiveis (com juros ate agora), total ja investido de
 * forma permanente em Casa/turma, e total ja doado (Dizimo/Lar do Idoso). O
 * total coletivo e somado a partir das proprias Transacoes de investimento
 * (destinoTipo casa/turma, originadas pelo aluno) - nao ha um registro de
 * Investimento para elas (RN-16). O total doado usa o mesmo raciocinio, mas
 * filtrando pelo motivo (destinoTipo continua "aluno" - a doacao nao credita
 * ninguem dentro do sistema, ver investirDoacao).
 */
export async function resumoInvestimentos(alunoId: string) {
  const ativos = await prisma.investimento.findMany({ where: { alunoId, status: "ativo" } });
  const totalReversivelAtivo = ativos.reduce((soma, inv) => {
    const diasDecorridos = diasAplicado(inv.dataInvestimento);
    return soma + calcularValorComJuros(inv.valorPrincipal, inv.taxaMensal, diasDecorridos);
  }, 0);

  const coletivas = await prisma.transacao.findMany({
    where: { origemUsuarioId: alunoId, destinoTipo: { in: ["casa", "turma"] } },
    select: { valor: true },
  });
  const totalColetivoInvestido = coletivas.reduce((soma, t) => soma + t.valor, 0);

  const doacoes = await prisma.transacao.findMany({
    where: { origemUsuarioId: alunoId, tipo: "debito", motivo: { startsWith: "Doação (irreversível):" } },
    select: { valor: true },
  });
  const totalDoado = doacoes.reduce((soma, t) => soma + t.valor, 0);

  return { totalReversivelAtivo, totalColetivoInvestido, totalDoado, quantidadeAtivos: ativos.length };
}

export { ehInvestimentoReversivel };
