import { NextRequest, NextResponse } from "next/server";
import { requirePapel, handleApiError, ApiError } from "@/lib/auth/server";
import { criarAdminSchema } from "@/lib/validation/schemas";
import { prisma } from "@/lib/db";

const ALLOWED_DOMAIN = process.env.ALLOWED_EMAIL_DOMAIN ?? "bosquemananciais.org.br";

/**
 * POST /api/admin/administradores — um admin cadastra outro administrador
 * individualmente (RN-10, mesma checagem de dominio do login/professores).
 */
export async function POST(req: NextRequest) {
  try {
    await requirePapel("admin");
    const body = await req.json();
    const parsed = criarAdminSchema.safeParse(body);
    if (!parsed.success) throw new ApiError(400, parsed.error.issues[0]?.message ?? "Payload invalido.");

    const { nome, email } = parsed.data;

    if (!email.endsWith(`@${ALLOWED_DOMAIN}`)) {
      throw new ApiError(400, `O e-mail precisa ser do domínio @${ALLOWED_DOMAIN}.`);
    }

    const existente = await prisma.usuario.findUnique({ where: { email } });
    if (existente) throw new ApiError(400, "Já existe um usuário cadastrado com esse e-mail.");

    const admin = await prisma.usuario.create({ data: { nome, email, papel: "admin" } });
    return NextResponse.json(admin, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}
