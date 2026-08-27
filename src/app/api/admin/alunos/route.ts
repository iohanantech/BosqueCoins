import { NextRequest, NextResponse } from "next/server";
import { requirePapel, handleApiError, ApiError } from "@/lib/auth/server";
import { criarAlunoSchema } from "@/lib/validation/schemas";
import { ALLOWED_EMAIL_DOMAIN, emailDominioPermitido } from "@/lib/auth/dominioEmail";
import { prisma } from "@/lib/db";
import { getAnoLetivoAtivo } from "@/lib/services/pointsService";

/**
 * POST /api/admin/alunos — coordenação cadastra UM aluno manualmente, sem
 * planilha (mesmo resultado de uma linha da importação: cria o usuário com
 * papel 'aluno' e a matrícula na turma do ano letivo vigente).
 *
 * Turma obrigatória: `turmaId` (existente) OU `turmaNome` (criada na hora,
 * igual ao fluxo de importação). Casa opcional via `casaId`.
 * Checagem de domínio (RN-10) é opcional — só barra quando ALLOWED_EMAIL_DOMAIN
 * está definido.
 */
export async function POST(req: NextRequest) {
  try {
    await requirePapel("admin");
    const body = await req.json();
    const parsed = criarAlunoSchema.safeParse(body);
    if (!parsed.success) throw new ApiError(400, parsed.error.issues[0]?.message ?? "Payload invalido.");

    const { nome, email, turmaId, turmaNome, casaId } = parsed.data;

    if (!emailDominioPermitido(email)) {
      throw new ApiError(400, `O e-mail precisa ser do domínio @${ALLOWED_EMAIL_DOMAIN}.`);
    }

    const existente = await prisma.usuario.findUnique({ where: { email } });
    if (existente) throw new ApiError(400, "Já existe um usuário cadastrado com esse e-mail.");

    if (casaId) {
      const casa = await prisma.casa.findUnique({ where: { id: casaId } });
      if (!casa) throw new ApiError(400, "Casa não encontrada.");
    }

    const anoLetivo = await getAnoLetivoAtivo();

    const aluno = await prisma.$transaction(async (tx) => {
      let turma;
      if (turmaId) {
        turma = await tx.turma.findUnique({ where: { id: turmaId } });
        if (!turma) throw new ApiError(400, "Turma não encontrada.");
      } else {
        const nomeTurma = turmaNome!.trim();
        turma =
          (await tx.turma.findUnique({ where: { nome: nomeTurma } })) ??
          (await tx.turma.create({ data: { nome: nomeTurma, serie: nomeTurma, ativo: true } }));
      }

      const novo = await tx.usuario.create({
        data: { nome, email, papel: "aluno", casaId: casaId ?? null },
      });
      await tx.matricula.create({
        data: { alunoId: novo.id, turmaId: turma.id, anoLetivoId: anoLetivo.id },
      });

      return novo;
    });

    return NextResponse.json(aluno, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}
