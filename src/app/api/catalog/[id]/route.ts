import { NextRequest, NextResponse } from "next/server";
import { requirePapel, handleApiError, ApiError } from "@/lib/auth/server";
import { criarItemCatalogoSchema } from "@/lib/validation/schemas";
import { prisma } from "@/lib/db";

/** PATCH /api/catalog/:id — editar item (inclui ativar/desativar), so admin. */
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    await requirePapel("admin");
    const body = await req.json();
    const parsed = criarItemCatalogoSchema.partial().safeParse(body);
    if (!parsed.success) throw new ApiError(400, parsed.error.issues[0]?.message ?? "Payload invalido.");

    const item = await prisma.itemCatalogo.update({ where: { id: params.id }, data: parsed.data });
    return NextResponse.json(item);
  } catch (error) {
    return handleApiError(error);
  }
}
