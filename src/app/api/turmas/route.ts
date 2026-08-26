import { NextResponse } from "next/server";
import { requireSession, handleApiError, ApiError } from "@/lib/auth/server";
import { prisma } from "@/lib/db";
import { getAnoLetivoAtivo } from "@/lib/services/pointsService";

/**
 * GET /api/turmas — lista turmas com os alunos matriculados no ano vigente.
 * Usado na tela de "dar pontos" (professor escolhe turma -> ve alunos).
 */
export async function GET() {
  try {
    const session = await requireSession();
    const anoLetivo = await getAnoLetivoAtivo();

    if (session.user.papel === "aluno") {
      throw new ApiError(403, "Rota nao disponivel para alunos.");
    }

    const turmas = await prisma.turma.findMany({
      where: { ativo: true },
      include: {
        matriculas: {
          where: { anoLetivoId: anoLetivo.id },
          include: { aluno: { select: { id: true, nome: true, email: true } } },
        },
      },
      orderBy: { nome: "asc" },
    });

    return NextResponse.json(
      turmas.map((t) => ({
        id: t.id,
        nome: t.nome,
        serie: t.serie,
        alunos: t.matriculas.map((m) => m.aluno),
      }))
    );
  } catch (error) {
    return handleApiError(error);
  }
}
