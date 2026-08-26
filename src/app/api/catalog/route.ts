import { NextRequest, NextResponse } from "next/server";
import { requireSession, requirePapel, handleApiError, ApiError } from "@/lib/auth/server";
import { criarItemCatalogoSchema } from "@/lib/validation/schemas";
import { prisma } from "@/lib/db";
import { itemPermiteEscopo } from "@/lib/services/regras";

/**
 * GET /api/catalog?escopo=individual|turma
 * Aluno ve so 'individual'+'ambos'; visao de turma (PEC) ve 'turma'+'ambos' (secao 4.3).
 * Admin sem filtro ve tudo (inclusive inativos, para gerenciar).
 */
export async function GET(req: NextRequest) {
  try {
    const session = await requireSession();
    const escopoParam = req.nextUrl.searchParams.get("escopo") as "turma" | "individual" | null;

    if (session.user.papel === "admin" && !escopoParam) {
      const itens = await prisma.itemCatalogo.findMany({ orderBy: { nome: "asc" } });
      return NextResponse.json(itens);
    }

    const todos = await prisma.itemCatalogo.findMany({ where: { ativo: true }, orderBy: { nome: "asc" } });
    const escopoEfetivo = escopoParam ?? (session.user.papel === "aluno" ? "individual" : "turma");
    const filtrados = todos.filter((i) => itemPermiteEscopo(i.escopo, escopoEfetivo));
    return NextResponse.json(filtrados);
  } catch (error) {
    return handleApiError(error);
  }
}

/** POST /api/catalog — cadastro de item, so admin. */
export async function POST(req: NextRequest) {
  try {
    await requirePapel("admin");
    const body = await req.json();
    const parsed = criarItemCatalogoSchema.safeParse(body);
    if (!parsed.success) throw new ApiError(400, parsed.error.issues[0]?.message ?? "Payload invalido.");

    const item = await prisma.itemCatalogo.create({ data: { ...parsed.data, ativo: parsed.data.ativo ?? true } });
    return NextResponse.json(item, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}
