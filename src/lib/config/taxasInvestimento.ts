/**
 * Taxas anuais medias usadas na SIMULACAO EDUCACIONAL de investimentos
 * (INVESTIMENTOS.md, RN-18). Sao aproximacoes ficticias e simplificadas para
 * fins pedagogicos - NAO sao dados de mercado reais, nem recomendacao de
 * investimento. Isso tambem precisa ficar claro na UI (/investir).
 *
 * A taxa aplicada a um investimento e "congelada" no momento em que ele e
 * criado (ver investmentService.ts) - mudar os valores aqui NAO afeta
 * investimentos ja existentes, so os criados depois da mudanca.
 */
export type TipoInvestimentoReversivel = "cdb" | "poupanca" | "fundo_imobiliario" | "tesouro_direto";

export const TAXAS_ANUAIS: Record<TipoInvestimentoReversivel, number> = {
  poupanca: 0.06, // ~6% a.a. - aproximacao didatica da poupanca
  tesouro_direto: 0.105, // ~10.5% a.a. - aproximacao didatica da Selic/Tesouro
  cdb: 0.11, // ~11% a.a. - aproximacao didatica de um CDB proximo do CDI
  fundo_imobiliario: 0.09, // ~9% a.a. - aproximacao didatica de dividend yield + variacao de FIIs
};

export const NOMES_INVESTIMENTO: Record<TipoInvestimentoReversivel, string> = {
  cdb: "CDB",
  poupanca: "Poupança",
  fundo_imobiliario: "Fundo Imobiliário",
  tesouro_direto: "Tesouro Direto",
};
