-- Renomeia a coluna preservando os dados: a taxa passa a ser interpretada
-- como AO MES (antes era ao ano). Ver src/lib/config/taxasInvestimento.ts e
-- regras.ts::calcularValorComJuros (agora converte de mensal para diaria).
ALTER TABLE "investimentos" RENAME COLUMN "taxa_anual" TO "taxa_mensal";
