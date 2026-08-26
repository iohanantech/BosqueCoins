import { describe, it, expect, vi } from "vitest";
import { NextRequest } from "next/server";
import { criarFixtureBase } from "./fixtures";

/**
 * Testes de autorizacao NO NIVEL DA API (nao do service) - RN-08 e RN-09 sao
 * checadas nas rotas (garantirAcessoProprioOuAdmin, ehPecDaTurma antes de
 * chamar o service), entao precisam ser testadas chamando o handler da rota
 * de verdade, com uma sessao mockada, para cobrir exatamente esse ponto.
 */

let sessaoMockada: { user: { id: string; papel: "admin" | "professor" | "aluno" } } | null = null;

vi.mock("next-auth", () => ({
  getServerSession: () => Promise.resolve(sessaoMockada),
}));

function logarComo(usuario: { id: string }, papel: "admin" | "professor" | "aluno") {
  sessaoMockada = { user: { id: usuario.id, papel } };
}

describe("RN-08 - privacidade do aluno (via API)", () => {
  it("aluno A nao pode solicitar resgate individual EM NOME de aluno B", async () => {
    const { alunoA1, alunoA2 } = await criarFixtureBase();
    const { prisma } = await import("./setup");
    const item = await prisma.itemCatalogo.create({
      data: { nome: "Caneca", descricao: "x", custo: 10, categoria: "Brindes", escopo: "individual" },
    });

    logarComo(alunoA1, "aluno");
    const { POST } = await import("@/app/api/redemptions/route");
    const req = new NextRequest("http://localhost/api/redemptions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ itemId: item.id, escopo: "individual", alunoId: alunoA2.id }),
    });

    const res = await POST(req);
    expect(res.status).toBe(403);
  });

  it("aluno pode solicitar resgate individual para SI MESMO", async () => {
    const { alunoA1 } = await criarFixtureBase();
    const { prisma } = await import("./setup");
    const item = await prisma.itemCatalogo.create({
      data: { nome: "Caneca", descricao: "x", custo: 10, categoria: "Brindes", escopo: "individual" },
    });

    logarComo(alunoA1, "aluno");
    const { POST } = await import("@/app/api/redemptions/route");
    const req = new NextRequest("http://localhost/api/redemptions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ itemId: item.id, escopo: "individual" }),
    });

    const res = await POST(req);
    expect(res.status).toBe(201);
  });
});

describe("RN-09 - escopo do PEC (via API)", () => {
  it("professor comum (nao-PEC daquela turma) nao pode fazer ajuste manual de saldo", async () => {
    const { turmaA, professorComum } = await criarFixtureBase();

    logarComo(professorComum, "professor");
    const { POST } = await import("@/app/api/points/turma/route");
    const req = new NextRequest("http://localhost/api/points/turma", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ turmaId: turmaA.id, valor: 10, direcao: "credito", motivo: "x" }),
    });

    const res = await POST(req);
    expect(res.status).toBe(403);
  });

  it("PEC da turma pode fazer ajuste manual de saldo nela", async () => {
    const { turmaA, professorPec } = await criarFixtureBase();

    logarComo(professorPec, "professor");
    const { POST } = await import("@/app/api/points/turma/route");
    const req = new NextRequest("http://localhost/api/points/turma", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ turmaId: turmaA.id, valor: 10, direcao: "credito", motivo: "x" }),
    });

    const res = await POST(req);
    expect(res.status).toBe(201);
  });

  it("PEC da turma A NAO pode fazer ajuste manual na turma B (nao administra)", async () => {
    const { turmaB, professorPec } = await criarFixtureBase();

    logarComo(professorPec, "professor");
    const { POST } = await import("@/app/api/points/turma/route");
    const req = new NextRequest("http://localhost/api/points/turma", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ turmaId: turmaB.id, valor: 10, direcao: "credito", motivo: "x" }),
    });

    const res = await POST(req);
    expect(res.status).toBe(403);
  });
});

describe("RN-22 - so o PEC inicia resgate de escopo turma (via API)", () => {
  it("admin NAO pode mais solicitar resgate de turma em nome de qualquer turma", async () => {
    const { turmaA, admin } = await criarFixtureBase();
    const { prisma } = await import("./setup");
    const item = await prisma.itemCatalogo.create({
      data: { nome: "Passeio", descricao: "x", custo: 50, categoria: "Experiencias", escopo: "turma" },
    });

    logarComo(admin, "admin");
    const { POST } = await import("@/app/api/redemptions/route");
    const req = new NextRequest("http://localhost/api/redemptions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ itemId: item.id, escopo: "turma", turmaId: turmaA.id }),
    });

    const res = await POST(req);
    expect(res.status).toBe(403);
  });

  it("PEC da turma correta continua podendo solicitar resgate de turma", async () => {
    const { turmaA, professorPec } = await criarFixtureBase();
    const { prisma } = await import("./setup");
    const item = await prisma.itemCatalogo.create({
      data: { nome: "Passeio", descricao: "x", custo: 50, categoria: "Experiencias", escopo: "turma" },
    });

    logarComo(professorPec, "professor");
    const { POST } = await import("@/app/api/redemptions/route");
    const req = new NextRequest("http://localhost/api/redemptions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ itemId: item.id, escopo: "turma", turmaId: turmaA.id }),
    });

    const res = await POST(req);
    expect(res.status).toBe(201);
  });

  it("aprovacao continua aceitando admin (camada separada de auditoria, nao muda com RN-22)", async () => {
    const { turmaA, professorPec, admin, anoLetivo } = await criarFixtureBase();
    const { prisma } = await import("./setup");
    const item = await prisma.itemCatalogo.create({
      data: { nome: "Passeio", descricao: "x", custo: 50, categoria: "Experiencias", escopo: "turma" },
    });
    // Da saldo pra turma antes (senao a aprovacao falharia por RN-06, sem relacao com RN-22).
    await prisma.turmaPeriodo.update({
      where: { turmaId_anoLetivoId: { turmaId: turmaA.id, anoLetivoId: anoLetivo.id } },
      data: { saldoAtual: 100 },
    });

    logarComo(professorPec, "professor");
    const { POST } = await import("@/app/api/redemptions/route");
    const reqSolicitar = new NextRequest("http://localhost/api/redemptions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ itemId: item.id, escopo: "turma", turmaId: turmaA.id }),
    });
    const resSolicitar = await POST(reqSolicitar);
    const resgate = await resSolicitar.json();

    logarComo(admin, "admin");
    const { PATCH } = await import("@/app/api/redemptions/[id]/route");
    const reqAprovar = new NextRequest(`http://localhost/api/redemptions/${resgate.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ decisao: "aprovado" }),
    });
    const resAprovar = await PATCH(reqAprovar, { params: { id: resgate.id } });
    expect(resAprovar.status).toBe(200);
  });
});

describe("Achado #9 (auditoria) - aluno não consegue forçar ?escopo=turma no catálogo", () => {
  it("aluno pedindo ?escopo=turma continua só vendo itens individual+ambos", async () => {
    const { alunoA1 } = await criarFixtureBase();
    const { prisma } = await import("./setup");
    await prisma.itemCatalogo.create({
      data: { nome: "Passeio de turma", descricao: "x", custo: 10, categoria: "Experiencias", escopo: "turma" },
    });
    await prisma.itemCatalogo.create({
      data: { nome: "Caneca individual", descricao: "x", custo: 10, categoria: "Brindes", escopo: "individual" },
    });

    logarComo(alunoA1, "aluno");
    const { GET } = await import("@/app/api/catalog/route");
    const req = new NextRequest("http://localhost/api/catalog?escopo=turma");
    const res = await GET(req);
    const itens = await res.json();

    expect(itens.some((i: { nome: string }) => i.nome === "Passeio de turma")).toBe(false);
    expect(itens.some((i: { nome: string }) => i.nome === "Caneca individual")).toBe(true);
  });
});

describe("Achado #6 (auditoria) - confirmação de importação não confia no status vindo do cliente", () => {
  it("linha forjada com status:'ok' pra e-mail de domínio externo NÃO cria o usuário", async () => {
    const { turmaA, casaA, admin, anoLetivo } = await criarFixtureBase();

    logarComo(admin, "admin");
    const { POST } = await import("@/app/api/import/confirmar/route");
    const req = new NextRequest("http://localhost/api/import/confirmar", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        anoLetivoId: anoLetivo.id,
        duplicados: "atualizar",
        turmaCasaInexistente: "criar",
        linhas: [
          {
            linha: 2,
            nome: "Invasor",
            email: "invasor@outraescola.com", // dominio externo (RN-10)
            turma: turmaA.nome,
            casa: casaA.nome,
            status: "ok", // forjado - o servidor deve ignorar e recalcular
          },
        ],
      }),
    });

    const res = await POST(req);
    expect(res.status).toBe(200);
    const resumo = await res.json();
    expect(resumo.criados).toBe(0);
    expect(resumo.falharam).toBe(1);

    const { prisma } = await import("./setup");
    const criado = await prisma.usuario.findUnique({ where: { email: "invasor@outraescola.com" } });
    expect(criado).toBeNull();
  });

  it("usuarioExistenteId forjado (apontando pra outra conta) é ignorado - servidor resolve pelo e-mail de verdade", async () => {
    const { turmaA, casaA, admin, alunoA1, alunoA2, anoLetivo } = await criarFixtureBase();

    logarComo(admin, "admin");
    const { POST } = await import("@/app/api/import/confirmar/route");
    const req = new NextRequest("http://localhost/api/import/confirmar", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        anoLetivoId: anoLetivo.id,
        duplicados: "atualizar",
        turmaCasaInexistente: "criar",
        linhas: [
          {
            linha: 2,
            nome: "Nome Trocado",
            email: alunoA1.email, // dono de verdade: alunoA1
            turma: turmaA.nome,
            casa: casaA.nome,
            status: "email_ja_existe_banco",
            usuarioExistenteId: alunoA2.id, // forjado - tenta sobrescrever OUTRA conta
          },
        ],
      }),
    });

    const res = await POST(req);
    expect(res.status).toBe(200);

    const { prisma } = await import("./setup");
    const a1 = await prisma.usuario.findUniqueOrThrow({ where: { id: alunoA1.id } });
    const a2 = await prisma.usuario.findUniqueOrThrow({ where: { id: alunoA2.id } });
    expect(a1.nome).toBe("Nome Trocado"); // atualizou o dono de verdade do e-mail
    expect(a2.nome).not.toBe("Nome Trocado"); // NAO vazou pra conta forjada
  });
});

describe("Achado #4 (auditoria) - sessão revalidada contra o banco, não só o token", () => {
  it("admin desativado (ativo: false) perde acesso na PRÓXIMA requisição, mesmo sem relogar", async () => {
    const { admin } = await criarFixtureBase();
    const { prisma } = await import("./setup");

    logarComo(admin, "admin"); // sessao mockada "congelada" continua dizendo papel: admin
    await prisma.usuario.update({ where: { id: admin.id }, data: { ativo: false } }); // = botao "Remover"

    const { GET } = await import("@/app/api/usuarios/route");
    const req = new NextRequest("http://localhost/api/usuarios?papel=admin");
    const res = await GET(req);

    expect(res.status).toBe(401); // antes da correcao, isto retornava 200
  });

  it("admin rebaixado a professor no banco perde permissão de admin na próxima requisição", async () => {
    const { admin } = await criarFixtureBase();
    const { prisma } = await import("./setup");

    logarComo(admin, "admin");
    await prisma.usuario.update({ where: { id: admin.id }, data: { papel: "professor" } });

    const { GET } = await import("@/app/api/usuarios/route");
    const req = new NextRequest("http://localhost/api/usuarios?papel=admin");
    const res = await GET(req);

    expect(res.status).toBe(403); // requirePapel("admin") agora ve o papel atual do banco
  });
});

describe("\"Ver a visão do aluno\" - so admin pode ver os dados de OUTRO aluno", () => {
  it("admin consegue ver o extrato e o contexto pessoal de um aluno via ?alunoId=", async () => {
    const { admin, alunoA1, turmaA, professorPec } = await criarFixtureBase();
    const { distribuirPontos } = await import("@/lib/services/pointsService");
    await distribuirPontos({
      turmaId: turmaA.id,
      alunoIds: [alunoA1.id],
      valor: 30,
      motivo: "Base",
      autorId: professorPec.id,
      autorPapel: "professor",
    });

    logarComo(admin, "admin");

    const { GET: getRankings } = await import("@/app/api/dashboard/rankings/route");
    const resRankings = await getRankings(new NextRequest(`http://localhost/api/dashboard/rankings?alunoId=${alunoA1.id}`));
    const jsonRankings = await resRankings.json();
    expect(jsonRankings.contextoAluno.saldoPessoalAtual).toBe(30);

    const { GET: getExtrato } = await import("@/app/api/extrato/route");
    const resExtrato = await getExtrato(new NextRequest(`http://localhost/api/extrato?alunoId=${alunoA1.id}`));
    const jsonExtrato = await resExtrato.json();
    expect(jsonExtrato.transacoes).toHaveLength(1);
    expect(jsonExtrato.transacoes[0].valor).toBe(30);
  });

  it("professor NÃO consegue usar ?alunoId= para ver o contexto pessoal de um aluno (RN-08)", async () => {
    const { professorComum, alunoA1 } = await criarFixtureBase();

    logarComo(professorComum, "professor");
    const { GET } = await import("@/app/api/dashboard/rankings/route");
    const res = await GET(new NextRequest(`http://localhost/api/dashboard/rankings?alunoId=${alunoA1.id}`));
    const json = await res.json();

    expect(json.contextoAluno).toBeNull(); // ?alunoId= e ignorado pra quem nao e admin
  });

  it("aluno NÃO consegue usar ?alunoId= para ver o extrato de outro aluno (RN-08)", async () => {
    const { alunoA1, alunoA2, turmaA, professorPec } = await criarFixtureBase();
    const { distribuirPontos } = await import("@/lib/services/pointsService");
    await distribuirPontos({
      turmaId: turmaA.id,
      alunoIds: [alunoA2.id],
      valor: 99,
      motivo: "Base",
      autorId: professorPec.id,
      autorPapel: "professor",
    });

    logarComo(alunoA1, "aluno"); // logado como A1, tentando espiar A2
    const { GET } = await import("@/app/api/extrato/route");
    const res = await GET(new NextRequest(`http://localhost/api/extrato?alunoId=${alunoA2.id}`));
    const json = await res.json();

    // Sempre o proprio extrato (A1, sem a transacao de 99 do A2) - o
    // parametro alunoId e simplesmente ignorado quando quem pede nao e admin.
    expect(json.transacoes.every((t: { valor: number }) => t.valor !== 99)).toBe(true);
  });
});
