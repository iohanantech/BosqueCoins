/**
 * Regras de negocio puras do motor de pontos (ESPECIFICACAO.md secao 6).
 *
 * Este arquivo NAO toca banco de dados de proposito: toda regra que pode ser
 * expressa como funcao pura (entrada -> saida, sem I/O) fica aqui, para que
 * cubramos RN-01..RN-14 com testes unitarios rapidos e deterministicos,
 * independentes de Postgres/Prisma estarem disponiveis.
 *
 * A orquestracao com banco (transacoes atomicas, locks) fica em
 * `pointsService.ts`, que importa e usa estas funcoes antes/depois de tocar
 * no Prisma.
 */

export const LIMITE_PROFESSOR_COMUM_POR_LOTE = 10; // RN-14

export type Papel = "admin" | "professor" | "aluno";

export interface AutorContexto {
  papel: Papel;
  /** true se o autor e PEC da turma alvo NAQUELE ano letivo (RN-09, secao 12 item 5) */
  ehPecDaTurmaAlvo: boolean;
}

export interface ValidacaoResultado {
  valido: boolean;
  erro?: string;
}

/**
 * RN-14 — Limite de valor para professor comum.
 * Professor sem permissao de PEC na turma daquele aluno: maximo 10 BosqueCoins
 * por aluno, por lote. PEC (nas turmas que administra) e admin: sem limite.
 * O limite e avaliado por lote, nao agregado no tempo (secao 12, item 4).
 */
export function validarLimiteValorPorLote(
  valor: number,
  autor: AutorContexto
): ValidacaoResultado {
  if (autor.papel === "admin") return { valido: true };
  if (autor.papel === "professor" && autor.ehPecDaTurmaAlvo) return { valido: true };
  if (autor.papel === "professor" && !autor.ehPecDaTurmaAlvo) {
    if (valor > LIMITE_PROFESSOR_COMUM_POR_LOTE) {
      return {
        valido: false,
        erro: `Professores sem permissao de PEC nesta turma podem dar no maximo ${LIMITE_PROFESSOR_COMUM_POR_LOTE} BosqueCoins por aluno, por lancamento.`,
      };
    }
    return { valido: true };
  }
  return { valido: false, erro: "Alunos nao podem distribuir BosqueCoins." };
}

/** RN-03 — Motivo obrigatorio: nao pode ser vazio ou so espacos. */
export function validarMotivo(motivo: string): ValidacaoResultado {
  if (!motivo || motivo.trim().length === 0) {
    return { valido: false, erro: "O motivo e obrigatorio." };
  }
  return { valido: true };
}

/** Valor deve ser inteiro positivo (BosqueCoins nao tem centavos). */
export function validarValorInteiroPositivo(valor: number): ValidacaoResultado {
  if (!Number.isInteger(valor) || valor <= 0) {
    return { valido: false, erro: "O valor deve ser um numero inteiro positivo." };
  }
  return { valido: true };
}

/** RN-06 — Saldo nunca negativo. Usado na aprovacao de resgates e em debitos/ajustes. */
export function validarDebitoNaoNegativo(saldoAtual: number, valorDebitado: number): ValidacaoResultado {
  if (saldoAtual - valorDebitado < 0) {
    return { valido: false, erro: "Saldo atual insuficiente para esta operacao." };
  }
  return { valido: true };
}

/** RN-12 — Só admin pode creditar professor. */
export function validarQuemPontuaProfessor(papelAutor: Papel): ValidacaoResultado {
  if (papelAutor !== "admin") {
    return { valido: false, erro: "Somente o administrador pode dar BosqueCoins a um professor." };
  }
  return { valido: true };
}

/**
 * RN-09 — Escopo do PEC: a turma alvo precisa estar entre as turmas
 * atribuidas aquele usuario NO ANO LETIVO VIGENTE.
 */
export function validarEscopoPec(
  turmaAlvoId: string,
  turmasAdministradasNoAno: string[]
): ValidacaoResultado {
  if (!turmasAdministradasNoAno.includes(turmaAlvoId)) {
    return { valido: false, erro: "Voce nao administra esta turma no ano letivo vigente." };
  }
  return { valido: true };
}

/**
 * RN-01 — Propagacao tripla.
 * Dado um credito a um aluno, calcula os deltas a aplicar nos tres saldos
 * (aluno vitalicio, turma do ano, casa do ano), nas duas leituras
 * (atual e acumulado). Retorna os deltas; quem aplica no banco e o service.
 */
export interface DeltaPropagacao {
  aluno: { saldoAtual: number; saldoAcumulado: number };
  turma: { saldoAtual: number; saldoAcumulado: number };
  casa: { saldoAtual: number; saldoAcumulado: number };
}

export function calcularPropagacaoCredito(valor: number): DeltaPropagacao {
  return {
    aluno: { saldoAtual: valor, saldoAcumulado: valor },
    turma: { saldoAtual: valor, saldoAcumulado: valor },
    casa: { saldoAtual: valor, saldoAcumulado: valor },
  };
}

/**
 * RN-04 — Resgate individual so debita o saldo pessoal ATUAL do aluno.
 * Nao gera nenhum delta de turma/Casa. Documentado aqui para deixar
 * explicito que e intencional (nao e um bug de propagacao incompleta).
 */
export function calcularDebitoResgateIndividual(valor: number): { saldoAtual: number } {
  return { saldoAtual: -valor };
}

/** RN-05 — Ajuste de PEC so mexe no saldo da turma, nunca em Casa/aluno. */
export function calcularAjusteTurma(
  valor: number,
  direcao: "credito" | "debito"
): { saldoAtual: number; saldoAcumulado: number } {
  const sinal = direcao === "credito" ? 1 : -1;
  return {
    saldoAtual: sinal * valor,
    // Debito de ajuste tambem reduz o acumulado (diferente de resgate - RN-06 comentario):
    // um ajuste corrige um lancamento errado, entao deve corrigir a "conquista" tambem,
    // ao contrario de um resgate que so gasta o saldo atual.
    saldoAcumulado: sinal * valor,
  };
}

/** Media por aluno para o ranking de Salas (secao 4.1) — calculada em consulta, nao armazenada. */
export function calcularMediaPorAluno(saldoTotal: number, quantidadeAlunos: number): number {
  if (quantidadeAlunos <= 0) return 0;
  return saldoTotal / quantidadeAlunos;
}

export interface TurmaRankingEntrada {
  turmaId: string;
  nome: string;
  saldoAtual: number;
  saldoAcumulado: number;
  quantidadeAlunos: number;
}

/**
 * Ordena o ranking de Salas pelo modo escolhido (total ou media por aluno),
 * sempre pelo saldo ATUAL (o acumulado e exibido lado a lado, nao usado p/ ordenar).
 */
export function ordenarRankingTurmas(
  entradas: TurmaRankingEntrada[],
  modo: "total" | "media"
): (TurmaRankingEntrada & { valorOrdenacao: number })[] {
  return entradas
    .map((e) => ({
      ...e,
      valorOrdenacao:
        modo === "total" ? e.saldoAtual : calcularMediaPorAluno(e.saldoAtual, e.quantidadeAlunos),
    }))
    .sort((a, b) => b.valorOrdenacao - a.valorOrdenacao);
}

/**
 * RN-13 — Professor fora dos rankings.
 * Filtro puro usado antes de montar qualquer ranking: garante que
 * transacoes/saldos com destinoTipo = 'professor' nunca entrem no calculo.
 */
export function excluirProfessoresDoRanking<T extends { destinoTipo: string }>(itens: T[]): T[] {
  return itens.filter((i) => i.destinoTipo !== "professor");
}

/**
 * Verifica se um item do catalogo pode ser resgatado no escopo pedido
 * (aluno so ve/usa individual+ambos; turma so ve/usa turma+ambos).
 */
export function itemPermiteEscopo(
  escopoItem: "turma" | "individual" | "ambos",
  escopoDesejado: "turma" | "individual"
): boolean {
  return escopoItem === "ambos" || escopoItem === escopoDesejado;
}
