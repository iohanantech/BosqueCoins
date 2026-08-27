import { prisma } from "@/lib/db";
import { ApiError } from "@/lib/auth/server";
import type { z } from "zod";
import type { encerrarAnoSchema, criarAnoLetivoSchema } from "@/lib/validation/schemas";

type EncerrarAnoInput = z.infer<typeof encerrarAnoSchema>;
type CriarAnoInput = z.infer<typeof criarAnoLetivoSchema>;

/**
 * Abre o PRIMEIRO ano letivo de um ambiente novo. Sem isto, um deploy limpo
 * fica travado: `getAnoLetivoAtivo` lanca 500 em ~10 rotas (dashboard,
 * cadastro de aluno, extrato...) e a unica outra forma de criar um ano
 * (`encerrarAnoLetivo`) exige um ano ativo pra rodar - beco sem saida.
 *
 * So funciona quando NAO existe nenhum ano letivo. A partir do segundo ano,
 * a virada e sempre por `encerrarAnoLetivo` (fecha o vigente, abre o proximo).
 */
export async function abrirPrimeiroAnoLetivo(input: CriarAnoInput) {
  const jaExiste = await prisma.anoLetivo.count();
  if (jaExiste > 0) {
    throw new ApiError(409, "Ja existe ano letivo. Use 'Encerrar ano letivo' para abrir o proximo.");
  }

  return prisma.anoLetivo.create({
    data: {
      nome: input.nome,
      dataInicio: input.dataInicio,
      dataFim: input.dataFim,
      ativo: true,
    },
  });
}

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
