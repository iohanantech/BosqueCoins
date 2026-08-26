import { NextRequest, NextResponse } from "next/server";
import { requirePapel, handleApiError, ApiError } from "@/lib/auth/server";
import { editarTurmaSchema } from "@/lib/validation/schemas";
import { prisma } from "@/lib/db";

/** PATCH /api/turmas/:id — editar nome/serie/ativo de uma turma (Sala), so admin. */
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    await requirePapel("admin");
    const body = await req.json();
    const parsed = editarTurmaSchema.safeParse(body);
    if (!parsed.success) throw new ApiError(400, parsed.error.issues[0]?.message ?? "Payload invalido.");

    if (parsed.data.nome) {
      const existente = await prisma.turma.findUnique({ where: { nome: parsed.data.nome } });
      if (existente && existente.id !== params.id) throw new ApiError(400, "Ja existe uma turma com esse nome.");
    }

    const turma = await prisma.turma.update({ where: { id: params.id }, data: parsed.data });
    return NextResponse.json(turma);
  } catch (error) {
    return handleApiError(error);
  }
}
