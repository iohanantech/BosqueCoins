import { NextRequest, NextResponse } from "next/server";
import { requirePapel, handleApiError, ApiError } from "@/lib/auth/server";
import { editarCasaSchema } from "@/lib/validation/schemas";
import { prisma } from "@/lib/db";

/** PATCH /api/casas/:id — editar nome/cores/ativo de uma Casa, so admin. */
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    await requirePapel("admin");
    const body = await req.json();
    const parsed = editarCasaSchema.safeParse(body);
    if (!parsed.success) throw new ApiError(400, parsed.error.issues[0]?.message ?? "Payload invalido.");

    if (parsed.data.nome) {
      const existente = await prisma.casa.findUnique({ where: { nome: parsed.data.nome } });
      if (existente && existente.id !== params.id) throw new ApiError(400, "Ja existe uma Casa com esse nome.");
    }

    const casa = await prisma.casa.update({ where: { id: params.id }, data: parsed.data });
    return NextResponse.json(casa);
  } catch (error) {
    return handleApiError(error);
  }
}
