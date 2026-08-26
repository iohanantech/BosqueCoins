import { prisma } from "./setup";

/**
 * Fixture minima compartilhada pelos testes de integracao: 1 ano letivo
 * ativo, 2 Casas, 2 turmas, 1 admin, 2 professores (um PEC de turmaA),
 * alunos distribuidos entre as turmas/Casas.
 */
export async function criarFixtureBase() {
  const anoLetivo = await prisma.anoLetivo.create({
    data: { nome: "2026", dataInicio: new Date("2026-02-01"), dataFim: new Date("2026-12-19"), ativo: true },
  });

  const casaA = await prisma.casa.create({
    data: { nome: "Casa A", corPrimariaHex: "#111111", corSecundariaHex: "#222222" },
  });
  const casaB = await prisma.casa.create({
    data: { nome: "Casa B", corPrimariaHex: "#333333", corSecundariaHex: "#444444" },
  });

  const turmaA = await prisma.turma.create({ data: { nome: "Turma A", serie: "1º ano" } });
  const turmaB = await prisma.turma.create({ data: { nome: "Turma B", serie: "2º ano" } });

  await prisma.turmaPeriodo.create({ data: { turmaId: turmaA.id, anoLetivoId: anoLetivo.id } });
  await prisma.turmaPeriodo.create({ data: { turmaId: turmaB.id, anoLetivoId: anoLetivo.id } });
  await prisma.casaPeriodo.create({ data: { casaId: casaA.id, anoLetivoId: anoLetivo.id } });
  await prisma.casaPeriodo.create({ data: { casaId: casaB.id, anoLetivoId: anoLetivo.id } });

  const admin = await prisma.usuario.create({
    data: { nome: "Admin", email: "admin@bosquemananciais.org.br", papel: "admin" },
  });
  const professorComum = await prisma.usuario.create({
    data: { nome: "Professor Comum", email: "prof.comum@bosquemananciais.org.br", papel: "professor" },
  });
  const professorPec = await prisma.usuario.create({
    data: { nome: "Professor PEC", email: "prof.pec@bosquemananciais.org.br", papel: "professor" },
  });
  await prisma.professorPecTurma.create({
    data: { professorId: professorPec.id, turmaId: turmaA.id, anoLetivoId: anoLetivo.id },
  });

  const alunoA1 = await prisma.usuario.create({
    data: { nome: "Aluno A1", email: "alunoa1@bosquemananciais.org.br", papel: "aluno", casaId: casaA.id },
  });
  const alunoA2 = await prisma.usuario.create({
    data: { nome: "Aluno A2", email: "alunoa2@bosquemananciais.org.br", papel: "aluno", casaId: casaB.id },
  });
  const alunoB1 = await prisma.usuario.create({
    data: { nome: "Aluno B1", email: "alunob1@bosquemananciais.org.br", papel: "aluno", casaId: casaA.id },
  });

  await prisma.matricula.create({ data: { alunoId: alunoA1.id, turmaId: turmaA.id, anoLetivoId: anoLetivo.id } });
  await prisma.matricula.create({ data: { alunoId: alunoA2.id, turmaId: turmaA.id, anoLetivoId: anoLetivo.id } });
  await prisma.matricula.create({ data: { alunoId: alunoB1.id, turmaId: turmaB.id, anoLetivoId: anoLetivo.id } });

  return { anoLetivo, casaA, casaB, turmaA, turmaB, admin, professorComum, professorPec, alunoA1, alunoA2, alunoB1 };
}
