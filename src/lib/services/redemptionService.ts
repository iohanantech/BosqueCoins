import { prisma } from "@/lib/db";
import { ApiError } from "@/lib/auth/server";
import { itemPermiteEscopo, validarDebitoNaoNegativo } from "@/lib/services/regras";
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
 *
 * O saldo suficiente e SEMPRE reconferido na aprovacao (resolverResgate,
 * RN-06), de forma atomica - entao um pedido sem saldo nunca vira entrega.
 * Ainda assim, para o escopo INDIVIDUAL barramos ja no pedido: o saldo do
 * aluno e conhecido agora e nao vai crescer sozinho, entao deixar solicitar
 * so serviria para encher a fila do PEC e dar falsa esperanca ("aguarde a
 * aprovacao"). Para o escopo TURMA nao barramos aqui de proposito - o saldo
 * coletivo e dinamico e pode subir entre o pedido e a aprovacao.
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

    const aluno = await prisma.usuario.findUnique({ where: { id: input.alunoId }, select: { saldoAtual: true } });
    if (!aluno) throw new ApiError(404, "Aluno nao encontrado.");
    const saldoCheck = validarDebitoNaoNegativo(aluno.saldoAtual, item.custo);
    if (!saldoCheck.valido) {
      throw new ApiError(400, `Saldo insuficiente para resgatar este item (custa ${item.custo}, voce tem ${aluno.saldoAtual}).`);
    }
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

  // Aprovacao: debita e entrega, dentro de uma transacao com revalidacao de saldo/estoque.
  return prisma.$transaction(async (tx) => {
    // Fecha o resgate PRIMEIRO, de forma condicional a ele ainda estar
    // "pendente" naquele instante - a checagem de status feita acima (antes
    // da transacao) e so um fast-fail para o caso comum: aprovar o mesmo
    // resgate 2x em paralelo (duplo clique, ou o mesmo PEC/admin em duas
    // abas) passaria por ela nas duas chamadas antes de qualquer uma
    // resolver. So quem vence esta corrida (count === 1) segue para debitar.
    const fechado = await tx.resgate.updateMany({
      where: { id: resgate.id, status: "pendente" },
      data: { status: "aprovado", aprovadorId: input.aprovadorId, resolvidoEm: new Date() },
    });
    if (fechado.count === 0) throw new ApiError(400, "Este resgate já foi resolvido.");

    if (resgate.escopoUsado === "individual" && resgate.alunoId) {
      // RN-06: debito condicional - so afeta a linha se saldoAtual >= valor
      // ainda for verdade neste instante (mesmo raciocinio de investmentService).
      const debitado = await tx.usuario.updateMany({
        where: { id: resgate.alunoId, saldoAtual: { gte: resgate.valorDebitado } },
        data: { saldoAtual: { decrement: resgate.valorDebitado } },
        // RN-04: NAO mexe em saldoAcumulado nem em turma/Casa.
      });
      if (debitado.count === 0) throw new ApiError(400, "Saldo atual insuficiente para esta operação.");

      await tx.transacao.create({
        data: {
          anoLetivoId: resgate.anoLetivoId,
          tipo: "debito",
          valor: resgate.valorDebitado,
          motivo: `Resgate: ${resgate.item.nome}`,
          origemUsuarioId: input.aprovadorId,
          destinoTipo: "aluno",
          destinoId: resgate.alunoId,
        },
      });
    } else if (resgate.escopoUsado === "turma" && resgate.turmaId) {
      const debitado = await tx.turmaPeriodo.updateMany({
        where: {
          turmaId: resgate.turmaId,
          anoLetivoId: resgate.anoLetivoId,
          saldoAtual: { gte: resgate.valorDebitado },
        },
        data: { saldoAtual: { decrement: resgate.valorDebitado } },
        // Resgate so debita o atual, nunca o acumulado (secao 4.4).
      });
      if (debitado.count === 0) throw new ApiError(400, "Saldo atual insuficiente para esta operação.");

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
      // Estoque tambem condicional - impede ir negativo mesmo fora de uma
      // corrida (varios resgates pendentes aprovados em sequencia pro mesmo
      // item com so 1 unidade).
      const estoqueOk = await tx.itemCatalogo.updateMany({
        where: { id: resgate.itemId, quantidadeDisponivel: { gt: 0 } },
        data: { quantidadeDisponivel: { decrement: 1 } },
      });
      if (estoqueOk.count === 0) throw new ApiError(400, "Item sem estoque disponível.");
    }

    return tx.resgate.findUniqueOrThrow({ where: { id: resgate.id } });
  });
}
