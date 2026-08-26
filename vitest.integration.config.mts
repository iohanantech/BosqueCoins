import { defineConfig } from "vitest/config";
import tsconfigPaths from "vite-tsconfig-paths";

// Config separada da default (vitest.config.mts) de proposito: testes de
// integracao precisam de um Postgres real e rodam sequencialmente (mesmo
// banco, reset entre testes) - ver tests/integration/setup.ts.
export default defineConfig({
  plugins: [tsconfigPaths()],
  test: {
    environment: "node",
    include: ["tests/integration/**/*.test.ts"],
    globals: true,
    setupFiles: ["tests/integration/setup.ts"],
    fileParallelism: false,
    testTimeout: 20000,
    hookTimeout: 20000,
  },
});
