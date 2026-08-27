import { describe, it, expect, vi } from "vitest";
import { NextRequest } from "next/server";
import { criarFixtureBase } from "./fixtures";
import { prisma } from "./setup";

/**
 * Testes de integracao pros CRUDs administrativos (Casas, Turmas + matricula,
 * Professores, Administradores, Catalogo) - item pendente listado no
 * CLAUDE.md (Fase 8): so tinham verificacao manual ate aqui.
 */

let sessaoMockada: { user: { id: string; email?: string; papel: "admin" | "professor" | "aluno" } } | null = null;

vi.mock("next-auth", () => ({
  getServerSession: () => Promise.resolve(sessaoMockada),
}));

function logarComo(usuario: { id: string; email?: string }, papel: "admin" | "professor" | "aluno") {
  sessaoMockada = { user: { id: usuario.id, email: usuario.email, papel } };
}

describe("CRUD de Casas (via API)", () => {
  it("professor NAO pode criar Casa", async () => {
    const { professorComum } = await criarFixtureBase();
    logarComo(professorComum, "professor");
    const { POST } = await import("@/app/api/casas/route");
    const req = new NextRequest("http://localhost/api/casas", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ nome: "Casa Nova", corPrimariaHex: "#111111", corSecundariaHex: "#222222" }),
    });
    const res = await POST(req);
    expect(res.status).toBe(403);
  });

  it("admin cria uma Casa; nome duplicado e rejeitado", async () => {
    const { admin, casaA } = await criarFixtureBase();
    logarComo(admin, "admin");
    const { POST } = await import("@/app/api/casas/route");

    const resOk = await POST(
      new NextRequest("http://localhost/api/casas", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nome: "Casa Nova", corPrimariaHex: "#111111", corSecundariaHex: "#222222" }),
      })
    );
    expect(resOk.status).toBe(201);

    const resDup = await POST(
      new NextRequest("http://localhost/api/casas", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nome: casaA.nome, corPrimariaHex: "#111111", corSecundariaHex: "#222222" }),
      })
    );
    expect(resDup.status).toBe(400);
  });

  it("admin edita nome/cores/ativo de uma Casa existente", async () => {
    const { admin, casaA } = await criarFixtureBase();
    logarComo(admin, "admin");
    const { PATCH } = await import("@/app/api/casas/[id]/route");
    const req = new NextRequest(`http://localhost/api/casas/${casaA.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ nome: "Casa Renomeada", ativo: false }),
    });
    const res = await PATCH(req, { params: { id: casaA.id } });
    expect(res.status).toBe(200);

    const atualizada = await prisma.casa.findUniqueOrThrow({ where: { id: casaA.id } });
    expect(atualizada.nome).toBe("Casa Renomeada");
    expect(atualizada.ativo).toBe(false);
  });
});

describe("CRUD de Turmas + matricula de alunos (via API)", () => {
  it("professor NAO pode criar turma", async () => {
    const { professorComum } = await criarFixtureBase();
    logarComo(professorComum, "professor");
    const { POST } = await import("@/app/api/turmas/route");
    const req = new NextRequest("http://localhost/api/turmas", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ nome: "Turma Nova", serie: "5º ano" }),
    });
    const res = await POST(req);
    expect(res.status).toBe(403);
  });

  it("admin cria uma turma; nome duplicado e rejeitado", async () => {
    const { admin, turmaA } = await criarFixtureBase();
    logarComo(admin, "admin");
    const { POST } = await import("@/app/api/turmas/route");

    const resOk = await POST(
      new NextRequest("http://localhost/api/turmas", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nome: "Turma Nova", serie: "5º ano" }),
      })
    );
    expect(resOk.status).toBe(201);

    const resDup = await POST(
      new NextRequest("http://localhost/api/turmas", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nome: turmaA.nome, serie: "5º ano" }),
      })
    );
    expect(resDup.status).toBe(400);
  });

  it("admin edita e desativa uma turma; GET ?todas=true continua mostrando, GET simples nao", async () => {
    const { admin, turmaA } = await criarFixtureBase();
    logarComo(admin, "admin");
    const { PATCH } = await import("@/app/api/turmas/[id]/route");
    const res = await PATCH(
      new NextRequest(`http://localhost/api/turmas/${turmaA.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ativo: false }),
      }),
      { params: { id: turmaA.id } }
    );
    expect(res.status).toBe(200);

    const { GET } = await import("@/app/api/turmas/route");
    const resTodas = await GET(new NextRequest("http://localhost/api/turmas?todas=true"));
    const todas = await resTodas.json();
    expect(todas.some((t: { id: string }) => t.id === turmaA.id)).toBe(true);

    const resAtivas = await GET(new NextRequest("http://localhost/api/turmas"));
    const ativas = await resAtivas.json();
    expect(ativas.some((t: { id: string }) => t.id === turmaA.id)).toBe(false);
  });

  it("admin matricula um aluno numa turma; matricula-lo numa 2a turma o REMANEJA (nao duplica)", async () => {
    const { admin, turmaA, turmaB, alunoB1 } = await criarFixtureBase();
    logarComo(admin, "admin");
    const { POST } = await import("@/app/api/turmas/[id]/alunos/route");

    // alunoB1 comeca matriculado em turmaB (ver fixture) - move pra turmaA.
    const res = await POST(
      new NextRequest(`http://localhost/api/turmas/${turmaA.id}/alunos`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ alunoIds: [alunoB1.id] }),
      }),
      { params: { id: turmaA.id } }
    );
    expect(res.status).toBe(201);

    const matriculas = await prisma.matricula.findMany({ where: { alunoId: alunoB1.id } });
    expect(matriculas).toHaveLength(1); // nao duplicou
    expect(matriculas[0]?.turmaId).toBe(turmaA.id); // remanejado pra turmaA

    void turmaB;
  });

  it("admin remove a matricula de um aluno da turma", async () => {
    const { admin, turmaA, alunoA1 } = await criarFixtureBase();
    logarComo(admin, "admin");
    const { DELETE } = await import("@/app/api/turmas/[id]/alunos/route");
    const res = await DELETE(
      new NextRequest(`http://localhost/api/turmas/${turmaA.id}/alunos`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ alunoId: alunoA1.id }),
      }),
      { params: { id: turmaA.id } }
    );
    expect(res.status).toBe(200);

    const matricula = await prisma.matricula.findFirst({ where: { alunoId: alunoA1.id, turmaId: turmaA.id } });
    expect(matricula).toBeNull();
  });
});

describe("Cadastro individual de professor (via API)", () => {
  it("professor comum NAO pode cadastrar outro professor", async () => {
    const { professorComum } = await criarFixtureBase();
    logarComo(professorComum, "professor");
    const { POST } = await import("@/app/api/admin/professores/route");
    const res = await POST(
      new NextRequest("http://localhost/api/admin/professores", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nome: "Novo Prof", email: "novo.prof@bosquemananciais.org.br" }),
      })
    );
    expect(res.status).toBe(403);
  });

  it("admin cadastra um professor com dominio invalido - rejeitado (RN-10)", async () => {
    const { admin } = await criarFixtureBase();
    logarComo(admin, "admin");
    const { POST } = await import("@/app/api/admin/professores/route");
    const res = await POST(
      new NextRequest("http://localhost/api/admin/professores", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nome: "Prof Externo", email: "prof@outraescola.com" }),
      })
    );
    expect(res.status).toBe(400);
  });

  it("admin cadastra um professor e ja marca como PEC de uma turma", async () => {
    const { admin, turmaB, anoLetivo } = await criarFixtureBase();
    logarComo(admin, "admin");
    const { POST } = await import("@/app/api/admin/professores/route");
    const res = await POST(
      new NextRequest("http://localhost/api/admin/professores", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nome: "Prof Nova PEC", email: "prof.novapec@bosquemananciais.org.br", turmasPecIds: [turmaB.id] }),
      })
    );
    expect(res.status).toBe(201);
    const novoProfessor = await res.json();

    const vinculo = await prisma.professorPecTurma.findUnique({
      where: {
        professorId_turmaId_anoLetivoId: { professorId: novoProfessor.id, turmaId: turmaB.id, anoLetivoId: anoLetivo.id },
      },
    });
    expect(vinculo).not.toBeNull();
  });

  it("e-mail duplicado e rejeitado", async () => {
    const { admin, professorComum } = await criarFixtureBase();
    logarComo(admin, "admin");
    const { POST } = await import("@/app/api/admin/professores/route");
    const res = await POST(
      new NextRequest("http://localhost/api/admin/professores", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nome: "Duplicado", email: professorComum.email }),
      })
    );
    expect(res.status).toBe(400);
  });
});

describe("Cadastro individual de administrador - restrito ao super admin (via API)", () => {
  it("admin comum (nao super admin) NAO pode cadastrar outro admin", async () => {
    const { admin } = await criarFixtureBase();
    // admin2 nao e o SUPER_ADMIN_EMAIL configurado em .env.test
    const admin2 = await prisma.usuario.create({
      data: { nome: "Admin Comum", email: "admin2@bosquemananciais.org.br", papel: "admin" },
    });
    logarComo(admin2, "admin");
    const { POST } = await import("@/app/api/admin/administradores/route");
    const res = await POST(
      new NextRequest("http://localhost/api/admin/administradores", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nome: "Terceiro Admin", email: "terceiro@bosquemananciais.org.br" }),
      })
    );
    expect(res.status).toBe(403);
    void admin;
  });

  it("o super admin (SUPER_ADMIN_EMAIL) pode cadastrar outro admin", async () => {
    const { admin } = await criarFixtureBase(); // admin.email bate com SUPER_ADMIN_EMAIL do .env.test
    logarComo(admin, "admin");
    const { POST } = await import("@/app/api/admin/administradores/route");
    const res = await POST(
      new NextRequest("http://localhost/api/admin/administradores", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nome: "Novo Admin", email: "novo.admin@bosquemananciais.org.br" }),
      })
    );
    expect(res.status).toBe(201);
  });

  it("super admin remove (ativo:false) outro admin, mas nao pode remover a si mesmo", async () => {
    const { admin } = await criarFixtureBase();
    const admin2 = await prisma.usuario.create({
      data: { nome: "Admin Comum", email: "admin2@bosquemananciais.org.br", papel: "admin" },
    });
    logarComo(admin, "admin");
    const { PATCH } = await import("@/app/api/admin/administradores/[id]/route");

    const resOutro = await PATCH(
      new NextRequest(`http://localhost/api/admin/administradores/${admin2.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ativo: false }),
      }),
      { params: { id: admin2.id } }
    );
    expect(resOutro.status).toBe(200);
    const atualizado = await prisma.usuario.findUniqueOrThrow({ where: { id: admin2.id } });
    expect(atualizado.ativo).toBe(false);

    const resSiMesmo = await PATCH(
      new NextRequest(`http://localhost/api/admin/administradores/${admin.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ativo: false }),
      }),
      { params: { id: admin.id } }
    );
    expect(resSiMesmo.status).toBe(400);
  });
});

describe("Editar e excluir itens do catalogo (via API)", () => {
  it("admin edita um item do catalogo", async () => {
    const { admin } = await criarFixtureBase();
    const item = await prisma.itemCatalogo.create({
      data: { nome: "Caneca", descricao: "x", custo: 10, categoria: "Brindes", escopo: "individual" },
    });
    logarComo(admin, "admin");
    const { PATCH } = await import("@/app/api/catalog/[id]/route");
    const res = await PATCH(
      new NextRequest(`http://localhost/api/catalog/${item.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ custo: 25 }),
      }),
      { params: { id: item.id } }
    );
    expect(res.status).toBe(200);
    const atualizado = await prisma.itemCatalogo.findUniqueOrThrow({ where: { id: item.id } });
    expect(atualizado.custo).toBe(25);
  });

  it("excluir um item SEM resgates funciona", async () => {
    const { admin } = await criarFixtureBase();
    const item = await prisma.itemCatalogo.create({
      data: { nome: "Caneca", descricao: "x", custo: 10, categoria: "Brindes", escopo: "individual" },
    });
    logarComo(admin, "admin");
    const { DELETE } = await import("@/app/api/catalog/[id]/route");
    const res = await DELETE(new NextRequest(`http://localhost/api/catalog/${item.id}`, { method: "DELETE" }), {
      params: { id: item.id },
    });
    expect(res.status).toBe(200);
    expect(await prisma.itemCatalogo.findUnique({ where: { id: item.id } })).toBeNull();
  });

  it("excluir um item COM resgate no historico e bloqueado (400) - precisa desativar", async () => {
    const { admin, alunoA1, anoLetivo } = await criarFixtureBase();
    const item = await prisma.itemCatalogo.create({
      data: { nome: "Caneca", descricao: "x", custo: 10, categoria: "Brindes", escopo: "individual" },
    });
    await prisma.resgate.create({
      data: {
        anoLetivoId: anoLetivo.id,
        itemId: item.id,
        escopoUsado: "individual",
        alunoId: alunoA1.id,
        solicitanteId: alunoA1.id,
        valorDebitado: 10,
      },
    });

    logarComo(admin, "admin");
    const { DELETE } = await import("@/app/api/catalog/[id]/route");
    const res = await DELETE(new NextRequest(`http://localhost/api/catalog/${item.id}`, { method: "DELETE" }), {
      params: { id: item.id },
    });
    expect(res.status).toBe(400);
    expect(await prisma.itemCatalogo.findUnique({ where: { id: item.id } })).not.toBeNull(); // continua existindo
  });

  it("professor NAO pode editar nem excluir itens do catalogo", async () => {
    const { professorComum } = await criarFixtureBase();
    const item = await prisma.itemCatalogo.create({
      data: { nome: "Caneca", descricao: "x", custo: 10, categoria: "Brindes", escopo: "individual" },
    });
    logarComo(professorComum, "professor");
    const { PATCH, DELETE } = await import("@/app/api/catalog/[id]/route");

    const resPatch = await PATCH(
      new NextRequest(`http://localhost/api/catalog/${item.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ custo: 25 }),
      }),
      { params: { id: item.id } }
    );
    expect(resPatch.status).toBe(403);

    const resDelete = await DELETE(new NextRequest(`http://localhost/api/catalog/${item.id}`, { method: "DELETE" }), {
      params: { id: item.id },
    });
    expect(resDelete.status).toBe(403);
  });
});

describe("Cadastro individual de aluno (via API)", () => {
  it("professor NAO pode cadastrar aluno", async () => {
    const { professorComum, turmaA } = await criarFixtureBase();
    logarComo(professorComum, "professor");
    const { POST } = await import("@/app/api/admin/alunos/route");
    const res = await POST(
      new NextRequest("http://localhost/api/admin/alunos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nome: "Novo Aluno", email: "novo.aluno@bosquemananciais.org.br", turmaId: turmaA.id }),
      })
    );
    expect(res.status).toBe(403);
  });

  it("admin cadastra aluno numa turma existente: cria usuario aluno + matricula no ano vigente", async () => {
    const { admin, turmaA, casaA, anoLetivo } = await criarFixtureBase();
    logarComo(admin, "admin");
    const { POST } = await import("@/app/api/admin/alunos/route");
    const res = await POST(
      new NextRequest("http://localhost/api/admin/alunos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nome: "Ana Aluna",
          email: "ana.aluna@bosquemananciais.org.br",
          turmaId: turmaA.id,
          casaId: casaA.id,
        }),
      })
    );
    expect(res.status).toBe(201);
    const criado = await res.json();

    const noBanco = await prisma.usuario.findUniqueOrThrow({ where: { id: criado.id } });
    expect(noBanco.papel).toBe("aluno");
    expect(noBanco.casaId).toBe(casaA.id);
    const matricula = await prisma.matricula.findUniqueOrThrow({
      where: { alunoId_anoLetivoId: { alunoId: criado.id, anoLetivoId: anoLetivo.id } },
    });
    expect(matricula.turmaId).toBe(turmaA.id);
  });

  it("admin cadastra aluno passando turmaNome nova: a turma e criada na hora", async () => {
    const { admin } = await criarFixtureBase();
    logarComo(admin, "admin");
    const { POST } = await import("@/app/api/admin/alunos/route");
    const res = await POST(
      new NextRequest("http://localhost/api/admin/alunos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nome: "Beto", email: "beto@bosquemananciais.org.br", turmaNome: "7º C" }),
      })
    );
    expect(res.status).toBe(201);
    const turma = await prisma.turma.findUnique({ where: { nome: "7º C" } });
    expect(turma).not.toBeNull();
  });

  it("e-mail de dominio externo (RN-10) e rejeitado com 400", async () => {
    const { admin, turmaA } = await criarFixtureBase();
    logarComo(admin, "admin");
    const { POST } = await import("@/app/api/admin/alunos/route");
    const res = await POST(
      new NextRequest("http://localhost/api/admin/alunos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nome: "Fora", email: "fora@gmail.com", turmaId: turmaA.id }),
      })
    );
    expect(res.status).toBe(400);
    expect(await prisma.usuario.findUnique({ where: { email: "fora@gmail.com" } })).toBeNull();
  });

  it("e-mail ja cadastrado e rejeitado com 400", async () => {
    const { admin, alunoA1, turmaA } = await criarFixtureBase();
    logarComo(admin, "admin");
    const { POST } = await import("@/app/api/admin/alunos/route");
    const res = await POST(
      new NextRequest("http://localhost/api/admin/alunos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nome: "Repetido", email: alunoA1.email, turmaId: turmaA.id }),
      })
    );
    expect(res.status).toBe(400);
  });

  it("sem turma (nem turmaId nem turmaNome) e rejeitado com 400", async () => {
    const { admin } = await criarFixtureBase();
    logarComo(admin, "admin");
    const { POST } = await import("@/app/api/admin/alunos/route");
    const res = await POST(
      new NextRequest("http://localhost/api/admin/alunos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nome: "Sem Turma", email: "semturma@bosquemananciais.org.br" }),
      })
    );
    expect(res.status).toBe(400);
  });
});
