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

    // Busca um lote de linhas cruas maior que o exibido - o corte real
    // acontece DEPOIS de agrupar (ver comentario abaixo), nao aqui.
    const LIMITE_BRUTO = 2000;
    const todas = await prisma.transacao.findMany({ where: filtros, orderBy: { criadoEm: "desc" }, take: LIMITE_BRUTO });
    const agrupadas = agruparPorLote(todas);

    // Cortar as linhas CRUAS em 500 (como antes) podia partir um lote ao meio
    // (ex.: um lançamento de 30 alunos aparecia com só 12) porque o corte não
    // respeitava a fronteira do agrupamento. Aqui o corte é em LOTES (unidade
    // que a UI de fato exibe), e se houver mais do que isso - ou se a busca
    // crua já bateu no teto acima, sinal de que pode haver ainda mais - o
    // front recebe `truncado: true` para avisar o admin a refinar os filtros.
    const LIMITE_LOTES = 300;
    const truncadoPorLimiteBruto = todas.length === LIMITE_BRUTO;
    const truncado = agrupadas.length > LIMITE_LOTES || truncadoPorLimiteBruto;
    const lotesExibidos = agrupadas.slice(0, LIMITE_LOTES);

    return NextResponse.json({ lotes: lotesExibidos, truncado });
  } catch (error) {
    return handleApiError(error);
  }
}

type TransacaoLike = { id: string; loteId: string | null; valor: number; motivo: string; destinoId: string; criadoEm: Date };

function agruparPorLote(transacoes: TransacaoLike[]) {
  const grupos = new Map<string, TransacaoLike[]>();
  for (const t of transacoes) {
    // Sem loteId (ajuste de turma, investimento...), cada transacao e o seu
    // proprio grupo de 1 - usar t.destinoId aqui (como antes) colapsava
    // erradamente TODAS as transacoes sem lote de um mesmo destino (ex.:
    // varios investimentos do mesmo aluno, ou varios ajustes na mesma turma)
    // num unico "lote" fantasma, escondendo motivo/valor dos demais.
    const chave = t.loteId ?? t.id;
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
