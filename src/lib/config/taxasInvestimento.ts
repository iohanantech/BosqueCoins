/**
 * Taxas MENSAIS usadas na SIMULACAO EDUCACIONAL de investimentos
 * (INVESTIMENTOS.md, RN-18). Sao aproximacoes ficticias e simplificadas para
 * fins pedagogicos - NAO sao dados de mercado reais, nem recomendacao de
 * investimento. Isso tambem precisa ficar claro na UI (/investir).
 *
 * Sao ao MES (nao ao ano): num uso de escola, que dura semanas, uma taxa
 * anual composta diaria mal move o inteiro do saldo (BosqueCoins nao tem
 * fracao) - ao mes o rendimento aparece em poucos dias, que e o ponto
 * pedagogico. `calcularValorComJuros` converte de mensal para diaria.
 *
 * A taxa aplicada a um investimento e "congelada" no momento em que ele e
 * criado (ver investmentService.ts) - mudar os valores aqui NAO afeta
 * investimentos ja existentes, so os criados depois da mudanca.
 */
export type TipoInvestimentoReversivel = "cdb" | "poupanca" | "fundo_imobiliario" | "tesouro_direto";

export const TAXAS_MENSAIS: Record<TipoInvestimentoReversivel, number> = {
  poupanca: 0.06, // 6% a.m. - a mais baixa das quatro
  tesouro_direto: 0.105, // 10.5% a.m.
  cdb: 0.11, // 11% a.m. - a mais alta
  fundo_imobiliario: 0.09, // 9% a.m.
};

export const NOMES_INVESTIMENTO: Record<TipoInvestimentoReversivel, string> = {
  cdb: "CDB",
  poupanca: "Poupança",
  fundo_imobiliario: "Fundo Imobiliário",
  tesouro_direto: "Tesouro Direto",
};
