/**
 * Seed de desenvolvimento (Fase 2 da especificacao).
 * Roda com: npm run prisma:seed
 *
 * Dados ficticios apenas - NENHUM dado real de aluno (ver criterio de aceite
 * final da especificacao: "seed usa dados ficticios").
 */
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const DOMINIO = process.env.ALLOWED_EMAIL_DOMAIN ?? "bosquemananciais.org.br";

async function main() {
  console.log("Seeding BosqueCoins...");

  // --- Ano letivo ativo ---
  const anoLetivo = await prisma.anoLetivo.upsert({
    where: { nome: "2026" },
    update: {},
    create: {
      nome: "2026",
      dataInicio: new Date("2026-02-01"),
      dataFim: new Date("2026-12-19"),
      ativo: true,
      encerrado: false,
    },
  });

  // --- As 4 Casas oficiais (secao 1) ---
  const casasSeed = [
    { nome: "Camapuã", corPrimariaHex: "#B8860B", corSecundariaHex: "#8B0000" },
    { nome: "Caratuva", corPrimariaHex: "#0B3D91", corSecundariaHex: "#00B7C3" },
    { nome: "Marumbi", corPrimariaHex: "#F5E050", corSecundariaHex: "#111111" },
    { nome: "Morro do Cal", corPrimariaHex: "#14532D", corSecundariaHex: "#4ADE80" },
  ];
  const casas = [];
  for (const c of casasSeed) {
    casas.push(await prisma.casa.upsert({ where: { nome: c.nome }, update: {}, create: c }));
  }
  for (const casa of casas) {
    await prisma.casaPeriodo.upsert({
      where: { casaId_anoLetivoId: { casaId: casa.id, anoLetivoId: anoLetivo.id } },
      update: {},
      create: { casaId: casa.id, anoLetivoId: anoLetivo.id },
    });
  }

  // --- 3 turmas de tamanhos diferentes (pressuposto 3, secao 12: 5/8/12) ---
  const turmasSeed = [
    { nome: "Turma 1A", serie: "1º ano", tamanho: 5 },
    { nome: "Turma 2B", serie: "2º ano", tamanho: 8 },
    { nome: "Turma 3C", serie: "3º ano", tamanho: 12 },
  ];
  const turmas = [];
  for (const t of turmasSeed) {
    const turma = await prisma.turma.upsert({
      where: { nome: t.nome },
      update: {},
      create: { nome: t.nome, serie: t.serie },
    });
    turmas.push({ ...turma, tamanho: t.tamanho });
    await prisma.turmaPeriodo.upsert({
      where: { turmaId_anoLetivoId: { turmaId: turma.id, anoLetivoId: anoLetivo.id } },
      update: {},
      create: { turmaId: turma.id, anoLetivoId: anoLetivo.id },
    });
  }

  // --- Admin ---
  await prisma.usuario.upsert({
    where: { email: `admin@${DOMINIO}` },
    update: {},
    create: { nome: "Admin Coordenação", email: `admin@${DOMINIO}`, papel: "admin" },
  });

  // --- 3 professores, um deles PEC ---
  const prof1 = await prisma.usuario.upsert({
    where: { email: `prof.ana@${DOMINIO}` },
    update: {},
    create: { nome: "Ana Professora", email: `prof.ana@${DOMINIO}`, papel: "professor" },
  });
  const prof2Pec = await prisma.usuario.upsert({
    where: { email: `prof.bruno.pec@${DOMINIO}` },
    update: {},
    create: { nome: "Bruno Silva (PEC)", email: `prof.bruno.pec@${DOMINIO}`, papel: "professor" },
  });
  const prof3 = await prisma.usuario.upsert({
    where: { email: `prof.carla@${DOMINIO}` },
    update: {},
    create: { nome: "Carla Souza", email: `prof.carla@${DOMINIO}`, papel: "professor" },
  });

  // Bruno é PEC da Turma 1A e da Turma 2B neste ano
  for (const turma of turmas.slice(0, 2)) {
    await prisma.professorPecTurma.upsert({
      where: {
        professorId_turmaId_anoLetivoId: {
          professorId: prof2Pec.id,
          turmaId: turma.id,
          anoLetivoId: anoLetivo.id,
        },
      },
      update: {},
      create: { professorId: prof2Pec.id, turmaId: turma.id, anoLetivoId: anoLetivo.id },
    });
  }

  console.log(`Professores: ${prof1.nome}, ${prof2Pec.nome} (PEC), ${prof3.nome}`);

  // --- ~20 alunos, distribuidos entre turmas e Casas de forma CRUZADA ---
  let contadorAluno = 1;
  for (const turma of turmas) {
    for (let i = 0; i < turma.tamanho; i++) {
      const casa = casas[contadorAluno % casas.length];
      if (!casa) continue;
      const email = `aluno${contadorAluno}@${DOMINIO}`;
      const aluno = await prisma.usuario.upsert({
        where: { email },
        update: {},
        create: {
          nome: `Aluno Ficticio ${contadorAluno}`,
          email,
          papel: "aluno",
          casaId: casa.id,
        },
      });
      await prisma.matricula.upsert({
        where: { alunoId_anoLetivoId: { alunoId: aluno.id, anoLetivoId: anoLetivo.id } },
        update: { turmaId: turma.id },
        create: { alunoId: aluno.id, turmaId: turma.id, anoLetivoId: anoLetivo.id },
      });
      contadorAluno++;
    }
  }
  console.log(`Criados ${contadorAluno - 1} alunos, distribuidos entre ${turmas.length} turmas e ${casas.length} Casas.`);

  // --- ~8 itens de catalogo cobrindo os tres escopos ---
  const itens = [
    { nome: "Caneca BosqueCoins", descricao: "Caneca oficial do colegio.", custo: 30, categoria: "Brindes", escopo: "individual" as const, icone: "☕" },
    { nome: "Adesivo colecionavel", descricao: "Adesivo exclusivo de uma Casa.", custo: 10, categoria: "Brindes", escopo: "individual" as const, icone: "⭐" },
    { nome: "Vale-lanche cantina", descricao: "Um lanche gratis na cantina.", custo: 20, categoria: "Alimentacao", escopo: "individual" as const, icone: "🥪" },
    { nome: "Passeio surpresa", descricao: "Passeio de classe fora do colegio.", custo: 300, categoria: "Experiencias", escopo: "turma" as const, icone: "🚌" },
    { nome: "Aula extra de jogos", descricao: "Um periodo de jogos no lugar de uma aula.", custo: 150, categoria: "Experiencias", escopo: "turma" as const, icone: "🎲" },
    { nome: "Festa da turma", descricao: "Festa tematica organizada pela escola.", custo: 250, categoria: "Experiencias", escopo: "turma" as const, icone: "🎉" },
    { nome: "Dia sem uniforme", descricao: "Um dia sem uniforme obrigatorio.", custo: 15, categoria: "Privilegios", escopo: "ambos" as const, icone: "👕" },
    { nome: "Sessao de cinema", descricao: "Sessao de filme na sala multiuso.", custo: 80, categoria: "Experiencias", escopo: "ambos" as const, icone: "🎬" },
  ];
  for (const item of itens) {
    const existente = await prisma.itemCatalogo.findFirst({ where: { nome: item.nome } });
    if (!existente) await prisma.itemCatalogo.create({ data: item });
  }

  console.log("Seed concluido.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
