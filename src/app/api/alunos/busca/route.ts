import { NextRequest, NextResponse } from "next/server";
import { requirePapel, handleApiError } from "@/lib/auth/server";
import { buscarAlunosPorNome } from "@/lib/services/presenteService";

/**
 * GET /api/alunos/busca?q=<nome> — autocomplete de nomes para /presentear.
 * So o aluno usa (RN-23 - so aluno envia presente). Nunca retorna o proprio
 * usuario logado; so alunos ativos; poucos resultados, com a turma do ano
 * vigente para desambiguar homonimos.
 */
export async function GET(req: NextRequest) {
  try {
    const session = await requirePapel("aluno");
    const q = req.nextUrl.searchParams.get("q") ?? "";
    const resultados = await buscarAlunosPorNome(q, session.user.id);
    return NextResponse.json(resultados);
  } catch (error) {
    return handleApiError(error);
  }
}
