import { prisma } from "@/lib/db";
import { ApiError } from "@/lib/auth/server";
import type { z } from "zod";
import type { encerrarAnoSchema } from "@/lib/validation/schemas";

type EncerrarAnoInput = z.infer<typeof encerrarAnoSchema>;

/**
 * Encerramento do ano letivo (secao 5): "zerar pontos" e "encerrar o ano
 * letivo" sao a MESMA acao (pressuposto 2, secao 12). Cria o proximo ano
 * letivo, marca o atual como encerrado/inativo e o novo como ativo.
 *
 * Os saldos de turma/Casa do ano anterior NUNCA sao apagados (ficam em
 * `TurmaPeriodo`/`CasaPeriodo` daquele ano, consultaveis para sempre).
 * `TurmaPeriodo`/`CasaPeriodo` do novo ano comecam zerados (default 0).
 * O saldo vitalicio do aluno/professor em `Usuario` nao e alterado.
 */
export async function encerrarAnoLetivo(input: EncerrarAnoInput) {
  const anoAtivo = await prisma.anoLetivo.findFirst({ where: { ativo: true } });
  if (!anoAtivo) throw new ApiError(500, "Nenhum ano letivo ativo. Contate o administrador.");

  const existente = await prisma.anoLetivo.findUnique({ where: { nome: input.nomeProximoAno } });
  if (existente) throw new ApiError(400, "Ja existe um ano letivo com esse nome.");

  return prisma.$transaction(async (tx) => {
    await tx.anoLetivo.update({
      where: { id: anoAtivo.id },
      data: { ativo: false, encerrado: true },
    });

    const novoAno = await tx.anoLetivo.create({
      data: {
        nome: input.nomeProximoAno,
        dataInicio: input.dataInicioProximoAno,
        dataFim: input.dataFimProximoAno,
        ativo: true,
      },
    });

    return novoAno;
  });
}
