import { prisma } from "@/lib/db";
import { ordenarRankingTurmas, type TurmaRankingEntrada } from "@/lib/services/regras";

/**
 * Ranking de Salas (secao 4.1): TODAS as turmas ativas, com o saldo do ano
 * letivo pedido (padrao: ano vigente). A linha de `TurmaPeriodo` so passa a
 * existir quando a turma recebe o primeiro ponto (investimento de aluno ou
 * ajuste de PEC) - antes disso a turma ainda deve aparecer no ranking, com
 * 0/0, senao o dashboard fica vazio ate alguem pontuar.
 */
export async function buscarRankingTurmas(anoLetivoId: string, modo: "total" | "media" = "total") {
  // P9 (auditoria): a contagem de alunos era um `matricula.count` por turma
  // (N+1). Um unico groupBy resolve todas de uma vez.
  const [turmas, periodos, contagens] = await Promise.all([
    prisma.turma.findMany({ where: { ativo: true } }),
    prisma.turmaPeriodo.findMany({ where: { anoLetivoId } }),
    prisma.matricula.groupBy({ by: ["turmaId"], where: { anoLetivoId }, _count: { _all: true } }),
  ]);
  const porTurma = new Map(periodos.map((p) => [p.turmaId, p]));
  const alunosPorTurma = new Map(contagens.map((c) => [c.turmaId, c._count._all]));

  const comContagem: TurmaRankingEntrada[] = turmas.map((t) => {
    const periodo = porTurma.get(t.id);
    return {
      turmaId: t.id,
      nome: t.nome,
      saldoAtual: periodo?.saldoAtual ?? 0,
      saldoAcumulado: periodo?.saldoAcumulado ?? 0,
      quantidadeAlunos: alunosPorTurma.get(t.id) ?? 0,
    };
  });

  return ordenarRankingTurmas(comContagem, modo);
}

/** Ranking da Copa das Casas (secao 4.1) - todas as Casas ativas, mesmo com 0. */
export async function buscarRankingCasas(anoLetivoId: string) {
  const [casas, periodos] = await Promise.all([
    prisma.casa.findMany({ where: { ativo: true } }),
    prisma.casaPeriodo.findMany({ where: { anoLetivoId } }),
  ]);
  const porCasa = new Map(periodos.map((p) => [p.casaId, p]));

  return casas
    .map((c) => {
      const periodo = porCasa.get(c.id);
      return {
        casaId: c.id,
        nome: c.nome,
        corPrimaria: c.corPrimariaHex,
        corSecundaria: c.corSecundariaHex,
        saldoAtual: periodo?.saldoAtual ?? 0,
        saldoAcumulado: periodo?.saldoAcumulado ?? 0,
      };
    })
    .sort((a, b) => b.saldoAtual - a.saldoAtual);
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
