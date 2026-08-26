import { NextRequest, NextResponse } from "next/server";
import { requirePapel, handleApiError, ApiError } from "@/lib/auth/server";
import { confirmarImportacao, type LinhaValidada } from "@/lib/services/importService";
import { confirmarImportacaoSchema } from "@/lib/validation/schemas";

/** POST /api/import/confirmar — grava de fato, apos a pre-visualizacao ser aprovada pelo admin. */
export async function POST(req: NextRequest) {
  try {
    await requirePapel("admin");
    const body = await req.json();
    const parsed = confirmarImportacaoSchema.safeParse(body);
    if (!parsed.success) throw new ApiError(400, parsed.error.issues[0]?.message ?? "Payload invalido.");

    const linhas = body.linhas as LinhaValidada[];
    if (!Array.isArray(linhas)) throw new ApiError(400, "Linhas invalidas.");

    const resumo = await confirmarImportacao({ ...parsed.data, linhas });
    return NextResponse.json(resumo);
  } catch (error) {
    return handleApiError(error);
  }
}
