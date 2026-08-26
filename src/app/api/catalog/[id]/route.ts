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

/**
 * DELETE /api/catalog/:id — exclui um item do catalogo, so admin.
 * So permite excluir quando nao ha nenhum Resgate apontando pra ele (RN-07 nao
 * cobre o catalogo diretamente, mas apagar um item ja resgatado quebraria o
 * historico de resgates) - nesse caso, o admin deve desativar em vez de excluir.
 */
export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    await requirePapel("admin");

    const item = await prisma.itemCatalogo.findUnique({ where: { id: params.id } });
    if (!item) throw new ApiError(404, "Item nao encontrado.");

    const totalResgates = await prisma.resgate.count({ where: { itemId: params.id } });
    if (totalResgates > 0) {
      throw new ApiError(400, "Este item ja tem resgates no historico - desative-o em vez de excluir.");
    }

    await prisma.itemCatalogo.delete({ where: { id: params.id } });
    return NextResponse.json({ ok: true });
  } catch (error) {
    return handleApiError(error);
  }
}
