import { describe, it, expect } from "vitest";
import { prisma } from "./setup";
import { criarFixtureBase } from "./fixtures";
import { distribuirPontos } from "@/lib/services/pointsService";
import { encerrarAnoLetivo } from "@/lib/services/anoLetivoService";

describe("Encerramento do ano letivo (secao 5)", () => {
  it("abre o novo ano zerado, mantem o anterior intacto, e nao mexe no saldo vitalicio", async () => {
    const { turmaA, alunoA1, professorComum, professorPec, anoLetivo } = await criarFixtureBase();

    await distribuirPontos({
      turmaId: turmaA.id,
      alunoIds: [alunoA1.id],
      valor: 40,
      motivo: "Base do ano",
      autorId: professorPec.id,
      autorPapel: "professor",
    });

    const novoAno = await encerrarAnoLetivo({
      nomeProximoAno: "2027",
      dataInicioProximoAno: new Date("2027-02-01"),
      dataFimProximoAno: new Date("2027-12-19"),
    });

    expect(novoAno.ativo).toBe(true);

    const anoAntigoAtualizado = await prisma.anoLetivo.findUniqueOrThrow({ where: { id: anoLetivo.id } });
    expect(anoAntigoAtualizado.ativo).toBe(false);
    expect(anoAntigoAtualizado.encerrado).toBe(true);

    // TurmaPeriodo/CasaPeriodo do ano ANTERIOR continuam consultaveis e intactos.
    const turmaPeriodoAntigo = await prisma.turmaPeriodo.findUniqueOrThrow({
      where: { turmaId_anoLetivoId: { turmaId: turmaA.id, anoLetivoId: anoLetivo.id } },
    });
    expect(turmaPeriodoAntigo.saldoAtual).toBe(40);

    // Nao existe TurmaPeriodo/CasaPeriodo automatico para o ano novo ainda
    // (sao criados sob demanda, via upsert, no primeiro lancamento do ano -
    // ver pointsService.ts). O importante e que NAO herdam o saldo antigo.
    const turmaPeriodoNovo = await prisma.turmaPeriodo.findUnique({
      where: { turmaId_anoLetivoId: { turmaId: turmaA.id, anoLetivoId: novoAno.id } },
    });
    expect(turmaPeriodoNovo).toBeNull();

    // Saldo pessoal do aluno (vitalicio) NAO muda com o encerramento.
    const aluno = await prisma.usuario.findUniqueOrThrow({ where: { id: alunoA1.id } });
    expect(aluno.saldoAtual).toBe(40);
    expect(aluno.saldoAcumulado).toBe(40);

    // Matriculas sao escopadas por ano letivo (RN-11) - nao sao herdadas
    // automaticamente pelo ano novo; o admin reatribui via importacao de
    // planilha (secao 4.6, ver src/app/(app)/admin/ano-letivo/page.tsx).
    await prisma.matricula.create({
      data: { alunoId: alunoA1.id, turmaId: turmaA.id, anoLetivoId: novoAno.id },
    });

    // Se um novo lancamento acontecer no ano novo, o TurmaPeriodo comeca do zero.
    await distribuirPontos({
      turmaId: turmaA.id,
      alunoIds: [alunoA1.id],
      valor: 5,
      motivo: "Primeiro lancamento do ano novo",
      autorId: professorComum.id,
      autorPapel: "professor",
    });
    const turmaPeriodoNovoAposLancamento = await prisma.turmaPeriodo.findUniqueOrThrow({
      where: { turmaId_anoLetivoId: { turmaId: turmaA.id, anoLetivoId: novoAno.id } },
    });
    expect(turmaPeriodoNovoAposLancamento.saldoAtual).toBe(5);
  });
});
