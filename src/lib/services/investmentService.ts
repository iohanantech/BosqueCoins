import { prisma } from "@/lib/db";
import { ApiError } from "@/lib/auth/server";
import {
  validarValorInteiroPositivo,
  validarDebitoNaoNegativo,
  ehInvestimentoReversivel,
  validarPodeResgatar,
  calcularDeltaInvestimentoColetivo,
  calcularValorComJuros,
  type TipoInvestimento,
} from "@/lib/services/regras";
import { TAXAS_ANUAIS, type TipoInvestimentoReversivel } from "@/lib/config/taxasInvestimento";
import { getAnoLetivoAtivo } from "@/lib/services/pointsService";

export interface InvestirInput {
  alunoId: string;
  tipo: TipoInvestimento;
  valor: number;
}

/**
 * RN-15..RN-21 (INVESTIMENTOS.md) — substitui a propagacao automatica que a
 * RN-01 original fazia. O aluno decide o destino do proprio saldo:
 *  - casa/turma: irreversivel, credita direto o periodo do ano vigente (RN-16).
 *  - cdb/poupanca/fundo_imobiliario/tesouro_direto: reversivel, cria um
 *    Investimento com a taxa congelada no momento (RN-17/18).
 * Em ambos os casos, debita o saldo ATUAL do aluno (nao mexe no acumulado -
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
    await tx.usuario.update({ where: { id: aluno.id }, data: { saldoAtual: { decrement: valor } } });

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

async function investirReversivel(params: {
  aluno: { id: string };
  tipo: TipoInvestimentoReversivel;
  valor: number;
  anoLetivoId: string;
}) {
  const { aluno, tipo, valor, anoLetivoId } = params;
  const taxaAnual = TAXAS_ANUAIS[tipo];

  return prisma.$transaction(async (tx) => {
    await tx.usuario.update({ where: { id: aluno.id }, data: { saldoAtual: { decrement: valor } } });

    const investimento = await tx.investimento.create({
      data: {
        alunoId: aluno.id,
        tipo,
        valorPrincipal: valor,
        taxaAnual,
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

  const diasDecorridos = Math.floor((Date.now() - investimento.dataInvestimento.getTime()) / (1000 * 60 * 60 * 24));
  const valorComJuros = calcularValorComJuros(investimento.valorPrincipal, investimento.taxaAnual, diasDecorridos);
  const juros = valorComJuros - investimento.valorPrincipal;

  const anoLetivo = await getAnoLetivoAtivo();

  return prisma.$transaction(async (tx) => {
    await tx.usuario.update({
      where: { id: investimento.alunoId },
      data: {
        // RN-19: principal volta sem alterar acumulado (ja era do aluno); juros somam nos dois.
        saldoAtual: { increment: valorComJuros },
        saldoAcumulado: { increment: juros },
      },
    });

    const atualizado = await tx.investimento.update({
      where: { id: investimento.id },
      data: { status: "resgatado", dataResgate: new Date(), valorResgatado: valorComJuros },
    });

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
    if (inv.status !== "ativo") return { ...inv, valorAtual: inv.valorResgatado ?? inv.valorPrincipal };
    const diasDecorridos = Math.floor((Date.now() - inv.dataInvestimento.getTime()) / (1000 * 60 * 60 * 24));
    return { ...inv, valorAtual: calcularValorComJuros(inv.valorPrincipal, inv.taxaAnual, diasDecorridos) };
  });
}

/**
 * Resumo usado no card "Investir" do dashboard do aluno: total ativo em
 * investimentos reversiveis (com juros ate agora) e total ja investido de
 * forma permanente em Casa/turma. O total coletivo e somado a partir das
 * proprias Transacoes de investimento (destinoTipo casa/turma, originadas
 * pelo aluno) - nao ha um registro de Investimento para elas (RN-16).
 */
export async function resumoInvestimentos(alunoId: string) {
  const ativos = await prisma.investimento.findMany({ where: { alunoId, status: "ativo" } });
  const totalReversivelAtivo = ativos.reduce((soma, inv) => {
    const diasDecorridos = Math.floor((Date.now() - inv.dataInvestimento.getTime()) / (1000 * 60 * 60 * 24));
    return soma + calcularValorComJuros(inv.valorPrincipal, inv.taxaAnual, diasDecorridos);
  }, 0);

  const coletivas = await prisma.transacao.findMany({
    where: { origemUsuarioId: alunoId, destinoTipo: { in: ["casa", "turma"] } },
    select: { valor: true },
  });
  const totalColetivoInvestido = coletivas.reduce((soma, t) => soma + t.valor, 0);

  return { totalReversivelAtivo, totalColetivoInvestido, quantidadeAtivos: ativos.length };
}

export { ehInvestimentoReversivel };
