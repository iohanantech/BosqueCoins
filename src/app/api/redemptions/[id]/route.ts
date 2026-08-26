import { NextRequest, NextResponse } from "next/server";
import { requirePapel, handleApiError, ApiError } from "@/lib/auth/server";
import { resolverResgateSchema } from "@/lib/validation/schemas";
import { resolverResgate } from "@/lib/services/redemptionService";

/** PATCH /api/redemptions/:id — aprovar/recusar. Admin ou PEC da turma (checado no service). */
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await requirePapel("admin", "professor");
    const body = await req.json();
    const parsed = resolverResgateSchema.safeParse(body);
    if (!parsed.success) throw new ApiError(400, parsed.error.issues[0]?.message ?? "Payload invalido.");

    const resultado = await resolverResgate({
      resgateId: params.id,
      aprovadorId: session.user.id,
      aprovadorPapel: session.user.papel,
      decisao: parsed.data.decisao,
      motivoRecusa: parsed.data.motivoRecusa,
    });

    return NextResponse.json(resultado);
  } catch (error) {
    return handleApiError(error);
  }
}
