import { NextRequest, NextResponse } from "next/server";
import { requirePapel, handleApiError, ApiError } from "@/lib/auth/server";
import { encerrarAnoSchema } from "@/lib/validation/schemas";
import { encerrarAnoLetivo } from "@/lib/services/anoLetivoService";

/** POST /api/anos-letivos/encerrar — so admin (secao 5, item 5). */
export async function POST(req: NextRequest) {
  try {
    await requirePapel("admin");
    const body = await req.json();
    const parsed = encerrarAnoSchema.safeParse(body);
    if (!parsed.success) throw new ApiError(400, parsed.error.issues[0]?.message ?? "Payload invalido.");

    const novoAno = await encerrarAnoLetivo(parsed.data);
    return NextResponse.json(novoAno, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}
