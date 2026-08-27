import { NextRequest, NextResponse } from "next/server";
import { requirePapel, handleApiError, ApiError } from "@/lib/auth/server";
import { criarProfessorSchema } from "@/lib/validation/schemas";
import { ALLOWED_EMAIL_DOMAIN, emailDominioPermitido } from "@/lib/auth/dominioEmail";
import { prisma } from "@/lib/db";
import { getAnoLetivoAtivo } from "@/lib/services/pointsService";

/**
 * POST /api/admin/professores — coordenação cadastra um professor individualmente
 * (mesma checagem de domínio do login — RN-10, opcional), com a opção de já
 * marcá-lo como PEC de uma ou mais turmas no ano letivo vigente (RN-09).
 */
export async function POST(req: NextRequest) {
  try {
    await requirePapel("admin");
    const body = await req.json();
    const parsed = criarProfessorSchema.safeParse(body);
    if (!parsed.success) throw new ApiError(400, parsed.error.issues[0]?.message ?? "Payload invalido.");

    const { nome, email, turmasPecIds } = parsed.data;

    if (!emailDominioPermitido(email)) {
      throw new ApiError(400, `O e-mail precisa ser do domínio @${ALLOWED_EMAIL_DOMAIN}.`);
    }

    const existente = await prisma.usuario.findUnique({ where: { email } });
    if (existente) throw new ApiError(400, "Já existe um usuário cadastrado com esse e-mail.");

    const anoLetivo = turmasPecIds.length > 0 ? await getAnoLetivoAtivo() : null;

    const professor = await prisma.$transaction(async (tx) => {
      const novo = await tx.usuario.create({ data: { nome, email, papel: "professor" } });

      if (anoLetivo) {
        await tx.professorPecTurma.createMany({
          data: turmasPecIds.map((turmaId) => ({ professorId: novo.id, turmaId, anoLetivoId: anoLetivo.id })),
        });
      }

      return novo;
    });

    return NextResponse.json(professor, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}
