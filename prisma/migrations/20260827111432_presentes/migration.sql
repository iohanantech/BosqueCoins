-- CreateTable
CREATE TABLE "presentes" (
    "id" TEXT NOT NULL,
    "remetente_id" TEXT NOT NULL,
    "destinatario_id" TEXT NOT NULL,
    "valor" INTEGER NOT NULL,
    "mensagem" TEXT,
    "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "presentes_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "presentes_remetente_id_idx" ON "presentes"("remetente_id");

-- CreateIndex
CREATE INDEX "presentes_destinatario_id_idx" ON "presentes"("destinatario_id");

-- AddForeignKey
ALTER TABLE "presentes" ADD CONSTRAINT "presentes_remetente_id_fkey" FOREIGN KEY ("remetente_id") REFERENCES "usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "presentes" ADD CONSTRAINT "presentes_destinatario_id_fkey" FOREIGN KEY ("destinatario_id") REFERENCES "usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
