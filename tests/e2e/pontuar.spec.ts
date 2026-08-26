import { test, expect } from "@playwright/test";
import { loginComo, USUARIOS } from "./helpers";

test("fluxo completo de Pontuar: turma -> 3 alunos -> valor -> extrato agrupado", async ({ page }) => {
  await loginComo(page, USUARIOS.professor);
  await page.getByRole("link", { name: "Pontuar" }).click();

  await page.getByRole("button", { name: "Turma 2B" }).click();

  const checkboxes = page.getByRole("checkbox");
  await checkboxes.nth(0).check();
  await checkboxes.nth(1).check();
  await checkboxes.nth(2).check();
  await expect(page.getByText("3 selecionado(s)")).toBeVisible();

  await page.getByPlaceholder("Ex.: 5").fill("6");
  await page.getByPlaceholder("Ex.: Participação na aula de Matemática").fill("Teste E2E de pontuacao");
  await page.getByRole("button", { name: "Confirmar para 3 aluno(s)" }).click();

  await expect(page.getByText("6 BosqueCoins dados para 3 aluno(s)!")).toBeVisible();

  // Extrato do professor: 1 lote agrupado, expansivel.
  await page.getByRole("link", { name: "Extrato" }).click();
  const lote = page.getByText("6 BosqueCoins para 3 alunos").first();
  await expect(lote).toBeVisible();
  await lote.click();
  await expect(page.getByText("Teste E2E de pontuacao")).toBeVisible();
});
