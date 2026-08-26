-- CreateEnum
CREATE TYPE "TipoInvestimento" AS ENUM ('casa', 'turma', 'cdb', 'poupanca', 'fundo_imobiliario', 'tesouro_direto');

-- CreateEnum
CREATE TYPE "StatusInvestimento" AS ENUM ('ativo', 'resgatado');

-- AlterEnum
ALTER TYPE "DestinoTipo" ADD VALUE 'casa';

-- CreateTable
CREATE TABLE "investimentos" (
    "id" TEXT NOT NULL,
    "aluno_id" TEXT NOT NULL,
    "tipo" "TipoInvestimento" NOT NULL,
    "ano_letivo_id" TEXT,
    "destino_turma_id" TEXT,
    "destino_casa_id" TEXT,
    "valor_principal" INTEGER NOT NULL,
    "taxa_anual" DOUBLE PRECISION NOT NULL,
    "status" "StatusInvestimento" NOT NULL DEFAULT 'ativo',
    "data_investimento" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "data_resgate" TIMESTAMP(3),
    "valor_resgatado" INTEGER,

    CONSTRAINT "investimentos_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "investimentos_aluno_id_status_idx" ON "investimentos"("aluno_id", "status");

-- AddForeignKey
ALTER TABLE "investimentos" ADD CONSTRAINT "investimentos_aluno_id_fkey" FOREIGN KEY ("aluno_id") REFERENCES "usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "investimentos" ADD CONSTRAINT "investimentos_ano_letivo_id_fkey" FOREIGN KEY ("ano_letivo_id") REFERENCES "anos_letivos"("id") ON DELETE SET NULL ON UPDATE CASCADE;
