import { NextRequest, NextResponse } from "next/server";
import { requirePapel, handleApiError, ApiError } from "@/lib/auth/server";
import { confirmarImportacao, validarLinhas } from "@/lib/services/importService";
import { confirmarImportacaoSchema, linhaImportacaoSchema } from "@/lib/validation/schemas";
import { z } from "zod";

/**
 * POST /api/import/confirmar — grava de fato, apos a pre-visualizacao ser
 * aprovada pelo admin. Recebe de volta as MESMAS linhas que /api/import
 * devolveu na pre-visualizacao, mas nao confia no `status`/`usuarioExistenteId`
 * que vieram no payload (o cliente que os leva e o mesmo que os recebeu -
 * um payload forjado poderia declarar qualquer linha "ok", inclusive de
 * dominio externo, ou apontar usuarioExistenteId para a conta de outro
 * usuario) - revalida do zero aqui, so com os campos crus da planilha.
 */
export async function POST(req: NextRequest) {
  try {
    await requirePapel("admin");
    const body = await req.json();
    const parsed = confirmarImportacaoSchema.safeParse(body);
    if (!parsed.success) throw new ApiError(400, parsed.error.issues[0]?.message ?? "Payload invalido.");

    const linhasParsed = z.array(linhaImportacaoSchema).safeParse(body.linhas);
    if (!linhasParsed.success) throw new ApiError(400, "Linhas invalidas.");

    const linhas = await validarLinhas(linhasParsed.data);

    const resumo = await confirmarImportacao({ ...parsed.data, linhas });
    return NextResponse.json(resumo);
  } catch (error) {
    return handleApiError(error);
  }
}
