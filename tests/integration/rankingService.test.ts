import { describe, it, expect } from "vitest";
import { prisma } from "./setup";
import { buscarRankingTurmas, buscarRankingCasas } from "@/lib/services/rankingService";

/**
 * Regressao: o dashboard aparecia VAZIO num ambiente novo (ex.: producao sem
 * seed) porque o ranking so listava turmas/Casas que ja tinham uma linha de
 * TurmaPeriodo/CasaPeriodo - e essa linha so nasce no primeiro ponto. Agora
 * o ranking parte de TODAS as turmas/Casas ativas, com 0/0 ate pontuarem.
 */
describe("Ranking lista turmas/Casas ativas mesmo SEM linha de periodo", () => {
  it("turmas ativas sem TurmaPeriodo aparecem no ranking com saldo 0", async () => {
    const anoLetivo = await prisma.anoLetivo.create({
      data: { nome: "2026", dataInicio: new Date("2026-02-01"), dataFim: new Date("2026-12-19"), ativo: true },
    });
    const t1 = await prisma.turma.create({ data: { nome: "6º A", serie: "6º ano" } });
    const t2 = await prisma.turma.create({ data: { nome: "6º B", serie: "6º ano" } });
    const inativa = await prisma.turma.create({ data: { nome: "Turma Velha", serie: "9º ano", ativo: false } });

    const ranking = await buscarRankingTurmas(anoLetivo.id);

    expect(ranking.map((r) => r.turmaId).sort()).toEqual([t1.id, t2.id].sort());
    expect(ranking.every((r) => r.saldoAtual === 0 && r.saldoAcumulado === 0)).toBe(true);
    expect(ranking.some((r) => r.turmaId === inativa.id)).toBe(false); // inativa fica de fora
  });

  it("Casas ativas sem CasaPeriodo aparecem no ranking com saldo 0", async () => {
    const anoLetivo = await prisma.anoLetivo.create({
      data: { nome: "2026", dataInicio: new Date("2026-02-01"), dataFim: new Date("2026-12-19"), ativo: true },
    });
    const c1 = await prisma.casa.create({ data: { nome: "Camapuã", corPrimariaHex: "#111111", corSecundariaHex: "#222222" } });
    const c2 = await prisma.casa.create({ data: { nome: "Marumbi", corPrimariaHex: "#333333", corSecundariaHex: "#444444" } });

    const ranking = await buscarRankingCasas(anoLetivo.id);

    expect(ranking.map((r) => r.casaId).sort()).toEqual([c1.id, c2.id].sort());
    expect(ranking.every((r) => r.saldoAtual === 0)).toBe(true);
  });

  it("quando ha TurmaPeriodo, o saldo dele e usado e a ordenacao respeita o total", async () => {
    const anoLetivo = await prisma.anoLetivo.create({
      data: { nome: "2026", dataInicio: new Date("2026-02-01"), dataFim: new Date("2026-12-19"), ativo: true },
    });
    const t1 = await prisma.turma.create({ data: { nome: "6º A", serie: "6º ano" } });
    const t2 = await prisma.turma.create({ data: { nome: "6º B", serie: "6º ano" } });
    await prisma.turmaPeriodo.create({ data: { turmaId: t2.id, anoLetivoId: anoLetivo.id, saldoAtual: 50, saldoAcumulado: 50 } });

    const ranking = await buscarRankingTurmas(anoLetivo.id, "total");

    expect(ranking[0]?.turmaId).toBe(t2.id); // 50 > 0
    expect(ranking[0]?.saldoAtual).toBe(50);
    expect(ranking[1]?.turmaId).toBe(t1.id);
    expect(ranking[1]?.saldoAtual).toBe(0);
  });
});
