import { describe, it, expect, vi } from "vitest";
import { NextRequest } from "next/server";
import { prisma } from "./setup";
import { criarFixtureBase } from "./fixtures";
import { distribuirPontos } from "@/lib/services/pointsService";
import { enviarPresente, statusPresenteSemana, buscarAlunosPorNome } from "@/lib/services/presenteService";
import { ApiError } from "@/lib/auth/server";

/**
 * PRESENTES.md — transferencia instantanea de BosqueCoins entre alunos.
 * RN-23..RN-27. Parte dos testes chama o service direto; a parte de
 * autorizacao (papel do remetente, remetente vindo da sessao e nao do corpo)
 * chama o handler da rota com uma sessao mockada.
 */

let sessaoMockada: { user: { id: string; papel: "admin" | "professor" | "aluno" } } | null = null;
vi.mock("next-auth", () => ({
  getServerSession: () => Promise.resolve(sessaoMockada),
}));
function logarComo(usuario: { id: string }, papel: "admin" | "professor" | "aluno") {
  sessaoMockada = { user: { id: usuario.id, papel } };
}

async function darSaldo(alunoId: string, turmaId: string, professorId: string, valor: number) {
  await distribuirPontos({
    turmaId,
    alunoIds: [alunoId],
    valor,
    motivo: "Base para teste",
    autorId: professorId,
    autorPapel: "professor",
  });
}

const DIA = 24 * 60 * 60 * 1000;

describe("RN-25/RN-29 — presentear so move o saldo ATUAL, nunca o ACUMULADO", () => {
  it("remetente perde 10 do atual (acumulado igual); destinatario ganha 10 no atual (acumulado igual)", async () => {
    const { alunoA1, alunoA2, turmaA, professorPec } = await criarFixtureBase();
    await darSaldo(alunoA1.id, turmaA.id, professorPec.id, 50);
    await darSaldo(alunoA2.id, turmaA.id, professorPec.id, 30);

    await enviarPresente({ remetenteId: alunoA1.id, destinatarioId: alunoA2.id });

    const rem = await prisma.usuario.findUniqueOrThrow({ where: { id: alunoA1.id } });
    const dst = await prisma.usuario.findUniqueOrThrow({ where: { id: alunoA2.id } });
    expect(rem.saldoAtual).toBe(40);
    expect(rem.saldoAcumulado).toBe(50); // NAO muda
    expect(dst.saldoAtual).toBe(40);
    expect(dst.saldoAcumulado).toBe(30); // NAO muda - diferente de receber pontos de professor
  });

  it("gera 2 Transacao com loteId = presente.id e motivo com o nome da outra pessoa", async () => {
    const { alunoA1, alunoA2, turmaA, professorPec } = await criarFixtureBase();
    await darSaldo(alunoA1.id, turmaA.id, professorPec.id, 50);

    const presente = await enviarPresente({ remetenteId: alunoA1.id, destinatarioId: alunoA2.id });

    const transacoes = await prisma.transacao.findMany({ where: { loteId: presente.id }, orderBy: { tipo: "asc" } });
    expect(transacoes).toHaveLength(2);
    const debito = transacoes.find((t) => t.tipo === "debito")!;
    const credito = transacoes.find((t) => t.tipo === "credito")!;
    expect(debito.destinoId).toBe(alunoA1.id);
    expect(debito.motivo).toBe(`Presente enviado para ${alunoA2.nome}`);
    expect(credito.destinoId).toBe(alunoA2.id);
    expect(credito.motivo).toBe(`Presente recebido de ${alunoA1.nome}`);
  });
});

describe("RN-23 — quem pode presentear quem", () => {
  it("presentear a si mesmo falha, sem alterar saldo", async () => {
    const { alunoA1, turmaA, professorPec } = await criarFixtureBase();
    await darSaldo(alunoA1.id, turmaA.id, professorPec.id, 50);

    await expect(enviarPresente({ remetenteId: alunoA1.id, destinatarioId: alunoA1.id })).rejects.toThrow(ApiError);

    const rem = await prisma.usuario.findUniqueOrThrow({ where: { id: alunoA1.id } });
    expect(rem.saldoAtual).toBe(50);
  });

  it("destinatario inexistente falha com 404", async () => {
    const { alunoA1, turmaA, professorPec } = await criarFixtureBase();
    await darSaldo(alunoA1.id, turmaA.id, professorPec.id, 50);

    await expect(
      enviarPresente({ remetenteId: alunoA1.id, destinatarioId: "00000000-0000-0000-0000-000000000000" })
    ).rejects.toMatchObject({ status: 404 });
  });

  it("destinatario que nao e aluno (professor) falha com 404", async () => {
    const { alunoA1, professorComum, turmaA, professorPec } = await criarFixtureBase();
    await darSaldo(alunoA1.id, turmaA.id, professorPec.id, 50);

    await expect(
      enviarPresente({ remetenteId: alunoA1.id, destinatarioId: professorComum.id })
    ).rejects.toMatchObject({ status: 404 });
  });

  it("destinatario aluno inativo falha com 404", async () => {
    const { alunoA1, alunoA2, turmaA, professorPec } = await criarFixtureBase();
    await darSaldo(alunoA1.id, turmaA.id, professorPec.id, 50);
    await prisma.usuario.update({ where: { id: alunoA2.id }, data: { ativo: false } });

    await expect(
      enviarPresente({ remetenteId: alunoA1.id, destinatarioId: alunoA2.id })
    ).rejects.toMatchObject({ status: 404 });
  });

  it("via API: professor NAO pode enviar presente (403)", async () => {
    const { professorComum, alunoA1 } = await criarFixtureBase();
    logarComo(professorComum, "professor");
    const { POST } = await import("@/app/api/presentes/route");
    const req = new NextRequest("http://localhost/api/presentes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ destinatarioId: alunoA1.id }),
    });
    const res = await POST(req);
    expect(res.status).toBe(403);
  });
});

describe("RN-24 — valor fixo em 10, nao confiavel do cliente", () => {
  it("via API: `valor` forjado no corpo e ignorado - grava sempre 10", async () => {
    const { alunoA1, alunoA2, turmaA, professorPec } = await criarFixtureBase();
    await darSaldo(alunoA1.id, turmaA.id, professorPec.id, 500);

    logarComo(alunoA1, "aluno");
    const { POST } = await import("@/app/api/presentes/route");
    const req = new NextRequest("http://localhost/api/presentes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ destinatarioId: alunoA2.id, valor: 999, remetenteId: alunoA2.id }),
    });
    const res = await POST(req);
    expect(res.status).toBe(201);

    const presentes = await prisma.presente.findMany();
    expect(presentes).toHaveLength(1);
    expect(presentes[0]!.valor).toBe(10);
    // remetente e o da sessao (alunoA1), nao o forjado no corpo (alunoA2)
    expect(presentes[0]!.remetenteId).toBe(alunoA1.id);

    const rem = await prisma.usuario.findUniqueOrThrow({ where: { id: alunoA1.id } });
    expect(rem.saldoAtual).toBe(490); // debitou 10, nao 999
  });
});

describe("RN-30 — exige saldo atual suficiente", () => {
  it("aluno sem saldo suficiente nao envia; nenhum saldo muda", async () => {
    const { alunoA1, alunoA2, turmaA, professorPec } = await criarFixtureBase();
    await darSaldo(alunoA1.id, turmaA.id, professorPec.id, 5); // < 10

    await expect(enviarPresente({ remetenteId: alunoA1.id, destinatarioId: alunoA2.id })).rejects.toThrow(ApiError);

    const rem = await prisma.usuario.findUniqueOrThrow({ where: { id: alunoA1.id } });
    const dst = await prisma.usuario.findUniqueOrThrow({ where: { id: alunoA2.id } });
    expect(rem.saldoAtual).toBe(5);
    expect(dst.saldoAtual).toBe(0);
    expect(await prisma.presente.count()).toBe(0);
  });
});

describe("RN-27 — limite semanal (janela movel de 7 dias)", () => {
  it("um presente passa; o segundo na mesma janela e rejeitado com 400", async () => {
    const { alunoA1, alunoA2, alunoB1, turmaA, professorPec } = await criarFixtureBase();
    await darSaldo(alunoA1.id, turmaA.id, professorPec.id, 100);

    await enviarPresente({ remetenteId: alunoA1.id, destinatarioId: alunoA2.id });
    await expect(
      enviarPresente({ remetenteId: alunoA1.id, destinatarioId: alunoB1.id })
    ).rejects.toMatchObject({ status: 400 });

    expect(await prisma.presente.count()).toBe(1);
    const status = await statusPresenteSemana(alunoA1.id);
    expect(status.podeEnviar).toBe(false);
    expect(status.diasAteLiberar).toBeGreaterThan(0);
  });

  it("depois que a janela de 7 dias passa, um novo presente volta a funcionar", async () => {
    const { alunoA1, alunoA2, alunoB1, turmaA, professorPec } = await criarFixtureBase();
    await darSaldo(alunoA1.id, turmaA.id, professorPec.id, 100);

    const primeiro = await enviarPresente({ remetenteId: alunoA1.id, destinatarioId: alunoA2.id });
    // "Avanca o tempo" empurrando criadoEm do primeiro presente para 8 dias atras.
    await prisma.presente.update({
      where: { id: primeiro.id },
      data: { criadoEm: new Date(Date.now() - 8 * DIA) },
    });

    const status = await statusPresenteSemana(alunoA1.id);
    expect(status.podeEnviar).toBe(true);

    await expect(enviarPresente({ remetenteId: alunoA1.id, destinatarioId: alunoB1.id })).resolves.toBeTruthy();
    expect(await prisma.presente.count()).toBe(2);
  });
});

describe("Round-trip A<->B nao altera o acumulado de nenhum dos dois (razao de existir da RN-25)", () => {
  it("A presenteia B; passada a janela, B presenteia A de volta; acumulados intactos", async () => {
    const { alunoA1, alunoA2, turmaA, professorPec } = await criarFixtureBase();
    await darSaldo(alunoA1.id, turmaA.id, professorPec.id, 40);
    await darSaldo(alunoA2.id, turmaA.id, professorPec.id, 40);

    const acumInicialA = (await prisma.usuario.findUniqueOrThrow({ where: { id: alunoA1.id } })).saldoAcumulado;
    const acumInicialB = (await prisma.usuario.findUniqueOrThrow({ where: { id: alunoA2.id } })).saldoAcumulado;

    const p1 = await enviarPresente({ remetenteId: alunoA1.id, destinatarioId: alunoA2.id });
    await prisma.presente.update({ where: { id: p1.id }, data: { criadoEm: new Date(Date.now() - 8 * DIA) } });
    await enviarPresente({ remetenteId: alunoA2.id, destinatarioId: alunoA1.id });

    const a = await prisma.usuario.findUniqueOrThrow({ where: { id: alunoA1.id } });
    const b = await prisma.usuario.findUniqueOrThrow({ where: { id: alunoA2.id } });
    // saldo ATUAL volta ao ponto de partida (10 saiu e 10 voltou pra cada um)
    expect(a.saldoAtual).toBe(40);
    expect(b.saldoAtual).toBe(40);
    // e o ACUMULADO nao mudou nada - nada de inflar prestigio circulando moeda
    expect(a.saldoAcumulado).toBe(acumInicialA);
    expect(b.saldoAcumulado).toBe(acumInicialB);
  });
});

describe("GET /api/alunos/busca — autocomplete", () => {
  it("nunca retorna o proprio usuario logado", async () => {
    const { alunoA1 } = await criarFixtureBase();
    // "Aluno A1" casaria com a busca por "Aluno", mas deve ser excluido.
    const resultados = await buscarAlunosPorNome("Aluno", alunoA1.id);
    expect(resultados.some((r) => r.id === alunoA1.id)).toBe(false);
    expect(resultados.length).toBeGreaterThan(0); // A2 e B1 aparecem
  });

  it("retorna nome + turma do ano vigente e so alunos ativos", async () => {
    const { alunoA1, alunoA2, alunoB1, turmaA } = await criarFixtureBase();
    await prisma.usuario.update({ where: { id: alunoB1.id }, data: { ativo: false } });

    const resultados = await buscarAlunosPorNome("Aluno", alunoA1.id);
    const a2 = resultados.find((r) => r.id === alunoA2.id);
    expect(a2?.turma).toBe(turmaA.nome);
    expect(resultados.some((r) => r.id === alunoB1.id)).toBe(false); // inativo fora
  });

  it("via API: rota exige papel aluno (professor recebe 403)", async () => {
    const { professorComum } = await criarFixtureBase();
    logarComo(professorComum, "professor");
    const { GET } = await import("@/app/api/alunos/busca/route");
    const res = await GET(new NextRequest("http://localhost/api/alunos/busca?q=Aluno"));
    expect(res.status).toBe(403);
  });
});
