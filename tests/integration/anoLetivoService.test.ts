import { describe, it, expect } from "vitest";
import { prisma } from "./setup";
import { criarFixtureBase } from "./fixtures";
import { distribuirPontos } from "@/lib/services/pointsService";
import { investir } from "@/lib/services/investmentService";
import { encerrarAnoLetivo } from "@/lib/services/anoLetivoService";

describe("Encerramento do ano letivo (secao 5)", () => {
  it("abre o novo ano zerado, mantem o anterior intacto, e nao mexe no saldo vitalicio", async () => {
    const { turmaA, alunoA1, professorPec, anoLetivo } = await criarFixtureBase();

    // Credito ao aluno (so mexe no saldo pessoal - RN-01 substituida) +
    // investimento em turma (unico jeito de turmaPeriodo crescer agora - RN-16).
    await distribuirPontos({
      turmaId: turmaA.id,
      alunoIds: [alunoA1.id],
      valor: 40,
      motivo: "Base do ano",
      autorId: professorPec.id,
      autorPapel: "professor",
    });
    await investir({ alunoId: alunoA1.id, tipo: "turma", valor: 15 });

    const novoAno = await encerrarAnoLetivo({
      nomeProximoAno: "2027",
      dataInicioProximoAno: new Date("2027-02-01"),
      dataFimProximoAno: new Date("2027-12-19"),
    });

    expect(novoAno.ativo).toBe(true);

    const anoAntigoAtualizado = await prisma.anoLetivo.findUniqueOrThrow({ where: { id: anoLetivo.id } });
    expect(anoAntigoAtualizado.ativo).toBe(false);
    expect(anoAntigoAtualizado.encerrado).toBe(true);

    // TurmaPeriodo do ano ANTERIOR continua consultavel e intacto (com o
    // que foi investido nele, ja que credito nao propaga mais - RN-01).
    const turmaPeriodoAntigo = await prisma.turmaPeriodo.findUniqueOrThrow({
      where: { turmaId_anoLetivoId: { turmaId: turmaA.id, anoLetivoId: anoLetivo.id } },
    });
    expect(turmaPeriodoAntigo.saldoAtual).toBe(15);

    // O TurmaPeriodo do ano novo (criado pelo fixture so pro ano antigo) nao
    // existe ainda pro novo ano - so e criado sob demanda ao investir (RN-16).
    const turmaPeriodoNovo = await prisma.turmaPeriodo.findUnique({
      where: { turmaId_anoLetivoId: { turmaId: turmaA.id, anoLetivoId: novoAno.id } },
    });
    expect(turmaPeriodoNovo).toBeNull();

    // Saldo pessoal do aluno (vitalicio) NAO muda com o encerramento.
    const aluno = await prisma.usuario.findUniqueOrThrow({ where: { id: alunoA1.id } });
    expect(aluno.saldoAtual).toBe(40 - 15); // creditado 40, investiu 15 em turma
    expect(aluno.saldoAcumulado).toBe(40); // investir nao mexe no acumulado

    // Matriculas sao escopadas por ano letivo (RN-11) - nao sao herdadas
    // automaticamente pelo ano novo; o admin reatribui via importacao de
    // planilha (secao 4.6, ver src/app/(app)/admin/ano-letivo/page.tsx).
    await prisma.matricula.create({
      data: { alunoId: alunoA1.id, turmaId: turmaA.id, anoLetivoId: novoAno.id },
    });

    // Se o aluno investir na turma no ano novo, o TurmaPeriodo comeca do zero.
    await investir({ alunoId: alunoA1.id, tipo: "turma", valor: 5 });
    const turmaPeriodoNovoAposInvestir = await prisma.turmaPeriodo.findUniqueOrThrow({
      where: { turmaId_anoLetivoId: { turmaId: turmaA.id, anoLetivoId: novoAno.id } },
    });
    expect(turmaPeriodoNovoAposInvestir.saldoAtual).toBe(5);
  });
});
