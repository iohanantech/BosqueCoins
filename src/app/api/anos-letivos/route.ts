import { NextRequest, NextResponse } from "next/server";
import { requireSession, requirePapel, handleApiError, ApiError } from "@/lib/auth/server";
import { criarAnoLetivoSchema } from "@/lib/validation/schemas";
import { abrirPrimeiroAnoLetivo } from "@/lib/services/anoLetivoService";
import { prisma } from "@/lib/db";

/**
 * GET /api/anos-letivos — lista os anos letivos e diz se o sistema ja foi
 * "inicializado" (existe ao menos um ano). Qualquer usuario autenticado pode
 * ler; a tela /admin/ano-letivo usa `total` para decidir se mostra o
 * formulario de "abrir o primeiro ano".
 */
export async function GET() {
  try {
    await requireSession();
    const anos = await prisma.anoLetivo.findMany({ orderBy: { nome: "desc" } });
    return NextResponse.json({
      total: anos.length,
      temAtivo: anos.some((a) => a.ativo),
      anos,
    });
  } catch (error) {
    return handleApiError(error);
  }
}

/**
 * POST /api/anos-letivos — abre o PRIMEIRO ano letivo (so admin, so quando
 * ainda nao existe nenhum). A virada de ano a partir dai e feita por
 * POST /api/anos-letivos/encerrar.
 */
export async function POST(req: NextRequest) {
  try {
    await requirePapel("admin");
    const body = await req.json();
    const parsed = criarAnoLetivoSchema.safeParse(body);
    if (!parsed.success) throw new ApiError(400, parsed.error.issues[0]?.message ?? "Payload invalido.");

    const ano = await abrirPrimeiroAnoLetivo(parsed.data);
    return NextResponse.json(ano, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}
