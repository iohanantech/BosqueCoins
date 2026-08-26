import { describe, it, expect } from "vitest";
import { prisma } from "./setup";
import { criarFixtureBase } from "./fixtures";
import { validarLinhas, confirmarImportacao, type LinhaPlanilha } from "@/lib/services/importService";

describe("Importacao de planilha (secao 4.6)", () => {
  it("classifica cada linha com o status correto", async () => {
    const { turmaA, casaA, alunoA1 } = await criarFixtureBase();

    const linhas: LinhaPlanilha[] = [
      { linha: 2, nome: "Novo Aluno", email: "novo@bosquemananciais.org.br", turma: turmaA.nome, casa: casaA.nome },
      { linha: 3, nome: "Email Ruim", email: "nao-e-email", turma: turmaA.nome, casa: casaA.nome },
      { linha: 4, nome: "Dominio Errado", email: "x@outraescola.com", turma: turmaA.nome, casa: casaA.nome },
      { linha: 5, nome: "Turma Fantasma", email: "turmafantasma@bosquemananciais.org.br", turma: "Turma Z", casa: casaA.nome },
      { linha: 6, nome: "Casa Fantasma", email: "casafantasma@bosquemananciais.org.br", turma: turmaA.nome, casa: "Casa Z" },
      { linha: 7, nome: "Duplicado 1", email: "duplicado@bosquemananciais.org.br", turma: turmaA.nome, casa: casaA.nome },
      { linha: 8, nome: "Duplicado 2", email: "duplicado@bosquemananciais.org.br", turma: turmaA.nome, casa: casaA.nome },
      { linha: 9, nome: "Aluno A1 de novo", email: alunoA1.email, turma: turmaA.nome, casa: casaA.nome },
    ];

    const resultado = await validarLinhas(linhas);
    const status = Object.fromEntries(resultado.map((r) => [r.linha, r.status]));

    expect(status[2]).toBe("ok");
    expect(status[3]).toBe("email_malformado");
    expect(status[4]).toBe("dominio_invalido");
    expect(status[5]).toBe("turma_inexistente");
    expect(status[6]).toBe("casa_inexistente");
    expect(status[7]).toBe("ok"); // primeira ocorrencia
    expect(status[8]).toBe("email_duplicado_planilha"); // segunda ocorrencia
    expect(status[9]).toBe("email_ja_existe_banco");
  });

  it("confirmarImportacao respeita 'rejeitar' para turma/casa inexistente e nao cria nada", async () => {
    const { casaA, anoLetivo } = await criarFixtureBase();

    const linhas = await validarLinhas([
      { linha: 2, nome: "Turma Fantasma", email: "turmafantasma@bosquemananciais.org.br", turma: "Turma Z", casa: casaA.nome },
    ]);

    const resumo = await confirmarImportacao({
      linhas,
      duplicados: "atualizar",
      turmaCasaInexistente: "rejeitar",
      anoLetivoId: anoLetivo.id,
    });

    expect(resumo.criados).toBe(0);
    expect(resumo.falharam).toBe(1);

    const turmaFantasma = await prisma.turma.findUnique({ where: { nome: "Turma Z" } });
    expect(turmaFantasma).toBeNull();
  });

  it("confirmarImportacao com 'criar' cria a turma/casa faltante e matricula o aluno", async () => {
    const { casaA, anoLetivo } = await criarFixtureBase();

    const linhas = await validarLinhas([
      { linha: 2, nome: "Turma Nova", email: "turmanova@bosquemananciais.org.br", turma: "Turma Nova Z", casa: casaA.nome },
    ]);

    const resumo = await confirmarImportacao({
      linhas,
      duplicados: "atualizar",
      turmaCasaInexistente: "criar",
      anoLetivoId: anoLetivo.id,
    });

    expect(resumo.criados).toBe(1);

    const turmaNova = await prisma.turma.findUniqueOrThrow({ where: { nome: "Turma Nova Z" } });
    const aluno = await prisma.usuario.findUniqueOrThrow({ where: { email: "turmanova@bosquemananciais.org.br" } });
    const matricula = await prisma.matricula.findUnique({
      where: { alunoId_anoLetivoId: { alunoId: aluno.id, anoLetivoId: anoLetivo.id } },
    });
    expect(matricula?.turmaId).toBe(turmaNova.id);
  });

  it("duplicados: 'pular' nao atualiza o registro existente", async () => {
    const { turmaA, casaA, alunoA1, anoLetivo } = await criarFixtureBase();

    const linhas = await validarLinhas([
      { linha: 2, nome: "Nome Alterado", email: alunoA1.email, turma: turmaA.nome, casa: casaA.nome },
    ]);

    const resumo = await confirmarImportacao({
      linhas,
      duplicados: "pular",
      turmaCasaInexistente: "criar",
      anoLetivoId: anoLetivo.id,
    });

    expect(resumo.criados).toBe(0);
    expect(resumo.atualizados).toBe(0);

    const alunoInalterado = await prisma.usuario.findUniqueOrThrow({ where: { id: alunoA1.id } });
    expect(alunoInalterado.nome).toBe("Aluno A1");
  });
});
