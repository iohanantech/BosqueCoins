-- CreateEnum
CREATE TYPE "Papel" AS ENUM ('admin', 'professor', 'aluno');

-- CreateEnum
CREATE TYPE "TipoTransacao" AS ENUM ('credito', 'debito', 'ajuste');

-- CreateEnum
CREATE TYPE "DestinoTipo" AS ENUM ('aluno', 'turma', 'professor');

-- CreateEnum
CREATE TYPE "EscopoItem" AS ENUM ('turma', 'individual', 'ambos');

-- CreateEnum
CREATE TYPE "EscopoResgate" AS ENUM ('turma', 'individual');

-- CreateEnum
CREATE TYPE "StatusResgate" AS ENUM ('pendente', 'aprovado', 'recusado');

-- CreateTable
CREATE TABLE "anos_letivos" (
    "id" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "data_inicio" TIMESTAMP(3) NOT NULL,
    "data_fim" TIMESTAMP(3) NOT NULL,
    "ativo" BOOLEAN NOT NULL DEFAULT false,
    "encerrado" BOOLEAN NOT NULL DEFAULT false,
    "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "anos_letivos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "usuarios" (
    "id" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "google_id" TEXT,
    "papel" "Papel" NOT NULL,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "casa_id" TEXT,
    "saldo_atual" INTEGER NOT NULL DEFAULT 0,
    "saldo_acumulado" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "usuarios_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "casas" (
    "id" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "cor_primaria_hex" TEXT NOT NULL,
    "cor_secundaria_hex" TEXT NOT NULL,
    "ativo" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "casas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "turmas" (
    "id" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "serie" TEXT NOT NULL,
    "ativo" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "turmas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "matriculas" (
    "id" TEXT NOT NULL,
    "aluno_id" TEXT NOT NULL,
    "turma_id" TEXT NOT NULL,
    "ano_letivo_id" TEXT NOT NULL,

    CONSTRAINT "matriculas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "professor_pec_turmas" (
    "id" TEXT NOT NULL,
    "professor_id" TEXT NOT NULL,
    "turma_id" TEXT NOT NULL,
    "ano_letivo_id" TEXT NOT NULL,

    CONSTRAINT "professor_pec_turmas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "turma_periodos" (
    "id" TEXT NOT NULL,
    "turma_id" TEXT NOT NULL,
    "ano_letivo_id" TEXT NOT NULL,
    "saldo_atual" INTEGER NOT NULL DEFAULT 0,
    "saldo_acumulado" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "turma_periodos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "casa_periodos" (
    "id" TEXT NOT NULL,
    "casa_id" TEXT NOT NULL,
    "ano_letivo_id" TEXT NOT NULL,
    "saldo_atual" INTEGER NOT NULL DEFAULT 0,
    "saldo_acumulado" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "casa_periodos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "transacoes" (
    "id" TEXT NOT NULL,
    "ano_letivo_id" TEXT NOT NULL,
    "tipo" "TipoTransacao" NOT NULL,
    "valor" INTEGER NOT NULL,
    "motivo" TEXT NOT NULL,
    "origem_usuario_id" TEXT NOT NULL,
    "destino_tipo" "DestinoTipo" NOT NULL,
    "destino_id" TEXT NOT NULL,
    "lote_id" TEXT,
    "transacao_estornada_id" TEXT,
    "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "transacoes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "itens_catalogo" (
    "id" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "descricao" TEXT NOT NULL,
    "custo" INTEGER NOT NULL,
    "imagem_url" TEXT,
    "icone" TEXT,
    "categoria" TEXT NOT NULL,
    "escopo" "EscopoItem" NOT NULL,
    "quantidade_disponivel" INTEGER,
    "ativo" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "itens_catalogo_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "resgates" (
    "id" TEXT NOT NULL,
    "ano_letivo_id" TEXT NOT NULL,
    "item_id" TEXT NOT NULL,
    "escopo_usado" "EscopoResgate" NOT NULL,
    "turma_id" TEXT,
    "aluno_id" TEXT,
    "solicitante_id" TEXT NOT NULL,
    "valor_debitado" INTEGER NOT NULL,
    "status" "StatusResgate" NOT NULL DEFAULT 'pendente',
    "aprovador_id" TEXT,
    "motivo_recusa" TEXT,
    "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolvido_em" TIMESTAMP(3),

    CONSTRAINT "resgates_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "anos_letivos_nome_key" ON "anos_letivos"("nome");

-- CreateIndex
CREATE UNIQUE INDEX "usuarios_email_key" ON "usuarios"("email");

-- CreateIndex
CREATE UNIQUE INDEX "usuarios_google_id_key" ON "usuarios"("google_id");

-- CreateIndex
CREATE UNIQUE INDEX "casas_nome_key" ON "casas"("nome");

-- CreateIndex
CREATE UNIQUE INDEX "turmas_nome_key" ON "turmas"("nome");

-- CreateIndex
CREATE INDEX "matriculas_turma_id_ano_letivo_id_idx" ON "matriculas"("turma_id", "ano_letivo_id");

-- CreateIndex
CREATE UNIQUE INDEX "matriculas_aluno_id_ano_letivo_id_key" ON "matriculas"("aluno_id", "ano_letivo_id");

-- CreateIndex
CREATE INDEX "professor_pec_turmas_turma_id_ano_letivo_id_idx" ON "professor_pec_turmas"("turma_id", "ano_letivo_id");

-- CreateIndex
CREATE UNIQUE INDEX "professor_pec_turmas_professor_id_turma_id_ano_letivo_id_key" ON "professor_pec_turmas"("professor_id", "turma_id", "ano_letivo_id");

-- CreateIndex
CREATE UNIQUE INDEX "turma_periodos_turma_id_ano_letivo_id_key" ON "turma_periodos"("turma_id", "ano_letivo_id");

-- CreateIndex
CREATE UNIQUE INDEX "casa_periodos_casa_id_ano_letivo_id_key" ON "casa_periodos"("casa_id", "ano_letivo_id");

-- CreateIndex
CREATE UNIQUE INDEX "transacoes_transacao_estornada_id_key" ON "transacoes"("transacao_estornada_id");

-- CreateIndex
CREATE INDEX "transacoes_ano_letivo_id_idx" ON "transacoes"("ano_letivo_id");

-- CreateIndex
CREATE INDEX "transacoes_lote_id_idx" ON "transacoes"("lote_id");

-- CreateIndex
CREATE INDEX "transacoes_destino_tipo_destino_id_idx" ON "transacoes"("destino_tipo", "destino_id");

-- CreateIndex
CREATE INDEX "transacoes_origem_usuario_id_idx" ON "transacoes"("origem_usuario_id");

-- CreateIndex
CREATE INDEX "resgates_ano_letivo_id_idx" ON "resgates"("ano_letivo_id");

-- CreateIndex
CREATE INDEX "resgates_status_idx" ON "resgates"("status");

-- AddForeignKey
ALTER TABLE "usuarios" ADD CONSTRAINT "usuarios_casa_id_fkey" FOREIGN KEY ("casa_id") REFERENCES "casas"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "matriculas" ADD CONSTRAINT "matriculas_aluno_id_fkey" FOREIGN KEY ("aluno_id") REFERENCES "usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "matriculas" ADD CONSTRAINT "matriculas_turma_id_fkey" FOREIGN KEY ("turma_id") REFERENCES "turmas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "matriculas" ADD CONSTRAINT "matriculas_ano_letivo_id_fkey" FOREIGN KEY ("ano_letivo_id") REFERENCES "anos_letivos"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "professor_pec_turmas" ADD CONSTRAINT "professor_pec_turmas_professor_id_fkey" FOREIGN KEY ("professor_id") REFERENCES "usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "professor_pec_turmas" ADD CONSTRAINT "professor_pec_turmas_turma_id_fkey" FOREIGN KEY ("turma_id") REFERENCES "turmas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "professor_pec_turmas" ADD CONSTRAINT "professor_pec_turmas_ano_letivo_id_fkey" FOREIGN KEY ("ano_letivo_id") REFERENCES "anos_letivos"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "turma_periodos" ADD CONSTRAINT "turma_periodos_turma_id_fkey" FOREIGN KEY ("turma_id") REFERENCES "turmas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "turma_periodos" ADD CONSTRAINT "turma_periodos_ano_letivo_id_fkey" FOREIGN KEY ("ano_letivo_id") REFERENCES "anos_letivos"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "casa_periodos" ADD CONSTRAINT "casa_periodos_casa_id_fkey" FOREIGN KEY ("casa_id") REFERENCES "casas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "casa_periodos" ADD CONSTRAINT "casa_periodos_ano_letivo_id_fkey" FOREIGN KEY ("ano_letivo_id") REFERENCES "anos_letivos"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transacoes" ADD CONSTRAINT "transacoes_ano_letivo_id_fkey" FOREIGN KEY ("ano_letivo_id") REFERENCES "anos_letivos"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transacoes" ADD CONSTRAINT "transacoes_origem_usuario_id_fkey" FOREIGN KEY ("origem_usuario_id") REFERENCES "usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transacoes" ADD CONSTRAINT "transacoes_transacao_estornada_id_fkey" FOREIGN KEY ("transacao_estornada_id") REFERENCES "transacoes"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "resgates" ADD CONSTRAINT "resgates_ano_letivo_id_fkey" FOREIGN KEY ("ano_letivo_id") REFERENCES "anos_letivos"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "resgates" ADD CONSTRAINT "resgates_item_id_fkey" FOREIGN KEY ("item_id") REFERENCES "itens_catalogo"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "resgates" ADD CONSTRAINT "resgates_solicitante_id_fkey" FOREIGN KEY ("solicitante_id") REFERENCES "usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "resgates" ADD CONSTRAINT "resgates_aprovador_id_fkey" FOREIGN KEY ("aprovador_id") REFERENCES "usuarios"("id") ON DELETE SET NULL ON UPDATE CASCADE;
