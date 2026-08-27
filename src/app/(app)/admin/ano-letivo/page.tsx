"use client";

import { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { AvisoDesktop } from "@/components/layout/aviso-desktop";

/**
 * Duas situacoes na mesma tela:
 *  - Sistema recem-criado (nenhum ano letivo): formulario "abrir o primeiro
 *    ano". Sem isto, o resto do sistema fica travado (dashboard, cadastro de
 *    aluno, extrato... tudo depende de um ano letivo ativo).
 *  - Ja existe ano letivo: fluxo de "encerrar o vigente e abrir o proximo"
 *    (secao 5, item 5) - zera placares de turma/Casa, NUNCA o saldo pessoal.
 */
export default function AdminAnoLetivoPage() {
  const [carregando, setCarregando] = useState(true);
  const [temAno, setTemAno] = useState(false);

  const [nome, setNome] = useState("");
  const [inicio, setInicio] = useState("");
  const [fim, setFim] = useState("");
  const [confirmando, setConfirmando] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [resultado, setResultado] = useState<{ tipo: "sucesso" | "erro"; texto: string } | null>(null);

  async function carregarEstado() {
    setCarregando(true);
    try {
      const res = await fetch("/api/anos-letivos");
      const json = res.ok ? await res.json() : { total: 0 };
      setTemAno((json.total ?? 0) > 0);
    } finally {
      setCarregando(false);
    }
  }

  useEffect(() => {
    carregarEstado();
  }, []);

  async function abrirPrimeiro() {
    setEnviando(true);
    setResultado(null);
    try {
      const res = await fetch("/api/anos-letivos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nome, dataInicio: inicio, dataFim: fim }),
      });
      const json = await res.json();
      if (res.ok) {
        setResultado({
          tipo: "sucesso",
          texto: `Ano letivo ${json.nome} aberto! Agora você já pode cadastrar Casas, turmas e alunos.`,
        });
        setNome("");
        setInicio("");
        setFim("");
        carregarEstado();
      } else {
        setResultado({ tipo: "erro", texto: json.erro ?? "Não foi possível abrir o ano letivo." });
      }
    } finally {
      setEnviando(false);
    }
  }

  async function encerrar() {
    setEnviando(true);
    setResultado(null);
    try {
      const res = await fetch("/api/anos-letivos/encerrar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nomeProximoAno: nome,
          dataInicioProximoAno: inicio,
          dataFimProximoAno: fim,
        }),
      });
      const json = await res.json();
      setResultado(
        res.ok
          ? {
              tipo: "sucesso",
              texto: `Ano ${json.nome} aberto! Os placares de turma/Casa zeraram; os saldos pessoais dos alunos e professores continuam intactos. Agora reatribua as turmas em "Importar planilha".`,
            }
          : { tipo: "erro", texto: json.erro ?? "Não foi possível encerrar o ano letivo." }
      );
      setConfirmando(false);
    } finally {
      setEnviando(false);
    }
  }

  const camposPreenchidos = Boolean(nome && inicio && fim);

  return (
    <div className="space-y-4">
      <h1 className="font-display text-lg font-semibold">Ano letivo</h1>
      <AvisoDesktop>Recomendamos gerenciar o ano letivo em um computador.</AvisoDesktop>

      {carregando ? (
        <p className="py-8 text-center text-sm text-neutral-400">Carregando…</p>
      ) : !temAno ? (
        <Card>
          <p className="mb-2 text-sm font-semibold">Abrir o primeiro ano letivo</p>
          <p className="mb-3 text-xs text-neutral-500 dark:text-neutral-400">
            Ainda não há nenhum ano letivo cadastrado. O sistema precisa de um ano letivo ativo para funcionar — sem
            ele, o dashboard, o cadastro de alunos e o extrato ficam indisponíveis.
          </p>
          <div className="space-y-2">
            <Input placeholder="Nome do ano (ex.: 2026)" value={nome} onChange={(e) => setNome(e.target.value)} />
            <label className="block text-xs font-medium text-neutral-500">Início</label>
            <Input type="date" value={inicio} onChange={(e) => setInicio(e.target.value)} />
            <label className="block text-xs font-medium text-neutral-500">Fim</label>
            <Input type="date" value={fim} onChange={(e) => setFim(e.target.value)} />
          </div>
          <Button className="mt-3 w-full" disabled={!camposPreenchidos || enviando} onClick={abrirPrimeiro}>
            {enviando ? "Abrindo…" : "Abrir ano letivo"}
          </Button>
          {resultado && (
            <p
              className={`mt-3 text-xs ${resultado.tipo === "sucesso" ? "text-emerald-600" : "text-red-600"}`}
            >
              {resultado.texto}
            </p>
          )}
        </Card>
      ) : (
        <Card>
          <p className="mb-2 text-sm font-semibold">Encerrar ano vigente e abrir o próximo</p>
          <ul className="mb-3 list-disc pl-4 text-xs text-neutral-500 dark:text-neutral-400">
            <li>Os saldos de turma e Casa (atual e acumulado) voltam a zero no ano novo.</li>
            <li>
              O saldo pessoal de cada aluno e professor <strong>não muda</strong> — é vitalício.
            </li>
            <li>O ano anterior continua 100% consultável no seletor de ano do dashboard.</li>
          </ul>
          <div className="space-y-2">
            <Input
              placeholder="Nome do próximo ano (ex.: 2027)"
              value={nome}
              onChange={(e) => setNome(e.target.value)}
            />
            <label className="block text-xs font-medium text-neutral-500">Início</label>
            <Input type="date" value={inicio} onChange={(e) => setInicio(e.target.value)} />
            <label className="block text-xs font-medium text-neutral-500">Fim</label>
            <Input type="date" value={fim} onChange={(e) => setFim(e.target.value)} />
          </div>

          {!confirmando ? (
            <Button
              className="mt-3 w-full"
              variant="destructive"
              disabled={!camposPreenchidos}
              onClick={() => setConfirmando(true)}
            >
              Encerrar ano letivo
            </Button>
          ) : (
            <div className="mt-3 space-y-2 rounded-xl2 border border-red-200 bg-red-50 p-3 dark:border-red-900 dark:bg-red-950/30">
              <p className="text-xs text-red-700 dark:text-red-300">
                Tem certeza? Esta ação zera os placares de turma e Casa do ano vigente e não pode ser desfeita.
              </p>
              <div className="flex gap-2">
                <Button size="sm" variant="destructive" disabled={enviando} onClick={encerrar}>
                  {enviando ? "Encerrando…" : "Sim, encerrar"}
                </Button>
                <Button size="sm" variant="outline" onClick={() => setConfirmando(false)}>
                  Cancelar
                </Button>
              </div>
            </div>
          )}

          {resultado && (
            <p
              className={`mt-3 text-xs ${resultado.tipo === "sucesso" ? "text-emerald-600" : "text-red-600"}`}
            >
              {resultado.texto}
            </p>
          )}
        </Card>
      )}
    </div>
  );
}
