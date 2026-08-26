import { NextRequest, NextResponse } from "next/server";
import { requireSession, requirePapel, handleApiError, ApiError } from "@/lib/auth/server";
import { criarTurmaSchema } from "@/lib/validation/schemas";
import { prisma } from "@/lib/db";
import { getAnoLetivoAtivo } from "@/lib/services/pointsService";

/**
 * GET /api/turmas — lista turmas com os alunos matriculados no ano vigente.
 * Usado na tela de "dar pontos" (professor escolhe turma -> ve alunos).
 * Com ?todas=true (so admin), inclui tambem as turmas inativas - usado na
 * tela de gerenciamento /admin/turmas.
 */
export async function GET(req: NextRequest) {
  try {
    const session = await requireSession();
    const anoLetivo = await getAnoLetivoAtivo();

    if (session.user.papel === "aluno") {
      throw new ApiError(403, "Rota nao disponivel para alunos.");
    }

    const todas = req.nextUrl.searchParams.get("todas") === "true" && session.user.papel === "admin";

    const turmas = await prisma.turma.findMany({
      where: todas ? {} : { ativo: true },
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
        ativo: t.ativo,
        alunos: t.matriculas.map((m) => m.aluno),
      }))
    );
  } catch (error) {
    return handleApiError(error);
  }
}

/** POST /api/turmas — cadastra uma nova turma (Sala), so admin. */
export async function POST(req: NextRequest) {
  try {
    await requirePapel("admin");
    const body = await req.json();
    const parsed = criarTurmaSchema.safeParse(body);
    if (!parsed.success) throw new ApiError(400, parsed.error.issues[0]?.message ?? "Payload invalido.");

    const existente = await prisma.turma.findUnique({ where: { nome: parsed.data.nome } });
    if (existente) throw new ApiError(400, "Ja existe uma turma com esse nome.");

    const turma = await prisma.turma.create({ data: parsed.data });
    return NextResponse.json(turma, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}
