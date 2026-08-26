import { test, expect } from "@playwright/test";
import * as XLSX from "xlsx";
import { loginComo, USUARIOS } from "./helpers";

test("fluxo completo de importação: upload -> pré-visualização por linha -> confirmar -> resumo", async ({
  page,
}) => {
  await loginComo(page, USUARIOS.admin);
  await page.getByRole("link", { name: "Admin" }).click();
  await page.goto("/admin/importar");

  const linhas = [
    { nome: "E2E Novo Aluno", email: "e2enovo@bosquemananciais.org.br", turma: "Turma 1A", casa: "Camapuã" },
    { nome: "E2E Turma Fantasma", email: "e2efantasma@bosquemananciais.org.br", turma: "Turma Fantasma E2E", casa: "Camapuã" },
    { nome: "E2E Dominio Errado", email: "e2eerrado@outraescola.com", turma: "Turma 1A", casa: "Camapuã" },
  ];
  const planilha = XLSX.utils.book_new();
  const aba = XLSX.utils.json_to_sheet(linhas);
  XLSX.utils.book_append_sheet(planilha, aba, "Alunos");
  const buffer = XLSX.write(planilha, { type: "buffer", bookType: "xlsx" }) as Buffer;

  await page.setInputFiles('input[type="file"]', {
    name: "importacao-e2e.xlsx",
    mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    buffer,
  });

  // Pre-visualizacao mostra status por linha.
  await expect(page.getByText("OK")).toBeVisible();
  await expect(page.getByText("Turma não existe")).toBeVisible();
  await expect(page.getByText("Domínio inválido")).toBeVisible();

  // Turma inexistente: cria automaticamente (opcao padrao).
  await page.getByRole("button", { name: "Criar automaticamente" }).click();

  await page.getByRole("button", { name: "Confirmar importação" }).click();

  await expect(page.getByText("Importação concluída")).toBeVisible();
  // 1 criado (E2E Novo Aluno) + 1 criado via turma-fantasma-criada = 2; o de dominio errado falha.
  await expect(page.getByText(/✅ 2 criados/)).toBeVisible();
  await expect(page.getByText(/❌ 1 falharam/)).toBeVisible();
});
