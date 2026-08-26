"use client";

import { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CoinIcon } from "@/components/ui/coin-icon";
import { AvisoDesktop } from "@/components/layout/aviso-desktop";
import { formatarData } from "@/lib/utils";

interface Lote {
  loteId: string;
  valor: number;
  motivo: string;
  criadoEm: string;
  quantidadeAlunos: number;
  destinoIds: string[];
}

interface Opcao {
  id: string;
  nome: string;
}

const TIPOS = [
  { value: "", label: "Todos os tipos" },
  { value: "credito", label: "Crédito" },
  { value: "debito", label: "Débito" },
  { value: "ajuste", label: "Ajuste" },
];

/**
 * Extrato do admin com filtros avancados (item pendente do CLAUDE.md, Fase 5):
 * data (intervalo), Casa, tipo de transacao, ano letivo, alem dos ja
 * existentes turma/professor. Tela naturalmente desktop (tabela larga),
 * mesmo padrao de /admin/importar e /admin/ano-letivo.
 */
export default function AdminExtratoPage() {
  const [lotes, setLotes] = useState<Lote[]>([]);
  const [truncado, setTruncado] = useState(false);
  const [carregando, setCarregando] = useState(true);
  const [loteExpandido, setLoteExpandido] = useState<string | null>(null);

  const [turmas, setTurmas] = useState<Opcao[]>([]);
  const [casas, setCasas] = useState<Opcao[]>([]);
  const [professores, setProfessores] = useState<Opcao[]>([]);
  const [anosLetivos, setAnosLetivos] = useState<Opcao[]>([]);

  const [turmaId, setTurmaId] = useState("");
  const [casaId, setCasaId] = useState("");
  const [professorId, setProfessorId] = useState("");
  const [tipo, setTipo] = useState("");
  const [anoLetivoId, setAnoLetivoId] = useState("");
  const [dataInicio, setDataInicio] = useState("");
  const [dataFim, setDataFim] = useState("");

  useEffect(() => {
    fetch("/api/turmas").then((r) => r.json()).then((t: { id: string; nome: string }[]) => setTurmas(t));
    fetch("/api/casas").then((r) => r.json()).then((c: { id: string; nome: string }[]) => setCasas(c));
    fetch("/api/usuarios?papel=professor")
      .then((r) => r.json())
      .then((p: { id: string; nome: string }[]) => setProfessores(p));
    fetch("/api/dashboard/rankings")
      .then((r) => r.json())
      .then((d: { anosLetivos: { id: string; nome: string }[]; anoLetivo: { id: string } }) => {
        setAnosLetivos(d.anosLetivos);
        setAnoLetivoId(d.anoLetivo.id);
      });
  }, []);

  async function buscar() {
    setCarregando(true);
    const params = new URLSearchParams();
    if (turmaId) params.set("turmaId", turmaId);
    if (casaId) params.set("casaId", casaId);
    if (professorId) params.set("professorId", professorId);
    if (tipo) params.set("tipo", tipo);
    if (anoLetivoId) params.set("anoLetivoId", anoLetivoId);
    if (dataInicio) params.set("dataInicio", dataInicio);
    if (dataFim) params.set("dataFim", dataFim);

    const res = await fetch(`/api/extrato?${params.toString()}`);
    const json = await res.json();
    setLotes(json.lotes ?? []);
    setTruncado(!!json.truncado);
    setCarregando(false);
  }

  useEffect(() => {
    if (anoLetivoId) buscar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [anoLetivoId]);

  function limparFiltros() {
    setTurmaId("");
    setCasaId("");
    setProfessorId("");
    setTipo("");
    setDataInicio("");
    setDataFim("");
  }

  return (
    <div className="space-y-4">
      <h1 className="font-display text-lg font-semibold">Extrato (admin)</h1>
      <AvisoDesktop>Esta tela funciona melhor em um computador — os filtros e a tabela ficam apertados em telas pequenas.</AvisoDesktop>

      <Card>
        <p className="mb-3 text-sm font-semibold">Filtros</p>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          <div>
            <label className="mb-1 block text-xs font-medium text-neutral-500">Ano letivo</label>
            <select className="w-full rounded-lg border border-neutral-200 p-2 text-sm dark:border-neutral-700 dark:bg-graphite" value={anoLetivoId} onChange={(e) => setAnoLetivoId(e.target.value)}>
              {anosLetivos.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.nome}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-neutral-500">Tipo</label>
            <select className="w-full rounded-lg border border-neutral-200 p-2 text-sm dark:border-neutral-700 dark:bg-graphite" value={tipo} onChange={(e) => setTipo(e.target.value)}>
              {TIPOS.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-neutral-500">Turma</label>
            <select
              className="w-full rounded-lg border border-neutral-200 p-2 text-sm dark:border-neutral-700 dark:bg-graphite"
              value={turmaId}
              onChange={(e) => {
                setTurmaId(e.target.value);
                if (e.target.value) setCasaId("");
              }}
            >
              <option value="">Todas as turmas</option>
              {turmas.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.nome}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-neutral-500">Casa</label>
            <select
              className="w-full rounded-lg border border-neutral-200 p-2 text-sm dark:border-neutral-700 dark:bg-graphite"
              value={casaId}
              onChange={(e) => {
                setCasaId(e.target.value);
                if (e.target.value) setTurmaId("");
              }}
            >
              <option value="">Todas as Casas</option>
              {casas.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.nome}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-neutral-500">Professor (origem)</label>
            <select className="w-full rounded-lg border border-neutral-200 p-2 text-sm dark:border-neutral-700 dark:bg-graphite" value={professorId} onChange={(e) => setProfessorId(e.target.value)}>
              <option value="">Todos os professores</option>
              {professores.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.nome}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-neutral-500">De</label>
            <input type="date" className="w-full rounded-lg border border-neutral-200 p-2 text-sm dark:border-neutral-700 dark:bg-graphite" value={dataInicio} onChange={(e) => setDataInicio(e.target.value)} />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-neutral-500">Até</label>
            <input type="date" className="w-full rounded-lg border border-neutral-200 p-2 text-sm dark:border-neutral-700 dark:bg-graphite" value={dataFim} onChange={(e) => setDataFim(e.target.value)} />
          </div>
        </div>
        <div className="mt-3 flex gap-2">
          <button onClick={buscar} className="rounded-full bg-gold-gradient px-4 py-1.5 text-xs font-semibold text-white">
            Aplicar filtros
          </button>
          <button onClick={limparFiltros} className="rounded-full border border-neutral-200 px-4 py-1.5 text-xs text-neutral-500 dark:border-neutral-700">
            Limpar
          </button>
        </div>
      </Card>

      {carregando && <p className="py-6 text-center text-sm text-neutral-400">Carregando…</p>}

      {!carregando && truncado && (
        <p className="rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-700 dark:bg-amber-950 dark:text-amber-300">
          Muitos resultados para estes filtros — mostrando só os mais recentes. Refine o período ou os filtros para ver o restante.
        </p>
      )}

      {!carregando && (
        <div className="space-y-2">
          {lotes.map((lote) => (
            <Card key={lote.loteId}>
              <button className="flex w-full items-center justify-between text-left" onClick={() => setLoteExpandido(loteExpandido === lote.loteId ? null : lote.loteId)}>
                <div>
                  <p className="text-sm font-medium">
                    {lote.valor} BosqueCoins · {lote.quantidadeAlunos} lançamento{lote.quantidadeAlunos > 1 ? "s" : ""}
                  </p>
                  <p className="text-xs text-neutral-400">
                    {lote.motivo} · {formatarData(lote.criadoEm)}
                  </p>
                </div>
                <Badge variant="gold">{lote.quantidadeAlunos}</Badge>
              </button>
              {loteExpandido === lote.loteId && (
                <ul className="mt-3 space-y-1 border-t border-neutral-100 pt-2 text-xs text-neutral-500 dark:border-neutral-800">
                  {lote.destinoIds.map((id) => (
                    <li key={id} className="flex items-center gap-1 font-mono">
                      <CoinIcon className="h-3 w-3" />
                      {id}
                    </li>
                  ))}
                </ul>
              )}
            </Card>
          ))}
          {lotes.length === 0 && <p className="py-10 text-center text-sm text-neutral-400">Nenhum lançamento para estes filtros.</p>}
        </div>
      )}
    </div>
  );
}
