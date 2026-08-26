import fs from "node:fs";
import path from "node:path";
import { beforeEach, afterAll } from "vitest";

/**
 * Carrega .env.test SEM depender do pacote `dotenv` (nao e uma dependencia
 * do projeto) - parser minimo, so precisa de KEY="value" simples.
 */
function carregarEnvTest() {
  const caminho = path.resolve(process.cwd(), ".env.test");
  if (!fs.existsSync(caminho)) {
    throw new Error(
      ".env.test nao encontrado. Testes de integracao precisam de um Postgres de teste dedicado - " +
        "veja tests/integration/README.md."
    );
  }
  const conteudo = fs.readFileSync(caminho, "utf-8");
  for (const linha of conteudo.split("\n")) {
    const trimmed = linha.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const igual = trimmed.indexOf("=");
    if (igual === -1) continue;
    const chave = trimmed.slice(0, igual).trim();
    let valor = trimmed.slice(igual + 1).trim();
    if (valor.startsWith('"') && valor.endsWith('"')) valor = valor.slice(1, -1);
    process.env[chave] = valor;
  }
}

carregarEnvTest();

// Rede de seguranca: NUNCA rodar TRUNCATE contra algo que nao pareca um
// banco de teste. Se isso disparar, corrija .env.test - nao contorne.
if (!process.env.DATABASE_URL || !process.env.DATABASE_URL.includes("test")) {
  throw new Error(
    "Recusando rodar testes de integracao: DATABASE_URL nao contem 'test'. " +
      "Configure .env.test apontando para um banco de teste dedicado (ex.: bosquecoins_test)."
  );
}

// Importado DEPOIS de carregarEnvTest() setar process.env.DATABASE_URL,
// para que o PrismaClient (instanciado no import de @/lib/db) conecte no
// banco de teste, nao no banco de dev.
const { prisma } = await import("@/lib/db");

export { prisma };

const TABELAS_EM_ORDEM_DE_DEPENDENCIA = [
  "resgates",
  "transacoes",
  "itens_catalogo",
  "casa_periodos",
  "turma_periodos",
  "professor_pec_turmas",
  "matriculas",
  "usuarios",
  "turmas",
  "casas",
  "anos_letivos",
];

export async function resetDb() {
  await prisma.$executeRawUnsafe(
    `TRUNCATE TABLE ${TABELAS_EM_ORDEM_DE_DEPENDENCIA.join(", ")} RESTART IDENTITY CASCADE`
  );
}

beforeEach(async () => {
  await resetDb();
});

afterAll(async () => {
  await prisma.$disconnect();
});
