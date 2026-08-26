import { NextRequest, NextResponse } from "next/server";
import { requirePapel, handleApiError, ApiError } from "@/lib/auth/server";
import { atribuirAlunosTurmaSchema, removerAlunoTurmaSchema } from "@/lib/validation/schemas";
import { prisma } from "@/lib/db";
import { getAnoLetivoAtivo } from "@/lib/services/pointsService";

/**
 * POST /api/turmas/:id/alunos — admin matricula (ou remaneja) alunos nessa
 * turma no ano letivo vigente. Como `Matricula` tem `@@unique([alunoId, anoLetivoId])`,
 * um aluno ja matriculado noutra turma neste ano e movido para esta.
 */
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    await requirePapel("admin");
    const body = await req.json();
    const parsed = atribuirAlunosTurmaSchema.safeParse(body);
    if (!parsed.success) throw new ApiError(400, parsed.error.issues[0]?.message ?? "Payload invalido.");

    const turma = await prisma.turma.findUnique({ where: { id: params.id } });
    if (!turma) throw new ApiError(404, "Turma nao encontrada.");

    const anoLetivo = await getAnoLetivoAtivo();
    const alunos = await prisma.usuario.findMany({
      where: { id: { in: parsed.data.alunoIds }, papel: "aluno" },
      select: { id: true },
    });
    if (alunos.length !== parsed.data.alunoIds.length) {
      throw new ApiError(400, "Um ou mais alunos informados nao existem.");
    }

    await prisma.$transaction(
      alunos.map((a) =>
        prisma.matricula.upsert({
          where: { alunoId_anoLetivoId: { alunoId: a.id, anoLetivoId: anoLetivo.id } },
          update: { turmaId: turma.id },
          create: { alunoId: a.id, turmaId: turma.id, anoLetivoId: anoLetivo.id },
        })
      )
    );

    return NextResponse.json({ ok: true }, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}

/** DELETE /api/turmas/:id/alunos — admin remove a matricula de um aluno desta turma no ano vigente. */
export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    await requirePapel("admin");
    const body = await req.json();
    const parsed = removerAlunoTurmaSchema.safeParse(body);
    if (!parsed.success) throw new ApiError(400, parsed.error.issues[0]?.message ?? "Payload invalido.");

    const anoLetivo = await getAnoLetivoAtivo();
    await prisma.matricula.deleteMany({
      where: { alunoId: parsed.data.alunoId, anoLetivoId: anoLetivo.id, turmaId: params.id },
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    return handleApiError(error);
  }
}
