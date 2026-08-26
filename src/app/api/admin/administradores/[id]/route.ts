import { NextRequest, NextResponse } from "next/server";
import { requireSuperAdmin, handleApiError, ApiError } from "@/lib/auth/server";
import { alterarAdminSchema } from "@/lib/validation/schemas";
import { prisma } from "@/lib/db";

/**
 * PATCH /api/admin/administradores/:id — remove (ativo:false) ou restaura
 * (ativo:true) o acesso de um administrador. Restrito ao super admin (ver
 * requireSuperAdmin). Nao permite que o super admin remova a si mesmo.
 */
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await requireSuperAdmin();

    if (params.id === session.user.id) {
      throw new ApiError(400, "Voce nao pode remover a si mesmo.");
    }

    const body = await req.json();
    const parsed = alterarAdminSchema.safeParse(body);
    if (!parsed.success) throw new ApiError(400, parsed.error.issues[0]?.message ?? "Payload invalido.");

    const alvo = await prisma.usuario.findUnique({ where: { id: params.id } });
    if (!alvo || alvo.papel !== "admin") throw new ApiError(404, "Administrador nao encontrado.");

    const admin = await prisma.usuario.update({ where: { id: params.id }, data: { ativo: parsed.data.ativo } });
    return NextResponse.json(admin);
  } catch (error) {
    return handleApiError(error);
  }
}
