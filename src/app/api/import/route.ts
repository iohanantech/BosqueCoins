import { NextRequest, NextResponse } from "next/server";
import { requirePapel, handleApiError, ApiError } from "@/lib/auth/server";
import { parsePlanilha, validarLinhas } from "@/lib/services/importService";

/**
 * POST /api/import — pre-visualizacao (multipart/form-data com o arquivo).
 * Retorna as linhas ja validadas, SEM gravar nada (secao 4.6).
 */
export async function POST(req: NextRequest) {
  try {
    await requirePapel("admin");
    const formData = await req.formData();
    const arquivo = formData.get("arquivo") as File | null;
    if (!arquivo) throw new ApiError(400, "Nenhum arquivo enviado.");

    const buffer = Buffer.from(await arquivo.arrayBuffer());
    const linhas = parsePlanilha(buffer);
    const validadas = await validarLinhas(linhas);

    return NextResponse.json({ linhas: validadas });
  } catch (error) {
    return handleApiError(error);
  }
}
