import { NextRequest, NextResponse } from "next/server";
import { requireSession, handleApiError, ApiError, garantirAcessoProprioOuAdmin } from "@/lib/auth/server";
import { investirSchema } from "@/lib/validation/schemas";
import { investir, listarInvestimentos, resumoInvestimentos } from "@/lib/services/investmentService";

/**
 * GET /api/investimentos — lista os investimentos do aluno logado (ativos
 * com valor atual + resgatados). Com ?resumo=true, retorna so o resumo
 * agregado usado no card "Investir" do dashboard (mais barato de calcular).
 */
export async function GET(req: NextRequest) {
  try {
    const session = await requireSession();
    const alunoIdParam = req.nextUrl.searchParams.get("alunoId");
    const alunoId = alunoIdParam ?? session.user.id;
    garantirAcessoProprioOuAdmin(session, alunoId);

    if (req.nextUrl.searchParams.get("resumo") === "true") {
      return NextResponse.json(await resumoInvestimentos(alunoId));
    }

    const investimentos = await listarInvestimentos(alunoId);
    return NextResponse.json(investimentos);
  } catch (error) {
    return handleApiError(error);
  }
}

/** POST /api/investimentos — aluno investe o proprio saldo (ou admin, em nome do aluno - RN-15). */
export async function POST(req: NextRequest) {
  try {
    const session = await requireSession();
    const body = await req.json();
    const parsed = investirSchema.safeParse(body);
    if (!parsed.success) throw new ApiError(400, parsed.error.issues[0]?.message ?? "Payload invalido.");

    const alunoId = parsed.data.alunoId ?? session.user.id;
    garantirAcessoProprioOuAdmin(session, alunoId);
    if (session.user.papel === "professor") {
      throw new ApiError(403, "Somente o próprio aluno (ou admin) pode investir o saldo de um aluno.");
    }

    const resultado = await investir({ alunoId, tipo: parsed.data.tipo, valor: parsed.data.valor });
    return NextResponse.json(resultado, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}
