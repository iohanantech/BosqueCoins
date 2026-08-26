import { type Page, expect } from "@playwright/test";

/**
 * Loga usando o provider de desenvolvimento (ver README.md 2.2.1) - so
 * funciona com DEV_AUTH_ENABLED=true (setado no webServer do playwright.config.ts).
 */
export async function loginComo(page: Page, email: string) {
  await page.goto("/login");
  await expect(page.getByText("Login de desenvolvimento")).toBeVisible({ timeout: 20000 });
  await page.getByRole("combobox").selectOption(email);
  await expect(page).toHaveURL(/\/dashboard/, { timeout: 15000 });
}

export const USUARIOS = {
  admin: "admin@bosquemananciais.org.br",
  professor: "prof.ana@bosquemananciais.org.br",
  pec: "prof.bruno.pec@bosquemananciais.org.br",
  aluno: "aluno1@bosquemananciais.org.br",
} as const;
