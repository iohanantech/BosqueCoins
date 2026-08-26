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
