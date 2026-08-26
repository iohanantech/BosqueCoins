"use client";

import { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";

interface Casa {
  id: string;
  nome: string;
  corPrimariaHex: string;
  corSecundariaHex: string;
  ativo: boolean;
}

const CASA_VAZIA = { nome: "", corPrimariaHex: "#D4AF37", corSecundariaHex: "#1C1C1E" };

/**
 * Cadastro das Casas (secao 1) - o admin pode criar novas e editar as
 * existentes (nome, cores, ativo/inativo). Nao escopado por ano letivo -
 * o aluno permanece na mesma Casa entre anos, so a pontuacao zera.
 */
export default function AdminCasasPage() {
  const [casas, setCasas] = useState<Casa[]>([]);
  const [formNova, setFormNova] = useState(CASA_VAZIA);
  const [salvando, setSalvando] = useState(false);
  const [erroNova, setErroNova] = useState<string | null>(null);

  const [editandoId, setEditandoId] = useState<string | null>(null);
  const [formEdicao, setFormEdicao] = useState(CASA_VAZIA);
  const [erroEdicao, setErroEdicao] = useState<string | null>(null);

  function carregar() {
    fetch("/api/casas")
      .then((r) => r.json())
      .then(setCasas);
  }

  useEffect(carregar, []);

  async function criar() {
    setErroNova(null);
    setSalvando(true);
    try {
      const res = await fetch("/api/casas", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formNova),
      });
      const json = await res.json();
      if (!res.ok) {
        setErroNova(json.erro ?? "Não foi possível criar a Casa.");
        return;
      }
      setFormNova(CASA_VAZIA);
      carregar();
    } finally {
      setSalvando(false);
    }
  }

  function iniciarEdicao(casa: Casa) {
    setEditandoId(casa.id);
    setFormEdicao({ nome: casa.nome, corPrimariaHex: casa.corPrimariaHex, corSecundariaHex: casa.corSecundariaHex });
    setErroEdicao(null);
  }

  async function salvarEdicao(id: string) {
    setErroEdicao(null);
    setSalvando(true);
    try {
      const res = await fetch(`/api/casas/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formEdicao),
      });
      const json = await res.json();
      if (!res.ok) {
        setErroEdicao(json.erro ?? "Não foi possível salvar.");
        return;
      }
      setEditandoId(null);
      carregar();
    } finally {
      setSalvando(false);
    }
  }

  async function alternarAtivo(casa: Casa) {
    await fetch(`/api/casas/${casa.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ativo: !casa.ativo }),
    });
    carregar();
  }

  return (
    <div className="space-y-4">
      <h1 className="font-display text-lg font-semibold">Casas</h1>
      <p className="text-xs text-neutral-500 dark:text-neutral-400">
        O aluno permanece na mesma Casa entre anos letivos — só a pontuação zera.
      </p>

      <Card>
        <p className="mb-3 text-sm font-semibold">Nova Casa</p>
        <div className="space-y-2">
          <Input placeholder="Nome" value={formNova.nome} onChange={(e) => setFormNova({ ...formNova, nome: e.target.value })} />
          <div className="grid grid-cols-2 gap-3">
            <label className="flex items-center gap-2 text-xs text-neutral-500">
              Cor primária
              <input
                type="color"
                value={formNova.corPrimariaHex}
                onChange={(e) => setFormNova({ ...formNova, corPrimariaHex: e.target.value })}
                className="h-8 w-12 cursor-pointer rounded border border-neutral-200 dark:border-neutral-700"
              />
            </label>
            <label className="flex items-center gap-2 text-xs text-neutral-500">
              Cor secundária
              <input
                type="color"
                value={formNova.corSecundariaHex}
                onChange={(e) => setFormNova({ ...formNova, corSecundariaHex: e.target.value })}
                className="h-8 w-12 cursor-pointer rounded border border-neutral-200 dark:border-neutral-700"
              />
            </label>
          </div>
          {erroNova && <p className="text-xs text-red-600">{erroNova}</p>}
          <Button className="w-full" disabled={salvando || !formNova.nome} onClick={criar}>
            {salvando ? "Salvando…" : "Criar Casa"}
          </Button>
        </div>
      </Card>

      <div className="grid grid-cols-2 gap-3">
        {casas.map((c) =>
          editandoId === c.id ? (
            <Card key={c.id} className="col-span-2">
              <div className="space-y-2">
                <Input placeholder="Nome" value={formEdicao.nome} onChange={(e) => setFormEdicao({ ...formEdicao, nome: e.target.value })} />
                <div className="grid grid-cols-2 gap-3">
                  <label className="flex items-center gap-2 text-xs text-neutral-500">
                    Cor primária
                    <input
                      type="color"
                      value={formEdicao.corPrimariaHex}
                      onChange={(e) => setFormEdicao({ ...formEdicao, corPrimariaHex: e.target.value })}
                      className="h-8 w-12 cursor-pointer rounded border border-neutral-200 dark:border-neutral-700"
                    />
                  </label>
                  <label className="flex items-center gap-2 text-xs text-neutral-500">
                    Cor secundária
                    <input
                      type="color"
                      value={formEdicao.corSecundariaHex}
                      onChange={(e) => setFormEdicao({ ...formEdicao, corSecundariaHex: e.target.value })}
                      className="h-8 w-12 cursor-pointer rounded border border-neutral-200 dark:border-neutral-700"
                    />
                  </label>
                </div>
                {erroEdicao && <p className="text-xs text-red-600">{erroEdicao}</p>}
                <div className="flex gap-2">
                  <Button size="sm" disabled={salvando || !formEdicao.nome} onClick={() => salvarEdicao(c.id)}>
                    {salvando ? "Salvando…" : "Salvar"}
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => setEditandoId(null)}>
                    Cancelar
                  </Button>
                </div>
              </div>
            </Card>
          ) : (
            <Card key={c.id} style={{ borderTop: `4px solid ${c.corPrimariaHex}` }}>
              <div className="mb-2 flex items-center justify-between">
                <div className="flex gap-1.5">
                  <span className="h-5 w-5 rounded-full" style={{ backgroundColor: c.corPrimariaHex }} />
                  <span className="h-5 w-5 rounded-full" style={{ backgroundColor: c.corSecundariaHex }} />
                </div>
                <Badge variant={c.ativo ? "success" : "danger"}>{c.ativo ? "Ativa" : "Inativa"}</Badge>
              </div>
              <p className="mb-2 text-sm font-semibold">{c.nome}</p>
              <div className="flex gap-2">
                <Button size="sm" variant="outline" onClick={() => iniciarEdicao(c)}>
                  Editar
                </Button>
                <Button size="sm" variant="outline" onClick={() => alternarAtivo(c)}>
                  {c.ativo ? "Desativar" : "Ativar"}
                </Button>
              </div>
            </Card>
          )
        )}
      </div>
    </div>
  );
}
