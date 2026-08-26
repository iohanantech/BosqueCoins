import { prisma } from "@/lib/db";
import { ordenarRankingTurmas, type TurmaRankingEntrada } from "@/lib/services/regras";

/**
 * Ranking de Salas (secao 4.1): turmas do ano letivo pedido (padrao: ano
 * vigente), com contagem de matriculados calculada em consulta para a media.
 */
export async function buscarRankingTurmas(anoLetivoId: string, modo: "total" | "media" = "total") {
  const periodos = await prisma.turmaPeriodo.findMany({
    where: { anoLetivoId },
    include: {
      turma: true,
    },
  });

  const comContagem: TurmaRankingEntrada[] = await Promise.all(
    periodos.map(async (p) => {
      const quantidadeAlunos = await prisma.matricula.count({
        where: { turmaId: p.turmaId, anoLetivoId },
      });
      return {
        turmaId: p.turmaId,
        nome: p.turma.nome,
        saldoAtual: p.saldoAtual,
        saldoAcumulado: p.saldoAcumulado,
        quantidadeAlunos,
      };
    })
  );

  return ordenarRankingTurmas(comContagem, modo);
}

/** Ranking da Copa das Casas (secao 4.1) - sem modo "media" por ora. */
export async function buscarRankingCasas(anoLetivoId: string) {
  const periodos = await prisma.casaPeriodo.findMany({
    where: { anoLetivoId },
    include: { casa: true },
    orderBy: { saldoAtual: "desc" },
  });

  return periodos.map((p) => ({
    casaId: p.casaId,
    nome: p.casa.nome,
    corPrimaria: p.casa.corPrimariaHex,
    corSecundaria: p.casa.corSecundariaHex,
    saldoAtual: p.saldoAtual,
    saldoAcumulado: p.saldoAcumulado,
  }));
}

/** Contexto pessoal do dashboard: posicao da turma/Casa do aluno no ano vigente. */
export async function buscarContextoAluno(alunoId: string, anoLetivoId: string) {
  const aluno = await prisma.usuario.findUniqueOrThrow({ where: { id: alunoId } });

  const matricula = await prisma.matricula.findUnique({
    where: { alunoId_anoLetivoId: { alunoId, anoLetivoId } },
    include: { turma: true },
  });

  const rankingTurmas = await buscarRankingTurmas(anoLetivoId, "total");
  const rankingCasas = aluno.casaId ? await buscarRankingCasas(anoLetivoId) : [];

  const posicaoTurma = matricula
    ? rankingTurmas.findIndex((t) => t.turmaId === matricula.turmaId) + 1
    : null;
  const posicaoCasa = aluno.casaId ? rankingCasas.findIndex((c) => c.casaId === aluno.casaId) + 1 : null;

  return {
    saldoPessoalAtual: aluno.saldoAtual, // vitalicio - nao depende do ano selecionado
    saldoPessoalAcumulado: aluno.saldoAcumulado,
    turma: matricula?.turma.nome ?? null,
    posicaoTurma: posicaoTurma || null,
    posicaoCasa: posicaoCasa || null,
  };
}
