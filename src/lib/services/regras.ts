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
 * RN-01 (SUBSTITUIDA — ver INVESTIMENTOS.md) — Antes, um credito a um aluno
 * propagava automaticamente para turma e Casa. Isso NAO existe mais: creditar
 * um aluno so mexe no saldo pessoal dele (RN-15..RN-21). Turma/Casa só
 * crescem quando o próprio aluno decide investir ali (irreversível, ver
 * calcularDeltaInvestimentoColetivo abaixo). Mantido o mesmo nome de função
 * para minimizar o diff nos call sites, mas o retorno agora tem só o aluno.
 */
export interface DeltaCredito {
  aluno: { saldoAtual: number; saldoAcumulado: number };
}

export function calcularPropagacaoCredito(valor: number): DeltaCredito {
  return {
    aluno: { saldoAtual: valor, saldoAcumulado: valor },
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

// ---------------------------------------------------------------------
// Investimentos (INVESTIMENTOS.md, RN-15..RN-21)
// ---------------------------------------------------------------------

export type TipoInvestimento =
  | "casa"
  | "turma"
  | "cdb"
  | "poupanca"
  | "fundo_imobiliario"
  | "tesouro_direto"
  | "dizimo"
  | "lar_idoso";

/** Casa/turma: irreversivel E credita um placar coletivo do proprio colegio (RN-16). */
const TIPOS_COLETIVOS_IRREVERSIVEIS: readonly TipoInvestimento[] = ["casa", "turma"];

/**
 * Dizimo/Lar do Idoso: tambem irreversivel, mas e uma DOACAO - o valor sai
 * do saldo do aluno e nao credita nenhum placar/pool dentro do sistema (nao
 * existe "Casa" ou "turma" representando a igreja ou o lar do idoso). So
 * gera o debito do aluno, nada mais - ver investmentService.ts::investirDoacao.
 */
const TIPOS_DOACAO_IRREVERSIVEIS: readonly TipoInvestimento[] = ["dizimo", "lar_idoso"];

/** Investimento em Casa/turma e irreversivel (nao gera Investimento resgatavel). */
export function ehInvestimentoColetivo(tipo: TipoInvestimento): boolean {
  return TIPOS_COLETIVOS_IRREVERSIVEIS.includes(tipo);
}

/** Doacao (Dizimo/Lar do Idoso): irreversivel, sem placar coletivo pra creditar. */
export function ehDoacao(tipo: TipoInvestimento): boolean {
  return TIPOS_DOACAO_IRREVERSIVEIS.includes(tipo);
}

/** RN-16 — Casa/turma/doacao sao irreversiveis (nao geram Investimento resgatavel). */
export function ehInvestimentoIrreversivel(tipo: TipoInvestimento): boolean {
  return ehInvestimentoColetivo(tipo) || ehDoacao(tipo);
}

/** RN-17 — os demais tipos (CDB/poupanca/FII/tesouro) sao reversiveis a qualquer momento. */
export function ehInvestimentoReversivel(tipo: TipoInvestimento): boolean {
  return !ehInvestimentoIrreversivel(tipo);
}

/** RN-17/RN-20 — so pode resgatar um investimento de tipo reversivel que ainda esteja ativo. */
export function validarPodeResgatar(
  tipo: TipoInvestimento,
  status: "ativo" | "resgatado"
): ValidacaoResultado {
  if (ehInvestimentoIrreversivel(tipo)) {
    return { valido: false, erro: "Este tipo de investimento é irreversível e não pode ser resgatado." };
  }
  if (status === "resgatado") {
    return { valido: false, erro: "Este investimento já foi resgatado." };
  }
  return { valido: true };
}

/**
 * RN-18 — juros compostos diarios sobre o principal, a partir da taxa MENSAL
 * media do tipo (congelada no momento do investimento - taxasInvestimento.ts).
 * A taxa e ao mes; convertemos para diaria assumindo mes de 30 dias, entao
 * 30 dias decorridos rendem exatamente `principal * (1 + taxaMensal)`.
 * Arredonda so no final: BosqueCoins sao inteiros, e acumular arredondamento
 * dia a dia distorceria o resultado em prazos longos.
 */
export function calcularValorComJuros(principal: number, taxaMensal: number, diasDecorridos: number): number {
  const taxaDiaria = Math.pow(1 + taxaMensal, 1 / 30) - 1;
  const valor = principal * Math.pow(1 + taxaDiaria, diasDecorridos);
  return Math.round(valor);
}

/** RN-16 — delta a aplicar no periodo (turma ou Casa) do ano vigente ao investir de forma coletiva. */
export function calcularDeltaInvestimentoColetivo(valor: number): { saldoAtual: number; saldoAcumulado: number } {
  return { saldoAtual: valor, saldoAcumulado: valor };
}

// --- Presentear (PRESENTES.md, RN-23..RN-27) ---

/** RN-24 — o valor de um presente e fixo; nao ha campo livre nem escolha de opcoes. */
export const VALOR_PRESENTE = 10;

/** RN-27 — teto de BosqueCoins que um aluno pode ENVIAR em presentes dentro da janela movel. */
export const LIMITE_SEMANAL_PRESENTES = 10;

/** RN-27 — tamanho da janela movel (dias corridos a partir de "agora", nao semana de calendario). */
export const JANELA_PRESENTE_DIAS = 7;

/** Limite de tamanho do recado opcional que acompanha o presente. */
export const MAX_MENSAGEM_PRESENTE = 60;

/**
 * RN-27 — dado o total ja enviado em presentes nos ultimos JANELA_PRESENTE_DIAS
 * dias, decide se cabe mais um presente de `valorNovo`. Soma valores (nao conta
 * presentes) de proposito: continua correto se um valor diferente de
 * VALOR_PRESENTE for reintroduzido no futuro. Com o valor fixo atual (10 = teto)
 * isso equivale, na pratica, a no maximo um presente enviado por semana.
 */
export function validarLimiteSemanalPresentes(totalEnviadoNaJanela: number, valorNovo: number): ValidacaoResultado {
  if (totalEnviadoNaJanela + valorNovo > LIMITE_SEMANAL_PRESENTES) {
    return { valido: false, erro: "Voce ja usou seu presente da semana. Aguarde a janela de 7 dias reabrir." };
  }
  return { valido: true };
}
