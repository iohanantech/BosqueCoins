import { test, expect } from "@playwright/test";
import { loginComo, USUARIOS } from "./helpers";

/**
 * Os 3 breakpoints da secao 9 (375/768/1280), aplicados dentro do teste via
 * setViewportSize (ver playwright.config.ts - evita triplicar toda a suite).
 */
const BREAKPOINTS = [
  { nome: "mobile-375", width: 375, height: 812 },
  { nome: "tablet-768", width: 768, height: 1024 },
  { nome: "desktop-1280", width: 1280, height: 800 },
];

for (const bp of BREAKPOINTS) {
  test(`dashboard e bottom nav renderizam em ${bp.nome}`, async ({ page }) => {
    await page.setViewportSize({ width: bp.width, height: bp.height });
    await loginComo(page, USUARIOS.admin);

    await expect(page.getByRole("link", { name: "Início" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Admin" })).toBeVisible();
    await expect(page.getByText("Ranking das Salas")).toBeVisible();

    // Sem overflow horizontal (regra geral da secao 9).
    const overflowX = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth);
    expect(overflowX).toBe(false);
  });
}

test("AvisoDesktop aparece so abaixo do breakpoint sm (640px) na tela de importar", async ({ page }) => {
  await loginComo(page, USUARIOS.admin);

  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto("/admin/importar");
  await expect(page.getByText(/funciona melhor em um computador/)).toBeVisible();

  await page.setViewportSize({ width: 1280, height: 800 });
  await page.reload();
  await expect(page.getByText(/funciona melhor em um computador/)).toBeHidden();
});
