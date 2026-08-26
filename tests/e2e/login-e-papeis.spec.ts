import { test, expect } from "@playwright/test";
import { loginComo, USUARIOS } from "./helpers";

test.describe("Login e navegação por papel", () => {
  test("admin: ve bottom nav com Admin e dashboard carrega rankings", async ({ page }) => {
    await loginComo(page, USUARIOS.admin);
    await expect(page.getByRole("link", { name: "Admin" })).toBeVisible();
    await expect(page.getByText("Ranking das Salas")).toBeVisible();
    await expect(page.getByText("Copa das Casas")).toBeVisible();
  });

  test("professor: ve atalho de Pontuar, nao ve Admin", async ({ page }) => {
    await loginComo(page, USUARIOS.professor);
    await expect(page.getByRole("link", { name: "Pontuar" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Admin" })).toHaveCount(0);
    await expect(page.getByText("Dar BosqueCoins")).toBeVisible();
  });

  test("PEC (professor com turma atribuida): ve o painel PEC com a turma listada", async ({ page }) => {
    await loginComo(page, USUARIOS.pec);
    await page.getByRole("link", { name: "PEC" }).click();
    await expect(page.getByText("Painel do PEC")).toBeVisible();
    await expect(page.getByText("Turma 1A")).toBeVisible();
  });

  test("aluno: ve saldo pessoal, nao ve Pontuar nem Admin", async ({ page }) => {
    await loginComo(page, USUARIOS.aluno);
    await expect(page.getByText("Seu saldo (vitalício)")).toBeVisible();
    await expect(page.getByRole("link", { name: "Pontuar" })).toHaveCount(0);
    await expect(page.getByRole("link", { name: "Admin" })).toHaveCount(0);
  });
});
