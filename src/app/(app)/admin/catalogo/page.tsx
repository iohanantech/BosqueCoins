"use client";

import { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input, Textarea } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";

interface ItemCatalogo {
  id: string;
  nome: string;
  descricao: string;
  custo: number;
  icone: string | null;
  categoria: string;
  escopo: "turma" | "individual" | "ambos";
  quantidadeDisponivel: number | null;
  ativo: boolean;
}

const ESCOPOS = [
  { value: "individual", label: "Individual" },
  { value: "turma", label: "Turma" },
  { value: "ambos", label: "Ambos" },
] as const;

export default function AdminCatalogoPage() {
  const [itens, setItens] = useState<ItemCatalogo[]>([]);
  const [form, setForm] = useState({
    nome: "",
    descricao: "",
    custo: "",
    icone: "",
    categoria: "",
    escopo: "individual" as "turma" | "individual" | "ambos",
    quantidadeDisponivel: "",
  });
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  function carregar() {
    fetch("/api/catalog")
      .then((r) => r.json())
      .then(setItens);
  }

  useEffect(carregar, []);

  async function criar() {
    setErro(null);
    setSalvando(true);
    try {
      const res = await fetch("/api/catalog", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nome: form.nome,
          descricao: form.descricao,
          custo: Number(form.custo),
          icone: form.icone || null,
          categoria: form.categoria,
          escopo: form.escopo,
          quantidadeDisponivel: form.quantidadeDisponivel ? Number(form.quantidadeDisponivel) : null,
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        setErro(json.erro ?? "Não foi possível criar o item.");
        return;
      }
      setForm({ nome: "", descricao: "", custo: "", icone: "", categoria: "", escopo: "individual", quantidadeDisponivel: "" });
      carregar();
    } finally {
      setSalvando(false);
    }
  }

  async function alternarAtivo(item: ItemCatalogo) {
    await fetch(`/api/catalog/${item.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ativo: !item.ativo }),
    });
    carregar();
  }

  return (
    <div className="space-y-4">
      <h1 className="font-display text-lg font-semibold">Catálogo</h1>

      <Card>
        <p className="mb-3 text-sm font-semibold">Novo item</p>
        <div className="space-y-2">
          <Input placeholder="Nome" value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} />
          <Textarea placeholder="Descrição" value={form.descricao} onChange={(e) => setForm({ ...form, descricao: e.target.value })} rows={2} />
          <div className="grid grid-cols-2 gap-2">
            <Input inputMode="numeric" placeholder="Custo" value={form.custo} onChange={(e) => setForm({ ...form, custo: e.target.value.replace(/\D/g, "") })} />
            <Input placeholder="Categoria" value={form.categoria} onChange={(e) => setForm({ ...form, categoria: e.target.value })} />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <Input placeholder="Ícone/emoji (opcional)" value={form.icone} onChange={(e) => setForm({ ...form, icone: e.target.value })} />
            <Input
              inputMode="numeric"
              placeholder="Estoque (vazio = ilimitado)"
              value={form.quantidadeDisponivel}
              onChange={(e) => setForm({ ...form, quantidadeDisponivel: e.target.value.replace(/\D/g, "") })}
            />
          </div>
          <div className="flex gap-2">
            {ESCOPOS.map((e) => (
              <button
                key={e.value}
                onClick={() => setForm({ ...form, escopo: e.value })}
                className={`rounded-full border px-3 py-1.5 text-xs font-medium ${
                  form.escopo === e.value ? "border-gold bg-gold/10 text-gold-dark" : "border-neutral-200 dark:border-neutral-700"
                }`}
              >
                {e.label}
              </button>
            ))}
          </div>
          {erro && <p className="text-xs text-red-600">{erro}</p>}
          <Button className="w-full" disabled={salvando || !form.nome || !form.custo || !form.categoria} onClick={criar}>
            {salvando ? "Salvando…" : "Criar item"}
          </Button>
          {/* Imagens: campo de URL externa, sem upload de arquivo (secao 7) */}
          <p className="text-[11px] text-neutral-400">
            Sem upload de imagem por ora (custo zero) - use um ícone/emoji, ou adicione imagemUrl via API com um link externo.
          </p>
        </div>
      </Card>

      <div className="space-y-2">
        {itens.map((item) => (
          <Card key={item.id} className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span className="text-2xl">{item.icone ?? "🎁"}</span>
              <div>
                <p className="text-sm font-medium">{item.nome}</p>
                <p className="text-xs text-neutral-500">
                  {item.custo} BC · {item.escopo} · {item.categoria}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant={item.ativo ? "success" : "danger"}>{item.ativo ? "Ativo" : "Inativo"}</Badge>
              <Button size="sm" variant="outline" onClick={() => alternarAtivo(item)}>
                {item.ativo ? "Desativar" : "Ativar"}
              </Button>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
