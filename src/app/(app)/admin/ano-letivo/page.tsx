"use client";

import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { AvisoDesktop } from "@/components/layout/aviso-desktop";

/**
 * Encerrar ano letivo e abrir o proximo (secao 5, item 5): zera saldos de
 * turma/Casa (via novos turma_periodos/casa_periodos), NUNCA mexe no saldo
 * pessoal de aluno/professor. Depois, o admin reatribui turmas via planilha
 * (secao 4.6) - link direto para a tela de importar.
 */
export default function AdminAnoLetivoPage() {
  const [nome, setNome] = useState("");
  const [inicio, setInicio] = useState("");
  const [fim, setFim] = useState("");
  const [confirmando, setConfirmando] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [resultado, setResultado] = useState<string | null>(null);

  async function encerrar() {
    setEnviando(true);
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
        ? `Ano ${json.nome} aberto! Os placares de turma/Casa zeraram; os saldos pessoais dos alunos e professores continuam intactos. Agora reatribua as turmas em "Importar planilha".`
        : json.erro ?? "Não foi possível encerrar o ano letivo."
    );
    setConfirmando(false);
    setEnviando(false);
  }

  return (
    <div className="space-y-4">
      <h1 className="font-display text-lg font-semibold">Ano letivo</h1>
      <AvisoDesktop>Recomendamos fazer o encerramento do ano letivo em um computador.</AvisoDesktop>

      <Card>
        <p className="mb-2 text-sm font-semibold">Encerrar ano vigente e abrir o próximo</p>
        <ul className="mb-3 list-disc pl-4 text-xs text-neutral-500 dark:text-neutral-400">
          <li>Os saldos de turma e Casa (atual e acumulado) voltam a zero no ano novo.</li>
          <li>O saldo pessoal de cada aluno e professor <strong>não muda</strong> — é vitalício.</li>
          <li>O ano anterior continua 100% consultável no seletor de ano do dashboard.</li>
        </ul>
        <div className="space-y-2">
          <Input placeholder="Nome do próximo ano (ex.: 2027)" value={nome} onChange={(e) => setNome(e.target.value)} />
          <Input type="date" value={inicio} onChange={(e) => setInicio(e.target.value)} />
          <Input type="date" value={fim} onChange={(e) => setFim(e.target.value)} />
        </div>

        {!confirmando ? (
          <Button className="mt-3 w-full" variant="destructive" disabled={!nome || !inicio || !fim} onClick={() => setConfirmando(true)}>
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

        {resultado && <p className="mt-3 text-xs text-neutral-600 dark:text-neutral-300">{resultado}</p>}
      </Card>
    </div>
  );
}
