import { prisma } from "@/lib/db";
import { ApiError } from "@/lib/auth/server";
import { validarDebitoNaoNegativo, itemPermiteEscopo } from "@/lib/services/regras";
import { getAnoLetivoAtivo, ehPecDaTurma } from "@/lib/services/pointsService";

export interface SolicitarResgateInput {
  itemId: string;
  escopo: "turma" | "individual";
  turmaId?: string; // obrigatorio se escopo = turma
  alunoId?: string; // obrigatorio se escopo = individual (aluno solicitando p/ si mesmo)
  solicitanteId: string;
}

/**
 * Registra o pedido como `pendente`. Nao debita nada ainda (a especificacao
 * e explicita: "o saldo so e debitado na aprovacao" - secao 4.4).
 */
export async function solicitarResgate(input: SolicitarResgateInput) {
  const item = await prisma.itemCatalogo.findUnique({ where: { id: input.itemId } });
  if (!item || !item.ativo) throw new ApiError(404, "Item nao encontrado ou inativo.");

  if (!itemPermiteEscopo(item.escopo, input.escopo)) {
    throw new ApiError(400, "Este item nao esta disponivel neste escopo de resgate.");
  }

  if (item.quantidadeDisponivel !== null && item.quantidadeDisponivel <= 0) {
    throw new ApiError(400, "Item sem estoque disponivel.");
  }

  const anoLetivo = await getAnoLetivoAtivo();

  if (input.escopo === "individual") {
    if (!input.alunoId) throw new ApiError(400, "alunoId e obrigatorio para resgate individual.");
  } else {
    if (!input.turmaId) throw new ApiError(400, "turmaId e obrigatorio para resgate de turma.");
  }

  return prisma.resgate.create({
    data: {
      anoLetivoId: anoLetivo.id,
      itemId: item.id,
      escopoUsado: input.escopo,
      turmaId: input.escopo === "turma" ? input.turmaId : null,
      alunoId: input.escopo === "individual" ? input.alunoId : null,
      solicitanteId: input.solicitanteId,
      valorDebitado: item.custo,
      status: "pendente",
    },
  });
}

export interface ResolverResgateInput {
  resgateId: string;
  aprovadorId: string;
  aprovadorPapel: "admin" | "professor" | "aluno";
  decisao: "aprovado" | "recusado";
  motivoRecusa?: string;
}

/**
 * Aprovacao feita por admin ou pelo PEC da turma do solicitante (secao 4.4).
 * RN-04: resgate individual so debita saldo pessoal atual do aluno - nunca
 * turma/Casa. RN-06: revalida saldo atual no momento da aprovacao (pode ter
 * mudado desde o pedido).
 */
export async function resolverResgate(input: ResolverResgateInput) {
  const resgate = await prisma.resgate.findUnique({ where: { id: input.resgateId }, include: { item: true } });
  if (!resgate) throw new ApiError(404, "Resgate nao encontrado.");
  if (resgate.status !== "pendente") throw new ApiError(400, "Este resgate ja foi resolvido.");

  // Autorizacao: admin sempre pode. PEC so pode resolver resgates de TURMA das
  // turmas que administra (RN-09) - resgates individuais de aluno so o admin resolve
  // (a especificacao define aprovacao "por admin ou pelo PEC da turma do solicitante";
  // para resgate individual, tratamos "turma do solicitante" = turma do aluno no ano vigente).
  if (input.aprovadorPapel !== "admin") {
    const anoLetivo = await getAnoLetivoAtivo();
    let turmaRelevante: string | null = resgate.turmaId;
    if (!turmaRelevante && resgate.alunoId) {
      const matricula = await prisma.matricula.findUnique({
        where: { alunoId_anoLetivoId: { alunoId: resgate.alunoId, anoLetivoId: anoLetivo.id } },
      });
      turmaRelevante = matricula?.turmaId ?? null;
    }
    if (!turmaRelevante || !(await ehPecDaTurma(input.aprovadorId, turmaRelevante, anoLetivo.id))) {
      throw new ApiError(403, "Voce nao tem permissao para resolver este resgate.");
    }
  }

  if (input.decisao === "recusado") {
    return prisma.resgate.update({
      where: { id: resgate.id },
      data: {
        status: "recusado",
        aprovadorId: input.aprovadorId,
        motivoRecusa: input.motivoRecusa ?? "Nao especificado",
        resolvidoEm: new Date(),
      },
    });
  }

  // Aprovacao: debita e entrega, dentro de uma transacao com revalidacao de saldo.
  return prisma.$transaction(async (tx) => {
    if (resgate.escopoUsado === "individual" && resgate.alunoId) {
      const aluno = await tx.usuario.findUniqueOrThrow({ where: { id: resgate.alunoId } });
      const check = validarDebitoNaoNegativo(aluno.saldoAtual, resgate.valorDebitado);
      if (!check.valido) throw new ApiError(400, check.erro!);

      await tx.usuario.update({
        where: { id: aluno.id },
        data: { saldoAtual: { decrement: resgate.valorDebitado } },
        // RN-04: NAO mexe em saldoAcumulado nem em turma/Casa.
      });

      await tx.transacao.create({
        data: {
          anoLetivoId: resgate.anoLetivoId,
          tipo: "debito",
          valor: resgate.valorDebitado,
          motivo: `Resgate: ${resgate.item.nome}`,
          origemUsuarioId: input.aprovadorId,
          destinoTipo: "aluno",
          destinoId: aluno.id,
        },
      });
    } else if (resgate.escopoUsado === "turma" && resgate.turmaId) {
      const turmaPeriodo = await tx.turmaPeriodo.findUniqueOrThrow({
        where: { turmaId_anoLetivoId: { turmaId: resgate.turmaId, anoLetivoId: resgate.anoLetivoId } },
      });
      const check = validarDebitoNaoNegativo(turmaPeriodo.saldoAtual, resgate.valorDebitado);
      if (!check.valido) throw new ApiError(400, check.erro!);

      await tx.turmaPeriodo.update({
        where: { id: turmaPeriodo.id },
        data: { saldoAtual: { decrement: resgate.valorDebitado } },
        // Resgate so debita o atual, nunca o acumulado (secao 4.4).
      });

      await tx.transacao.create({
        data: {
          anoLetivoId: resgate.anoLetivoId,
          tipo: "debito",
          valor: resgate.valorDebitado,
          motivo: `Resgate: ${resgate.item.nome}`,
          origemUsuarioId: input.aprovadorId,
          destinoTipo: "turma",
          destinoId: resgate.turmaId,
        },
      });
    }

    if (resgate.item.quantidadeDisponivel !== null) {
      await tx.itemCatalogo.update({
        where: { id: resgate.itemId },
        data: { quantidadeDisponivel: { decrement: 1 } },
      });
    }

    return tx.resgate.update({
      where: { id: resgate.id },
      data: { status: "aprovado", aprovadorId: input.aprovadorId, resolvidoEm: new Date() },
    });
  });
}
