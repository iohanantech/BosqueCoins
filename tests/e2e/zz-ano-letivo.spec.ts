import { test, expect } from "@playwright/test";
import { loginComo, USUARIOS } from "./helpers";

test("fluxo de encerramento do ano letivo: dashboard mostra o ano novo zerado, ano anterior consultável", async ({
  page,
}) => {
  await loginComo(page, USUARIOS.admin);

  // Guarda o total da Turma 1A do ano vigente antes de encerrar.
  await expect(page.getByText("Turma 1A")).toBeVisible();

  await page.goto("/admin/ano-letivo");
  await page.getByPlaceholder("Nome do próximo ano (ex.: 2027)").fill("2099-e2e");
  await page.locator('input[type="date"]').nth(0).fill("2099-02-01");
  await page.locator('input[type="date"]').nth(1).fill("2099-12-19");

  await page.getByRole("button", { name: "Encerrar ano letivo" }).click();
  await page.getByRole("button", { name: "Sim, encerrar" }).click();
  await expect(page.getByText(/Ano 2099-e2e aberto/)).toBeVisible();

  // Dashboard: seletor de ano aparece com o ano novo selecionado, zerado.
  await page.getByRole("link", { name: "Início" }).click();
  await expect(page.getByRole("button", { name: /2099-e2e/ })).toBeVisible();
  await expect(page.getByRole("button", { name: /^2026/ })).toBeVisible();

  // Ano anterior continua consultavel com os valores intactos.
  await page.getByRole("button", { name: /^2026/ }).click();
  await expect(page.getByText("Turma 1A")).toBeVisible();
});
