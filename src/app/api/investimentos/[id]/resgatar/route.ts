import { NextRequest, NextResponse } from "next/server";
import { requireSession, handleApiError, ApiError, garantirAcessoProprioOuAdmin } from "@/lib/auth/server";
import { prisma } from "@/lib/db";
import { resgatarInvestimento } from "@/lib/services/investmentService";

/** POST /api/investimentos/:id/resgatar — aluno resgata o proprio investimento reversivel (ou admin, RN-15). */
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await requireSession();

    const investimento = await prisma.investimento.findUnique({ where: { id: params.id } });
    if (!investimento) throw new ApiError(404, "Investimento não encontrado.");

    garantirAcessoProprioOuAdmin(session, investimento.alunoId);

    const resultado = await resgatarInvestimento({ investimentoId: params.id, alunoId: investimento.alunoId });
    return NextResponse.json(resultado);
  } catch (error) {
    return handleApiError(error);
  }
}
