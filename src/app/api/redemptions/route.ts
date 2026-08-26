import { NextRequest, NextResponse } from "next/server";
import { requireSession, handleApiError, ApiError, garantirAcessoProprioOuAdmin } from "@/lib/auth/server";
import { solicitarResgateSchema } from "@/lib/validation/schemas";
import { solicitarResgate } from "@/lib/services/redemptionService";
import { prisma } from "@/lib/db";
import { getAnoLetivoAtivo, ehPecDaTurma } from "@/lib/services/pointsService";

/**
 * GET /api/redemptions — lista resgates visiveis ao usuario logado:
 * aluno ve so os proprios; PEC ve os das turmas que administra + os
 * individuais dos alunos dessas turmas; admin ve tudo.
 */
export async function GET() {
  try {
    const session = await requireSession();

    if (session.user.papel === "admin") {
      const todos = await prisma.resgate.findMany({ include: { item: true }, orderBy: { criadoEm: "desc" } });
      return NextResponse.json(todos);
    }

    if (session.user.papel === "aluno") {
      const meus = await prisma.resgate.findMany({
        where: { alunoId: session.user.id },
        include: { item: true },
        orderBy: { criadoEm: "desc" },
      });
      return NextResponse.json(meus);
    }

    // professor/PEC: resgates de turma das turmas que administra, MAIS os
    // resgates individuais dos alunos matriculados nessas turmas (o PEC tem
    // permissao de aprovar ambos - ver redemptionService.ts::resolverResgate -
    // entao precisam aparecer aqui tambem, senao ficam invisiveis para ele).
    const anoLetivo = await getAnoLetivoAtivo();
    const minhasTurmas = await prisma.professorPecTurma.findMany({
      where: { professorId: session.user.id, anoLetivoId: anoLetivo.id },
      select: { turmaId: true },
    });
    const turmaIds = minhasTurmas.map((t) => t.turmaId);
    const matriculasDasMinhasTurmas = await prisma.matricula.findMany({
      where: { turmaId: { in: turmaIds }, anoLetivoId: anoLetivo.id },
      select: { alunoId: true },
    });
    const alunoIds = matriculasDasMinhasTurmas.map((m) => m.alunoId);
    const daTurma = await prisma.resgate.findMany({
      where: { OR: [{ turmaId: { in: turmaIds } }, { alunoId: { in: alunoIds } }] },
      include: { item: true },
      orderBy: { criadoEm: "desc" },
    });
    return NextResponse.json(daTurma);
  } catch (error) {
    return handleApiError(error);
  }
}

/** POST /api/redemptions — solicitar resgate (aluno para individual, PEC/admin para turma). */
export async function POST(req: NextRequest) {
  try {
    const session = await requireSession();
    const body = await req.json();
    const parsed = solicitarResgateSchema.safeParse(body);
    if (!parsed.success) throw new ApiError(400, parsed.error.issues[0]?.message ?? "Payload invalido.");

    if (parsed.data.escopo === "individual") {
      // Aluno so pode solicitar para si mesmo (RN-08); admin pode solicitar em nome de um aluno.
      const alunoId = parsed.data.alunoId ?? session.user.id;
      garantirAcessoProprioOuAdmin(session, alunoId);
      const resgate = await solicitarResgate({ ...parsed.data, alunoId, solicitanteId: session.user.id });
      return NextResponse.json(resgate, { status: 201 });
    }

    // escopo turma: so PEC da turma ou admin (secao 4.2.1 do texto - "PEC (ou admin) solicita")
    if (session.user.papel === "professor") {
      const anoLetivo = await getAnoLetivoAtivo();
      const pec = parsed.data.turmaId ? await ehPecDaTurma(session.user.id, parsed.data.turmaId, anoLetivo.id) : false;
      if (!pec) throw new ApiError(403, "Somente o PEC da turma pode solicitar resgates de turma.");
    } else if (session.user.papel === "aluno") {
      throw new ApiError(403, "Alunos nao podem solicitar resgates de turma.");
    }

    const resgate = await solicitarResgate({ ...parsed.data, solicitanteId: session.user.id });
    return NextResponse.json(resgate, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}
