import { NextResponse } from "next/server";
import { requirePapel, handleApiError } from "@/lib/auth/server";
import { prisma } from "@/lib/db";
import { getAnoLetivoAtivo } from "@/lib/services/pointsService";

/** GET /api/pec/turmas — turmas que o professor logado administra como PEC no ano vigente (RN-09). */
export async function GET() {
  try {
    const session = await requirePapel("professor", "admin");
    const anoLetivo = await getAnoLetivoAtivo();

    const vinculos = await prisma.professorPecTurma.findMany({
      where: { professorId: session.user.id, anoLetivoId: anoLetivo.id },
      include: { turma: true },
    });

    return NextResponse.json(vinculos.map((v) => v.turma));
  } catch (error) {
    return handleApiError(error);
  }
}
