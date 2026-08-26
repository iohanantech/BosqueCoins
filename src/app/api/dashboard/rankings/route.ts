import { NextRequest, NextResponse } from "next/server";
import { requireSession, handleApiError, ApiError } from "@/lib/auth/server";
import { buscarRankingTurmas, buscarRankingCasas, buscarContextoAluno } from "@/lib/services/rankingService";
import { prisma } from "@/lib/db";

/**
 * GET /api/dashboard/rankings?anoLetivoId=...&modoTurmas=total|media
 * Disponivel para qualquer usuario autenticado (secao 4.1). Sem parametro
 * de ano, usa o ano letivo ativo.
 */
export async function GET(req: NextRequest) {
  try {
    const session = await requireSession();
    const anoLetivoIdParam = req.nextUrl.searchParams.get("anoLetivoId");
    const modoTurmas = (req.nextUrl.searchParams.get("modoTurmas") as "total" | "media") ?? "total";

    const anoLetivo = anoLetivoIdParam
      ? await prisma.anoLetivo.findUnique({ where: { id: anoLetivoIdParam } })
      : await prisma.anoLetivo.findFirst({ where: { ativo: true } });

    if (!anoLetivo) throw new ApiError(404, "Ano letivo nao encontrado.");

    const [turmas, casas] = await Promise.all([
      buscarRankingTurmas(anoLetivo.id, modoTurmas),
      buscarRankingCasas(anoLetivo.id),
    ]);

    // "Ver a visão do aluno" (so admin): contexto pessoal de outro aluno, nao
    // o proprio - RN-08 preservada porque so admin pode passar ?alunoId=
    // (aluno continua so vendo o proprio, ignorando esse parametro).
    const verComoAlunoId = req.nextUrl.searchParams.get("alunoId");
    const alunoAlvoId = session.user.papel === "aluno" ? session.user.id : session.user.papel === "admin" ? verComoAlunoId : null;

    let contextoAluno = null;
    if (alunoAlvoId) {
      // Contexto pessoal sempre usa o ANO VIGENTE para posicao de turma/Casa,
      // mesmo que o dashboard esteja olhando um ano anterior (secao 4.1, item 4)
      const anoVigente = await prisma.anoLetivo.findFirst({ where: { ativo: true } });
      if (anoVigente) contextoAluno = await buscarContextoAluno(alunoAlvoId, anoVigente.id);
    }

    const anosLetivos = await prisma.anoLetivo.findMany({ orderBy: { nome: "desc" } });

    return NextResponse.json({ anoLetivo, turmas, casas, contextoAluno, anosLetivos });
  } catch (error) {
    return handleApiError(error);
  }
}
