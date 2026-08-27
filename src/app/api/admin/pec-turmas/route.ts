import { NextRequest, NextResponse } from "next/server";
import { requirePapel, handleApiError, ApiError } from "@/lib/auth/server";
import { prisma } from "@/lib/db";
import { getAnoLetivoAtivo } from "@/lib/services/pointsService";
import { z } from "zod";

const schema = z.object({ professorId: z.string().uuid(), turmaId: z.string().uuid() });

/** POST /api/admin/pec-turmas — atribui permissao de PEC a um professor numa turma, no ano vigente. */
export async function POST(req: NextRequest) {
  try {
    await requirePapel("admin");
    const body = await req.json();
    const parsed = schema.safeParse(body);
    if (!parsed.success) throw new ApiError(400, "Payload inválido.");

    // P4: so um usuario com papel 'professor' pode ser PEC. A rota aceitava
    // qualquer id que existisse em `usuarios` - um clique errado no seletor
    // gravava um aluno como PEC (dano contido pelo requirePapel nas acoes de
    // PEC, mas o dado ficava inconsistente e invisivel na UI).
    const professor = await prisma.usuario.findUnique({ where: { id: parsed.data.professorId } });
    if (!professor || professor.papel !== "professor") {
      throw new ApiError(400, "Só um professor pode ser atribuído como PEC de uma turma.");
    }
    const turma = await prisma.turma.findUnique({ where: { id: parsed.data.turmaId } });
    if (!turma) throw new ApiError(404, "Turma não encontrada.");

    const anoLetivo = await getAnoLetivoAtivo();
    const vinculo = await prisma.professorPecTurma.upsert({
      where: {
        professorId_turmaId_anoLetivoId: {
          professorId: parsed.data.professorId,
          turmaId: parsed.data.turmaId,
          anoLetivoId: anoLetivo.id,
        },
      },
      update: {},
      create: { professorId: parsed.data.professorId, turmaId: parsed.data.turmaId, anoLetivoId: anoLetivo.id },
    });
    return NextResponse.json(vinculo, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}
