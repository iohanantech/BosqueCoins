/**
 * Esquenta as rotas mais visitadas ANTES da suite comecar, para o `next dev`
 * ja ter compilado tudo (compilacao sob demanda do dev server e a principal
 * fonte de flakiness de timeout nos primeiros testes - ver playwright.config.ts).
 */
export default async function globalSetup() {
  const baseURL = "http://localhost:3100";
  const rotas = ["/login", "/dashboard", "/pontuar", "/extrato", "/premios", "/pec", "/perfil", "/investir", "/admin", "/admin/importar", "/admin/ano-letivo"];

  for (const rota of rotas) {
    try {
      await fetch(`${baseURL}${rota}`, { redirect: "manual" });
    } catch {
      // Ignora - o proprio Playwright ja espera o server subir via `url` do webServer;
      // isso e so um aquecimento best-effort.
    }
  }
}
