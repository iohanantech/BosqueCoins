import { NextRequest, NextResponse } from "next/server";
import { requirePapel, handleApiError, ApiError } from "@/lib/auth/server";
import { distribuirPontosSchema } from "@/lib/validation/schemas";
import { distribuirPontos } from "@/lib/services/pointsService";

/**
 * POST /api/points/individual
 * Distribuicao de pontos "individual em lote" ou "turma toda" (secao 4.2) -
 * ambos os modos usam este mesmo endpoint; a UI apenas monta `alunoIds`
 * diferente (subconjunto marcado, ou todos os matriculados na turma).
 */
export async function POST(req: NextRequest) {
  try {
    const session = await requirePapel("professor", "admin");
    const body = await req.json();
    const parsed = distribuirPontosSchema.safeParse(body);
    if (!parsed.success) {
      throw new ApiError(400, parsed.error.issues[0]?.message ?? "Payload invalido.");
    }

    const resultado = await distribuirPontos({
      ...parsed.data,
      autorId: session.user.id,
      autorPapel: session.user.papel,
    });

    return NextResponse.json(resultado, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}
