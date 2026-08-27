import { prisma } from "@/lib/db";
import { ApiError } from "@/lib/auth/server";
import {
  VALOR_PRESENTE,
  JANELA_PRESENTE_DIAS,
  validarLimiteSemanalPresentes,
  validarDebitoNaoNegativo,
} from "@/lib/services/regras";
import { getAnoLetivoAtivo } from "@/lib/services/pointsService";

const MS_POR_DIA = 24 * 60 * 60 * 1000;

/** Inicio da janela movel de RN-27: `agora` menos JANELA_PRESENTE_DIAS dias corridos. */
function inicioDaJanela(agora = new Date()): Date {
  return new Date(agora.getTime() - JANELA_PRESENTE_DIAS * MS_POR_DIA);
}

export interface StatusPresenteSemana {
  podeEnviar: boolean;
  totalEnviadoNaJanela: number;
  valorPresente: number;
  /** Quantos dias (corridos, arredondado pra cima) ate a janela reabrir e liberar um novo envio. 0 se ja pode enviar. */
  diasAteLiberar: number;
}

/**
 * RN-27 — quanto o aluno ja enviou em presentes na janela movel de 7 dias e,
 * se estourou o teto, quantos dias faltam pra liberar de novo (baseado no
 * presente mais antigo ainda dentro da janela: quando ele "sai", a soma cai).
 * Usado pela tela /presentear e pelo card do dashboard pra avisar ANTES de o
 * aluno tentar enviar.
 */
export async function statusPresenteSemana(remetenteId: string): Promise<StatusPresenteSemana> {
  const agora = new Date();
  const desde = inicioDaJanela(agora);

  const enviadosNaJanela = await prisma.presente.findMany({
    where: { remetenteId, criadoEm: { gte: desde } },
    orderBy: { criadoEm: "asc" },
    select: { valor: true, criadoEm: true },
  });

  const totalEnviadoNaJanela = enviadosNaJanela.reduce((soma, p) => soma + p.valor, 0);
  const podeEnviar = validarLimiteSemanalPresentes(totalEnviadoNaJanela, VALOR_PRESENTE).valido;

  let diasAteLiberar = 0;
  if (!podeEnviar && enviadosNaJanela[0]) {
    const liberaEm = enviadosNaJanela[0].criadoEm.getTime() + JANELA_PRESENTE_DIAS * MS_POR_DIA;
    diasAteLiberar = Math.max(1, Math.ceil((liberaEm - agora.getTime()) / MS_POR_DIA));
  }

  return { podeEnviar, totalEnviadoNaJanela, valorPresente: VALOR_PRESENTE, diasAteLiberar };
}

export interface BuscaAlunoResultado {
  id: string;
  nome: string;
  turma: string | null;
}

/**
 * Autocomplete de /presentear: alunos ATIVOS cujo nome casa com `q`, exceto o
 * proprio usuario logado. Retorna a turma do ano vigente pra desambiguar
 * homonimos. Limitado a poucos resultados de proposito (e um seletor, nao uma
 * listagem).
 */
export async function buscarAlunosPorNome(q: string, excetoUsuarioId: string): Promise<BuscaAlunoResultado[]> {
  const termo = q.trim();
  if (termo.length < 2) return [];

  const anoLetivo = await getAnoLetivoAtivo();

  const alunos = await prisma.usuario.findMany({
    where: {
      papel: "aluno",
      ativo: true,
      id: { not: excetoUsuarioId },
      nome: { contains: termo, mode: "insensitive" },
    },
    orderBy: { nome: "asc" },
    take: 8,
    select: {
      id: true,
      nome: true,
      matriculas: {
        where: { anoLetivoId: anoLetivo.id },
        select: { turma: { select: { nome: true } } },
      },
    },
  });

  return alunos.map((a) => ({ id: a.id, nome: a.nome, turma: a.matriculas[0]?.turma.nome ?? null }));
}

export interface EnviarPresenteInput {
  remetenteId: string; // sempre session.user.id na rota - nunca vem do corpo (RN-08)
  destinatarioId: string;
  mensagem?: string;
}

/**
 * RN-23..RN-27 — transferencia instantanea (sem aprovacao) de VALOR_PRESENTE
 * BosqueCoins do saldo ATUAL do remetente para o do destinatario.
 *
 * DECISAO DE DESIGN IMPORTANTE (RN-25): NAO altera o saldo ACUMULADO de
 * nenhum dos dois alunos.
 *  - Remetente: so `saldoAtual -= valor` (mesma logica de quando gasta num
 *    resgate ou investe - RN-04/RN-16: gastar nao apaga o merito ja
 *    conquistado, entao o acumulado nao cai).
 *  - Destinatario: so `saldoAtual += valor` (DIFERENTE de receber pontos de
 *    um professor, que ai sim e merito e conta pro acumulado).
 * Isso fecha uma brecha de abuso: se o presente somasse no acumulado de quem
 * recebe, dois alunos poderiam se presentear o mesmo valor de ida e volta
 * indefinidamente e inflar o acumulado dos dois sem merito nenhum - e o
 * acumulado e a metrica de prestigio usada em rankings e extratos.
 */
export async function enviarPresente(input: EnviarPresenteInput) {
  const { remetenteId, destinatarioId, mensagem } = input;
  const valor = VALOR_PRESENTE; // RN-24 - fixo, nunca vem do cliente

  // RN-23: remetente != destinatario.
  if (remetenteId === destinatarioId) {
    throw new ApiError(400, "Voce nao pode presentear a si mesmo.");
  }

  const [remetente, destinatario] = await Promise.all([
    prisma.usuario.findUnique({ where: { id: remetenteId } }),
    prisma.usuario.findUnique({ where: { id: destinatarioId } }),
  ]);

  // RN-23: so aluno envia, e so para outro aluno ATIVO.
  if (!remetente || remetente.papel !== "aluno") {
    throw new ApiError(403, "Somente um aluno pode enviar presentes.");
  }
  if (!destinatario || destinatario.papel !== "aluno" || !destinatario.ativo) {
    throw new ApiError(404, "Aluno destinatario nao encontrado.");
  }

  // RN-30: saldo atual precisa cobrir o presente (fast-fail; a checagem
  // definitiva e o UPDATE condicional dentro da transacao abaixo).
  const saldoCheck = validarDebitoNaoNegativo(remetente.saldoAtual, valor);
  if (!saldoCheck.valido) throw new ApiError(400, saldoCheck.erro!);

  const anoLetivo = await getAnoLetivoAtivo();

  return prisma.$transaction(async (tx) => {
    // RN-27: soma dos presentes enviados por este remetente na janela movel de
    // 7 dias corridos, recalculada DENTRO da transacao - duas requisicoes
    // concorrentes nao podem furar o limite mandando dois presentes "ao mesmo
    // tempo".
    const desde = inicioDaJanela();
    const naJanela = await tx.presente.aggregate({
      where: { remetenteId, criadoEm: { gte: desde } },
      _sum: { valor: true },
    });
    const limiteCheck = validarLimiteSemanalPresentes(naJanela._sum.valor ?? 0, valor);
    if (!limiteCheck.valido) {
      const status = await statusPresenteSemana(remetenteId);
      const emXDias = status.diasAteLiberar > 0 ? ` Volte em ${status.diasAteLiberar} dia${status.diasAteLiberar > 1 ? "s" : ""}.` : "";
      throw new ApiError(400, `Voce ja usou seu presente da semana.${emXDias}`);
    }

    // RN-30/RN-06: debito condicional atomico - o UPDATE so afeta a linha se
    // saldoAtual >= valor ainda for verdade NAQUELE instante. Quem perder a
    // corrida tem count === 0 e a transacao e abortada, sem saldo negativo.
    // RN-25: nao toca em saldoAcumulado.
    const debitado = await tx.usuario.updateMany({
      where: { id: remetenteId, saldoAtual: { gte: valor } },
      data: { saldoAtual: { decrement: valor } },
    });
    if (debitado.count === 0) throw new ApiError(400, "Saldo atual insuficiente para enviar este presente.");

    // RN-25: destinatario ganha so no saldoAtual - o acumulado NAO muda.
    await tx.usuario.update({
      where: { id: destinatarioId },
      data: { saldoAtual: { increment: valor } },
    });

    const presente = await tx.presente.create({
      data: { remetenteId, destinatarioId, valor, mensagem: mensagem?.trim() || null },
    });

    // RN-21-style: registra as duas pernas da transferencia como Transacao,
    // com loteId = presente.id, reaproveitando o agrupamento por lote que o
    // extrato ja tem (agruparPorLote). O `motivo` ja carrega o nome da outra
    // pessoa, entao o extrato do aluno mostra "Presente enviado/recebido..."
    // sem precisar de codigo de exibicao novo.
    await tx.transacao.create({
      data: {
        anoLetivoId: anoLetivo.id,
        tipo: "debito",
        valor,
        motivo: `Presente enviado para ${destinatario.nome}`,
        origemUsuarioId: remetenteId,
        destinoTipo: "aluno",
        destinoId: remetenteId,
        loteId: presente.id,
      },
    });
    await tx.transacao.create({
      data: {
        anoLetivoId: anoLetivo.id,
        tipo: "credito",
        valor,
        motivo: `Presente recebido de ${remetente.nome}`,
        origemUsuarioId: remetenteId,
        destinoTipo: "aluno",
        destinoId: destinatarioId,
        loteId: presente.id,
      },
    });

    return presente;
  });
}
