import { NextRequest, NextResponse } from "next/server";
import { requirePapel, handleApiError } from "@/lib/auth/server";
import { prisma } from "@/lib/db";

/** GET /api/usuarios?papel=professor|aluno|admin — listagem simples para admin (selects em formularios). */
export async function GET(req: NextRequest) {
  try {
    await requirePapel("admin");
    const papel = req.nextUrl.searchParams.get("papel") as "admin" | "professor" | "aluno" | null;
    const usuarios = await prisma.usuario.findMany({
      where: papel ? { papel } : undefined,
      select: { id: true, nome: true, email: true, papel: true, saldoAtual: true, saldoAcumulado: true, ativo: true },
      orderBy: { nome: "asc" },
    });
    return NextResponse.json(usuarios);
  } catch (error) {
    return handleApiError(error);
  }
}
