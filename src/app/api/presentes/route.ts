import { NextRequest, NextResponse } from "next/server";
import { requirePapel, handleApiError, ApiError } from "@/lib/auth/server";
import { enviarPresenteSchema } from "@/lib/validation/schemas";
import { enviarPresente, statusPresenteSemana } from "@/lib/services/presenteService";

/**
 * GET /api/presentes — status do limite semanal (RN-27) do aluno logado:
 * se ja pode enviar, quanto ja enviou na janela de 7 dias e quantos dias
 * faltam pra liberar. Usado por /presentear e pelo card do dashboard pra
 * avisar ANTES de o aluno tentar enviar.
 */
export async function GET() {
  try {
    const session = await requirePapel("aluno");
    return NextResponse.json(await statusPresenteSemana(session.user.id));
  } catch (error) {
    return handleApiError(error);
  }
}

/**
 * POST /api/presentes — envia um presente (transferencia instantanea, sem
 * aprovacao). So aluno (RN-23). O corpo traz apenas { destinatarioId,
 * mensagem? }: o valor e sempre VALOR_PRESENTE, fixo no backend (RN-24), e o
 * remetente e sempre a sessao, nunca o corpo (RN-08).
 */
export async function POST(req: NextRequest) {
  try {
    const session = await requirePapel("aluno");
    const body = await req.json();
    const parsed = enviarPresenteSchema.safeParse(body);
    if (!parsed.success) throw new ApiError(400, parsed.error.issues[0]?.message ?? "Payload invalido.");

    const presente = await enviarPresente({
      remetenteId: session.user.id,
      destinatarioId: parsed.data.destinatarioId,
      mensagem: parsed.data.mensagem,
    });
    return NextResponse.json(presente, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}
