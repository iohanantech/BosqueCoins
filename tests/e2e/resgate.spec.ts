import { test, expect } from "@playwright/test";
import { loginComo, USUARIOS } from "./helpers";

// O icone da moeda (CoinIcon) e um SVG com um "B" como texto, entao o
// textContent do saldo vem como "B123" - extrai so os digitos.
function saldoNumerico(texto: string | null) {
  return Number(texto?.match(/\d+/)?.[0] ?? NaN);
}

test("fluxo completo de resgate individual: aluno solicita -> PEC aprova -> saldo do aluno cai", async ({
  browser,
}) => {
  // Aluno recebe uma base de pontos primeiro (via professor), para ter saldo a resgatar.
  const ctxProfessor = await browser.newContext();
  const paginaProfessor = await ctxProfessor.newPage();
  await loginComo(paginaProfessor, USUARIOS.pec); // Bruno e PEC da Turma 1A e 2B
  await paginaProfessor.getByRole("link", { name: "Pontuar" }).click();
  await paginaProfessor.getByRole("button", { name: "Turma 1A" }).click();
  await paginaProfessor.getByRole("checkbox").first().check();
  await paginaProfessor.getByPlaceholder("Ex.: 5").fill("50");
  await paginaProfessor.getByPlaceholder("Ex.: Participação na aula de Matemática").fill("Base para teste de resgate");
  await paginaProfessor.getByRole("button", { name: /Confirmar para 1 aluno/ }).click();
  await expect(paginaProfessor.getByText(/BosqueCoins dados para 1 aluno/)).toBeVisible();
  await ctxProfessor.close();

  // Aluno1 (matriculado na Turma 1A) solicita o resgate individual.
  const ctxAluno = await browser.newContext();
  const paginaAluno = await ctxAluno.newPage();
  await loginComo(paginaAluno, USUARIOS.aluno);
  const saldoAntes = await paginaAluno.getByTestId("saldo-pessoal-atual").textContent();

  await paginaAluno.getByRole("link", { name: "Prêmios" }).click();
  const primeiroItem = paginaAluno.getByRole("button", { name: "Resgatar" }).first();
  await primeiroItem.click();
  await expect(paginaAluno.getByText("Resgate solicitado! Aguarde a aprovação.")).toBeVisible();
  await ctxAluno.close();

  // PEC aprova o resgate.
  const ctxPec = await browser.newContext();
  const paginaPec = await ctxPec.newPage();
  await loginComo(paginaPec, USUARIOS.pec);
  await paginaPec.getByRole("link", { name: "PEC" }).click();
  await expect(paginaPec.getByText("Resgates pendentes")).toBeVisible();
  await paginaPec.getByRole("button", { name: "Aprovar" }).first().click();
  await expect(paginaPec.getByText("Nenhum resgate pendente.")).toBeVisible();
  await ctxPec.close();

  // Saldo do aluno caiu.
  const ctxVerifica = await browser.newContext();
  const paginaVerifica = await ctxVerifica.newPage();
  await loginComo(paginaVerifica, USUARIOS.aluno);
  const saldoDepois = await paginaVerifica.getByTestId("saldo-pessoal-atual").textContent();
  expect(saldoNumerico(saldoDepois)).toBeLessThan(saldoNumerico(saldoAntes));
  await ctxVerifica.close();
});
