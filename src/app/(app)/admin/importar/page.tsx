"use client";

import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { AvisoDesktop } from "@/components/layout/aviso-desktop";

interface LinhaValidada {
  linha: number;
  nome: string;
  email: string;
  turma: string;
  casa: string;
  status: string;
}

const STATUS_LABEL: Record<string, { label: string; variant: "success" | "danger" | "warning" }> = {
  ok: { label: "OK", variant: "success" },
  email_malformado: { label: "E-mail inválido", variant: "danger" },
  dominio_invalido: { label: "Domínio inválido", variant: "danger" },
  turma_inexistente: { label: "Turma não existe", variant: "warning" },
  casa_inexistente: { label: "Casa não existe", variant: "warning" },
  email_duplicado_planilha: { label: "Duplicado na planilha", variant: "danger" },
  email_ja_existe_banco: { label: "Já cadastrado", variant: "warning" },
};

export default function AdminImportarPage() {
  const [linhas, setLinhas] = useState<LinhaValidada[] | null>(null);
  const [carregando, setCarregando] = useState(false);
  const [duplicados, setDuplicados] = useState<"atualizar" | "pular">("atualizar");
  const [turmaCasaInexistente, setTurmaCasaInexistente] = useState<"criar" | "rejeitar">("criar");
  const [resumo, setResumo] = useState<{ criados: number; atualizados: number; falharam: number } | null>(null);

  async function enviarArquivo(e: React.ChangeEvent<HTMLInputElement>) {
    const arquivo = e.target.files?.[0];
    if (!arquivo) return;
    setCarregando(true);
    setResumo(null);
    const formData = new FormData();
    formData.append("arquivo", arquivo);
    const res = await fetch("/api/import", { method: "POST", body: formData });
    const json = await res.json();
    if (res.ok) setLinhas(json.linhas);
    setCarregando(false);
  }

  async function confirmar() {
    if (!linhas) return;
    setCarregando(true);
    const res = await fetch("/api/import/confirmar", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        // anoLetivoId e resolvido no backend a partir do ano ativo em getAnoLetivoAtivo;
        // aqui mandamos vazio de proposito e o backend usaria o ativo - em uma versao
        // futura, buscar o id explicitamente via /api/dashboard/rankings.
        anoLetivoId: (await (await fetch("/api/dashboard/rankings")).json()).anoLetivo.id,
        duplicados,
        turmaCasaInexistente,
        linhas,
      }),
    });
    const json = await res.json();
    if (res.ok) setResumo(json);
    setCarregando(false);
  }

  return (
    <div className="space-y-4">
      <h1 className="font-display text-lg font-semibold">Importar planilha</h1>
      <AvisoDesktop>Esta tela funciona melhor em um computador — em telas pequenas, a tabela fica apertada.</AvisoDesktop>

      <Card>
        <p className="mb-2 text-sm font-medium">Arquivo (.csv ou .xlsx)</p>
        <p className="mb-3 text-xs text-neutral-500">Colunas esperadas: nome, email, turma, casa.</p>
        <input type="file" accept=".csv,.xlsx" onChange={enviarArquivo} className="text-sm" />
      </Card>

      {carregando && <p className="text-center text-sm text-neutral-400">Processando…</p>}

      {linhas && !resumo && (
        <>
          <Card>
            <p className="mb-2 text-sm font-semibold">Duplicados já cadastrados</p>
            <div className="flex gap-2">
              <button
                onClick={() => setDuplicados("atualizar")}
                className={`rounded-full border px-3 py-1.5 text-xs ${duplicados === "atualizar" ? "border-gold bg-gold/10 text-gold-dark" : "border-neutral-200"}`}
              >
                Atualizar dados
              </button>
              <button
                onClick={() => setDuplicados("pular")}
                className={`rounded-full border px-3 py-1.5 text-xs ${duplicados === "pular" ? "border-gold bg-gold/10 text-gold-dark" : "border-neutral-200"}`}
              >
                Pular
              </button>
            </div>
          </Card>
          <Card>
            <p className="mb-2 text-sm font-semibold">Turma/Casa inexistente</p>
            <div className="flex gap-2">
              <button
                onClick={() => setTurmaCasaInexistente("criar")}
                className={`rounded-full border px-3 py-1.5 text-xs ${turmaCasaInexistente === "criar" ? "border-gold bg-gold/10 text-gold-dark" : "border-neutral-200"}`}
              >
                Criar automaticamente
              </button>
              <button
                onClick={() => setTurmaCasaInexistente("rejeitar")}
                className={`rounded-full border px-3 py-1.5 text-xs ${turmaCasaInexistente === "rejeitar" ? "border-gold bg-gold/10 text-gold-dark" : "border-neutral-200"}`}
              >
                Rejeitar linha
              </button>
            </div>
          </Card>

          <div className="overflow-x-auto rounded-xl2 border border-neutral-200 dark:border-neutral-800">
            <table className="w-full text-xs">
              <thead className="bg-neutral-50 dark:bg-graphite-soft">
                <tr>
                  <th className="p-2 text-left">Linha</th>
                  <th className="p-2 text-left">Nome</th>
                  <th className="p-2 text-left">E-mail</th>
                  <th className="p-2 text-left">Turma</th>
                  <th className="p-2 text-left">Casa</th>
                  <th className="p-2 text-left">Status</th>
                </tr>
              </thead>
              <tbody>
                {linhas.map((l) => (
                  <tr key={l.linha} className="border-t border-neutral-100 dark:border-neutral-800">
                    <td className="p-2">{l.linha}</td>
                    <td className="p-2">{l.nome}</td>
                    <td className="p-2">{l.email}</td>
                    <td className="p-2">{l.turma}</td>
                    <td className="p-2">{l.casa}</td>
                    <td className="p-2">
                      <Badge variant={STATUS_LABEL[l.status]?.variant ?? "default"}>{STATUS_LABEL[l.status]?.label ?? l.status}</Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <Button className="w-full" onClick={confirmar} disabled={carregando}>
            Confirmar importação
          </Button>
        </>
      )}

      {resumo && (
        <Card>
          <p className="text-sm font-semibold">Importação concluída</p>
          <ul className="mt-2 space-y-1 text-sm">
            <li>✅ {resumo.criados} criados</li>
            <li>🔄 {resumo.atualizados} atualizados</li>
            <li>❌ {resumo.falharam} falharam</li>
          </ul>
        </Card>
      )}
    </div>
  );
}
