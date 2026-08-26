import { NextRequest, NextResponse } from "next/server";
import { requireSession, handleApiError } from "@/lib/auth/server";
import { prisma } from "@/lib/db";
import { getAnoLetivoAtivo } from "@/lib/services/pointsService";

/**
 * GET /api/extrato — extrato conforme o papel do usuario (secao 4.5):
 *  - aluno: proprio extrato, uma linha por transacao (mesmo vinda de lote).
 *  - professor: lancamentos que ele criou, agrupados por lote_id.
 *  - PEC: extrato completo das turmas que administra, tambem agrupado.
 *  - admin: tudo, com filtros (query params), lotes expansiveis.
 * Filtro comum: ?anoLetivoId=...
 */
export async function GET(req: NextRequest) {
  try {
    const session = await requireSession();
    const anoLetivoIdParam = req.nextUrl.searchParams.get("anoLetivoId");
    const anoLetivo = anoLetivoIdParam
      ? { id: anoLetivoIdParam }
      : await getAnoLetivoAtivo();

    if (session.user.papel === "aluno") {
      const transacoes = await prisma.transacao.findMany({
        where: { destinoTipo: "aluno", destinoId: session.user.id, anoLetivoId: anoLetivo.id },
        orderBy: { criadoEm: "desc" },
      });
      const resgates = await prisma.resgate.findMany({
        where: { alunoId: session.user.id, anoLetivoId: anoLetivo.id },
        include: { item: true },
        orderBy: { criadoEm: "desc" },
      });
      return NextResponse.json({ transacoes, resgates });
    }

    if (session.user.papel === "professor") {
      const proprias = await prisma.transacao.findMany({
        where: { origemUsuarioId: session.user.id, anoLetivoId: anoLetivo.id },
        orderBy: { criadoEm: "desc" },
      });
      const agrupadas = agruparPorLote(proprias);

      // Recebidos como professor (RN-12 credit received)
      const recebidas = await prisma.transacao.findMany({
        where: { destinoTipo: "professor", destinoId: session.user.id },
        orderBy: { criadoEm: "desc" },
      });

      return NextResponse.json({ lotes: agrupadas, recebidas });
    }

    // admin: tudo, com filtros via query params (secao "pendente" do CLAUDE.md - Fase 5)
    const filtros: Record<string, unknown> = { anoLetivoId: anoLetivo.id };
    const turmaId = req.nextUrl.searchParams.get("turmaId");
    const professorId = req.nextUrl.searchParams.get("professorId");
    const casaId = req.nextUrl.searchParams.get("casaId");
    const tipo = req.nextUrl.searchParams.get("tipo") as "credito" | "debito" | "ajuste" | null;
    const dataInicio = req.nextUrl.searchParams.get("dataInicio");
    const dataFim = req.nextUrl.searchParams.get("dataFim");

    if (professorId) filtros.origemUsuarioId = professorId;
    if (turmaId) {
      filtros.destinoTipo = "turma";
      filtros.destinoId = turmaId;
    }
    if (tipo) filtros.tipo = tipo;
    if (dataInicio || dataFim) {
      filtros.criadoEm = {
        ...(dataInicio ? { gte: new Date(dataInicio) } : {}),
        ...(dataFim ? { lte: new Date(`${dataFim}T23:59:59.999`) } : {}),
      };
    }
    if (casaId) {
      // destinoId nao e uma FK tipada (pode ser aluno/turma/professor conforme
      // destinoTipo) - filtrar por Casa exige resolver primeiro os alunos dela.
      const alunosDaCasa = await prisma.usuario.findMany({ where: { casaId, papel: "aluno" }, select: { id: true } });
      filtros.destinoTipo = "aluno";
      filtros.destinoId = { in: alunosDaCasa.map((a) => a.id) };
    }

    const todas = await prisma.transacao.findMany({ where: filtros, orderBy: { criadoEm: "desc" }, take: 500 });
    const agrupadas = agruparPorLote(todas);
    return NextResponse.json({ lotes: agrupadas });
  } catch (error) {
    return handleApiError(error);
  }
}

type TransacaoLike = { loteId: string | null; valor: number; motivo: string; destinoId: string; criadoEm: Date };

function agruparPorLote(transacoes: TransacaoLike[]) {
  const grupos = new Map<string, TransacaoLike[]>();
  for (const t of transacoes) {
    const chave = t.loteId ?? t.destinoId; // sem lote (ex.: ajuste) vira grupo de 1
    if (!grupos.has(chave)) grupos.set(chave, []);
    grupos.get(chave)!.push(t);
  }
  return Array.from(grupos.entries()).map(([loteId, itens]) => ({
    loteId,
    valor: itens[0]?.valor ?? 0,
    motivo: itens[0]?.motivo ?? "",
    criadoEm: itens[0]?.criadoEm,
    quantidadeAlunos: itens.length,
    destinoIds: itens.map((i) => i.destinoId),
  }));
}
