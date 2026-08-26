import { NextRequest, NextResponse } from "next/server";
import { requirePapel, requireSuperAdmin, ehSuperAdmin, handleApiError, ApiError } from "@/lib/auth/server";
import { criarAdminSchema } from "@/lib/validation/schemas";
import { prisma } from "@/lib/db";

/**
 * GET /api/admin/administradores — lista os administradores. Qualquer admin
 * pode ver a lista; `souSuperAdmin` diz ao front se essa sessao pode
 * cadastrar/remover (so o admin responsavel, ver requireSuperAdmin).
 */
export async function GET() {
  try {
    const session = await requirePapel("admin");
    const administradores = await prisma.usuario.findMany({
      where: { papel: "admin" },
      select: { id: true, nome: true, email: true, ativo: true },
      orderBy: { nome: "asc" },
    });
    return NextResponse.json({ souSuperAdmin: ehSuperAdmin(session), administradores });
  } catch (error) {
    return handleApiError(error);
  }
}

/**
 * POST /api/admin/administradores — cadastra outro administrador
 * individualmente (RN-10, mesma checagem de dominio do login/professores).
 * Restrito ao super admin - ver requireSuperAdmin.
 */
export async function POST(req: NextRequest) {
  try {
    await requireSuperAdmin();
    const body = await req.json();
    const parsed = criarAdminSchema.safeParse(body);
    if (!parsed.success) throw new ApiError(400, parsed.error.issues[0]?.message ?? "Payload invalido.");

    const { nome, email } = parsed.data;
    const ALLOWED_DOMAIN = process.env.ALLOWED_EMAIL_DOMAIN ?? "bosquemananciais.org.br";

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
