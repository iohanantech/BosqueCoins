import { defineConfig, devices } from "@playwright/test";

/**
 * E2E (secao 13, marcada como opcional na especificacao - implementada mesmo
 * assim, ver CONTINUACAO.md Fase 4). Usa o provider de login de
 * desenvolvimento (ver src/lib/auth/options.ts, README.md 2.2.1) - por isso
 * webServer roda com DEV_AUTH_ENABLED=true, nunca em producao.
 *
 * Um unico projeto (desktop) roda os fluxos funcionais; os 3 breakpoints da
 * secao 9 (375/768/1280) sao cobertos dentro de tests/e2e/responsive.spec.ts
 * via page.setViewportSize(), para nao triplicar o tempo de toda a suite.
 */
export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: false,
  workers: 1,
  retries: 1,
  reporter: [["list"]],
  timeout: 45000,
  expect: { timeout: 15000 },
  use: {
    ...devices["Desktop Chrome"],
    baseURL: "http://localhost:3100",
    trace: "retain-on-failure",
  },
  globalSetup: "./tests/e2e/global-setup.ts",
  webServer: {
    // TEM que ser `next dev`, nao build de producao: o provider de login de
    // dev (DEV_AUTH_ENABLED) e desligado a força quando NODE_ENV=production
    // (ver src/lib/auth/options.ts) - e assim que deve ser, nao contornar.
    // A flakiness de compilacao sob demanda e mitigada pelo globalSetup
    // (esquenta as rotas principais antes dos testes) + timeouts generosos.
    command: "npm run dev -- -p 3100",
    url: "http://localhost:3100",
    reuseExistingServer: !process.env.CI,
    timeout: 60000,
    env: {
      DEV_AUTH_ENABLED: "true",
      NEXTAUTH_URL: "http://localhost:3100",
      // Banco dedicado a E2E (bosquecoins_e2e) - NUNCA o de dev. Ver
      // tests/e2e/README.md para como recria-lo (migrate deploy + seed).
      DATABASE_URL: "postgresql://postgres:postgres@127.0.0.1:5432/bosquecoins_e2e?schema=public",
      DIRECT_URL: "postgresql://postgres:postgres@127.0.0.1:5432/bosquecoins_e2e?schema=public",
    },
  },
});
