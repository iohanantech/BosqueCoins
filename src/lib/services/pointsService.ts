import { v4 as uuid } from "uuid";
import { prisma } from "@/lib/db";
import { ApiError } from "@/lib/auth/server";
import {
  validarLimiteValorPorLote,
  validarMotivo,
  validarValorInteiroPositivo,
  validarQuemPontuaProfessor,
  calcularPropagacaoCredito,
  calcularAjusteTurma,
  type Papel,
} from "@/lib/services/regras";

async function getAnoLetivoAtivo() {
  const ano = await prisma.anoLetivo.findFirst({ where: { ativo: true } });
  if (!ano) throw new ApiError(500, "Nenhum ano letivo ativo. Contate o administrador.");
  return ano;
}

async function ehPecDaTurma(professorId: string, turmaId: string, anoLetivoId: string) {
  const vinculo = await prisma.professorPecTurma.findUnique({
    where: {
      professorId_turmaId_anoLetivoId: { professorId, turmaId, anoLetivoId },
    },
  });
  return !!vinculo;
}

export interface DistribuirPontosInput {
  turmaId: string;
  alunoIds: string[]; // um ou mais alunos daquela turma (RN-09 se autor for professor/PEC)
  valor: number;
  motivo: string;
  data?: Date;
  autorId: string;
  autorPapel: Papel;
}

/**
 * Fluxo unico usado tanto para "individual em lote" quanto "turma toda"
 * (secao 4.2): a UI so muda como preenche `alunoIds` (subconjunto marcado
 * ou todos os matriculados). Gera UMA transacao por aluno com o mesmo
 * lote_id. So mexe no saldo pessoal do aluno - RN-01 original (propagacao
 * automatica para turma/Casa) foi SUBSTITUIDA pelo sistema de investimentos,
 * ver INVESTIMENTOS.md e investmentService.ts.
 */
export async function distribuirPontos(input: DistribuirPontosInput) {
  const { turmaId, alunoIds, valor, motivo, autorId, autorPapel } = input;

  if (alunoIds.length === 0) throw new ApiError(400, "Selecione ao menos um aluno.");

  const motivoCheck = validarMotivo(motivo);
  if (!motivoCheck.valido) throw new ApiError(400, motivoCheck.erro!);

  const valorCheck = validarValorInteiroPositivo(valor);
  if (!valorCheck.valido) throw new ApiError(400, valorCheck.erro!);

  if (autorPapel === "aluno") throw new ApiError(403, "Alunos nao podem distribuir BosqueCoins.");

  const anoLetivo = await getAnoLetivoAtivo();

  // RN-09: se o autor e professor, so pode agir dentro do escopo de PEC (se aplicavel) -
  // mas mesmo professor comum pode pontuar QUALQUER turma dentro do limite de 10 (RN-14
  // nao restringe *quais* turmas um professor comum pode pontuar, so o *valor*). A restricao
  // de "so pode agir na turma" (RN-09) vale para acoes exclusivas de PEC (ajuste, aprovar
  // resgate de turma) - dar pontos a alunos e permitido a qualquer professor.
  const pec = autorPapel === "professor" ? await ehPecDaTurma(autorId, turmaId, anoLetivo.id) : false;

  const limiteCheck = validarLimiteValorPorLote(valor, {
    papel: autorPapel,
    ehPecDaTurmaAlvo: pec,
  });
  if (!limiteCheck.valido) throw new ApiError(400, limiteCheck.erro!);

  // Confirma que todos os alunos estao de fato matriculados nessa turma neste ano.
  const matriculas = await prisma.matricula.findMany({
    where: { turmaId, anoLetivoId: anoLetivo.id, alunoId: { in: alunoIds } },
    include: { aluno: true },
  });
  if (matriculas.length !== alunoIds.length) {
    throw new ApiError(400, "Um ou mais alunos nao estao matriculados nesta turma no ano letivo vigente.");
  }

  const loteId = uuid();
  const delta = calcularPropagacaoCredito(valor);
  const data = input.data ?? new Date();

  // RN-02: tudo em uma unica transacao de banco. Credito so mexe no saldo
  // pessoal do aluno (RN-01 original SUBSTITUIDA - ver INVESTIMENTOS.md:
  // turma/Casa so crescem quando o aluno decide investir ali, nunca mais
  // automaticamente aqui).
  await prisma.$transaction(async (tx) => {
    for (const matricula of matriculas) {
      const aluno = matricula.aluno;

      await tx.usuario.update({
        where: { id: aluno.id },
        data: {
          saldoAtual: { increment: delta.aluno.saldoAtual },
          saldoAcumulado: { increment: delta.aluno.saldoAcumulado },
        },
      });

      await tx.transacao.create({
        data: {
          anoLetivoId: anoLetivo.id,
          tipo: "credito",
          valor,
          motivo,
          origemUsuarioId: autorId,
          destinoTipo: "aluno",
          destinoId: aluno.id,
          loteId,
          criadoEm: data,
        },
      });
    }
  });

  return { loteId, quantidadeAlunos: alunoIds.length };
}

export interface PontuarProfessorInput {
  professorDestinoId: string;
  valor: number;
  motivo: string;
  autorId: string;
  autorPapel: Papel;
}

/** RN-12/RN-13: so admin credita professor; nunca propaga para turma/Casa; nunca entra em ranking. */
export async function pontuarProfessor(input: PontuarProfessorInput) {
  const check = validarQuemPontuaProfessor(input.autorPapel);
  if (!check.valido) throw new ApiError(403, check.erro!);

  const motivoCheck = validarMotivo(input.motivo);
  if (!motivoCheck.valido) throw new ApiError(400, motivoCheck.erro!);

  const valorCheck = validarValorInteiroPositivo(input.valor);
  if (!valorCheck.valido) throw new ApiError(400, valorCheck.erro!);

  const anoLetivo = await getAnoLetivoAtivo();

  const professor = await prisma.usuario.findUnique({ where: { id: input.professorDestinoId } });
  if (!professor || professor.papel !== "professor") {
    throw new ApiError(400, "Destino invalido: precisa ser um usuario com papel de professor.");
  }

  await prisma.$transaction(async (tx) => {
    await tx.usuario.update({
      where: { id: professor.id },
      data: {
        saldoAtual: { increment: input.valor },
        saldoAcumulado: { increment: input.valor },
      },
    });

    await tx.transacao.create({
      data: {
        anoLetivoId: anoLetivo.id,
        tipo: "credito",
        valor: input.valor,
        motivo: input.motivo,
        origemUsuarioId: input.autorId,
        destinoTipo: "professor",
        destinoId: professor.id,
        loteId: uuid(),
      },
    });
  });
}

export interface AjustarSaldoTurmaInput {
  turmaId: string;
  valor: number;
  direcao: "credito" | "debito";
  motivo: string;
  autorId: string;
  autorPapel: Papel;
}

/** RN-05: ajuste de PEC so mexe no saldo da turma. Requer checagem de RN-09 antes de chamar. */
export async function ajustarSaldoTurma(input: AjustarSaldoTurmaInput) {
  const motivoCheck = validarMotivo(input.motivo);
  if (!motivoCheck.valido) throw new ApiError(400, motivoCheck.erro!);

  const valorCheck = validarValorInteiroPositivo(input.valor);
  if (!valorCheck.valido) throw new ApiError(400, valorCheck.erro!);

  if (input.autorPapel === "aluno") throw new ApiError(403, "Sem permissao.");

  const anoLetivo = await getAnoLetivoAtivo();
  const delta = calcularAjusteTurma(input.valor, input.direcao);

  await prisma.$transaction(async (tx) => {
    const turmaPeriodo = await tx.turmaPeriodo.upsert({
      where: { turmaId_anoLetivoId: { turmaId: input.turmaId, anoLetivoId: anoLetivo.id } },
      update: {},
      create: { turmaId: input.turmaId, anoLetivoId: anoLetivo.id },
    });

    if (input.direcao === "debito" && turmaPeriodo.saldoAtual + delta.saldoAtual < 0) {
      throw new ApiError(400, "Saldo atual da turma insuficiente para este ajuste.");
    }

    await tx.turmaPeriodo.update({
      where: { id: turmaPeriodo.id },
      data: {
        saldoAtual: { increment: delta.saldoAtual },
        saldoAcumulado: { increment: delta.saldoAcumulado },
      },
    });

    await tx.transacao.create({
      data: {
        anoLetivoId: anoLetivo.id,
        tipo: "ajuste",
        valor: input.valor,
        motivo: input.motivo,
        origemUsuarioId: input.autorId,
        destinoTipo: "turma",
        destinoId: input.turmaId,
      },
    });
  });
}

export { ehPecDaTurma, getAnoLetivoAtivo };
