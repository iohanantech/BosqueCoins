import { NextRequest, NextResponse } from "next/server";
import { requirePapel, handleApiError, ApiError } from "@/lib/auth/server";
import { ajustarSaldoTurmaSchema } from "@/lib/validation/schemas";
import { ajustarSaldoTurma, ehPecDaTurma, getAnoLetivoAtivo } from "@/lib/services/pointsService";

/** POST /api/points/turma — ajuste manual de saldo da turma, exclusivo de PEC/admin (RN-05, RN-09). */
export async function POST(req: NextRequest) {
  try {
    const session = await requirePapel("professor", "admin");
    const body = await req.json();
    const parsed = ajustarSaldoTurmaSchema.safeParse(body);
    if (!parsed.success) throw new ApiError(400, parsed.error.issues[0]?.message ?? "Payload invalido.");

    if (session.user.papel === "professor") {
      const anoLetivo = await getAnoLetivoAtivo();
      const pec = await ehPecDaTurma(session.user.id, parsed.data.turmaId, anoLetivo.id);
      if (!pec) throw new ApiError(403, "Somente o PEC da turma pode fazer ajustes manuais de saldo.");
    }

    await ajustarSaldoTurma({
      ...parsed.data,
      autorId: session.user.id,
      autorPapel: session.user.papel,
    });

    return NextResponse.json({ ok: true }, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}
