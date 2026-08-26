import { test, expect, type Browser, type Page } from "@playwright/test";
import { loginComo, USUARIOS } from "./helpers";

// O icone da moeda (CoinIcon) e um SVG com "B" como texto, entao o
// textContent do saldo vem como "B123" - extrai so os digitos.
function saldoNumerico(texto: string | null) {
  return Number(texto?.match(/\d+/)?.[0] ?? NaN);
}

async function lerSaldo(page: Page) {
  return saldoNumerico(await page.getByTestId("saldo-investir").textContent());
}

/**
 * Da uma base de pontos ao aluno1 via o PEC (independente da ordem em que
 * os specs rodam - nao assume que outro teste ja creditou o aluno antes).
 */
async function darBaseAoAluno1(browser: Browser, valor: number) {
  const ctx = await browser.newContext();
  const pagina = await ctx.newPage();
  await loginComo(pagina, USUARIOS.pec); // Bruno e PEC da Turma 1A
  await pagina.getByRole("link", { name: "Pontuar" }).click();
  await pagina.getByRole("button", { name: "Turma 1A" }).click();
  await pagina.getByRole("checkbox").first().check();
  await pagina.getByPlaceholder("Ex.: 5").fill(String(valor));
  await pagina.getByPlaceholder("Ex.: Participação na aula de Matemática").fill("Base para teste de investimento");
  await pagina.getByRole("button", { name: /Confirmar para 1 aluno/ }).click();
  await expect(pagina.getByText(/BosqueCoins dados para 1 aluno/)).toBeVisible();
  await ctx.close();
}

test.describe("Investir (INVESTIMENTOS.md)", () => {
  test("aluno investe em CDB e depois resgata, saldo volta ao valor original", async ({ page, browser }) => {
    await darBaseAoAluno1(browser, 10);

    await loginComo(page, USUARIOS.aluno);
    await page.getByRole("link", { name: "Investir" }).click();
    await page.waitForLoadState("networkidle");

    const saldoInicial = await lerSaldo(page);

    await page.getByTestId("opcao-investir-cdb").click();
    await page.getByPlaceholder("Ex.: 20").fill("2");
    await page.getByRole("button", { name: "Investir", exact: true }).click();

    await expect(page.getByText(/BosqueCoins investidos em CDB/)).toBeVisible();
    await expect(page.getByText("Seus investimentos ativos")).toBeVisible();
    // O saldo atualiza via um segundo fetch assincrono (carregarTudo) depois
    // do POST - espera estabilizar no valor esperado em vez de ler na hora.
    await expect.poll(() => lerSaldo(page)).toBe(saldoInicial - 2);

    await page.getByRole("button", { name: "Resgatar", exact: true }).click();
    await expect(page.getByText(/Resgatado:/)).toBeVisible();
    await expect(page.getByText("Histórico de resgates")).toBeVisible();

    await expect.poll(() => lerSaldo(page)).toBe(saldoInicial);
  });

  test("aluno investe em Casa (irreversível) com confirmação, e o placar da Casa sobe", async ({ page, browser }) => {
    await darBaseAoAluno1(browser, 10);

    await loginComo(page, USUARIOS.aluno);
    await page.getByRole("link", { name: "Investir" }).click();
    await page.waitForLoadState("networkidle");

    const saldoInicial = await lerSaldo(page);

    await page.getByTestId("opcao-investir-casa").click();
    await page.getByPlaceholder("Ex.: 20").fill("1");
    await page.getByRole("button", { name: "Investir (irreversível)" }).click();
    await expect(page.getByText(/não volta pro seu saldo/)).toBeVisible();
    await page.getByRole("button", { name: "Sim, investir" }).click();

    await expect(page.getByText(/BosqueCoins investidos em Casa/)).toBeVisible();
    await expect.poll(() => lerSaldo(page)).toBe(saldoInicial - 1);

    // Nao gera um investimento resgatavel - "Seus investimentos ativos" nao aparece por causa disso.
    await expect(page.getByText("Seus investimentos ativos")).toHaveCount(0);

    // Placar da Casa do aluno sobe no dashboard.
    await page.getByRole("link", { name: "Início" }).click();
    await expect(page.getByText(/já investidos na Casa\/turma/)).toBeVisible();
  });
});
