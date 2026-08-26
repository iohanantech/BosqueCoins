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

const FORM_VAZIO = {
  nome: "",
  descricao: "",
  custo: "",
  icone: "",
  categoria: "",
  escopo: "individual" as "turma" | "individual" | "ambos",
  quantidadeDisponivel: "",
};

export default function AdminCatalogoPage() {
  const [itens, setItens] = useState<ItemCatalogo[]>([]);
  const [form, setForm] = useState(FORM_VAZIO);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const [editandoId, setEditandoId] = useState<string | null>(null);
  const [formEdicao, setFormEdicao] = useState(FORM_VAZIO);
  const [erroEdicao, setErroEdicao] = useState<string | null>(null);
  const [erroExclusao, setErroExclusao] = useState<string | null>(null);

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
      setForm(FORM_VAZIO);
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

  function iniciarEdicao(item: ItemCatalogo) {
    setEditandoId(item.id);
    setErroEdicao(null);
    setFormEdicao({
      nome: item.nome,
      descricao: item.descricao,
      custo: String(item.custo),
      icone: item.icone ?? "",
      categoria: item.categoria,
      escopo: item.escopo,
      quantidadeDisponivel: item.quantidadeDisponivel != null ? String(item.quantidadeDisponivel) : "",
    });
  }

  async function salvarEdicao(id: string) {
    setErroEdicao(null);
    setSalvando(true);
    try {
      const res = await fetch(`/api/catalog/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nome: formEdicao.nome,
          descricao: formEdicao.descricao,
          custo: Number(formEdicao.custo),
          icone: formEdicao.icone || null,
          categoria: formEdicao.categoria,
          escopo: formEdicao.escopo,
          quantidadeDisponivel: formEdicao.quantidadeDisponivel ? Number(formEdicao.quantidadeDisponivel) : null,
        }),
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

  async function excluir(item: ItemCatalogo) {
    setErroExclusao(null);
    if (!confirm(`Excluir "${item.nome}" do catálogo? Essa ação não pode ser desfeita.`)) return;
    const res = await fetch(`/api/catalog/${item.id}`, { method: "DELETE" });
    if (!res.ok) {
      const json = await res.json();
      setErroExclusao(json.erro ?? "Não foi possível excluir o item.");
      return;
    }
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

      {erroExclusao && <p className="text-xs text-red-600">{erroExclusao}</p>}

      <div className="space-y-2">
        {itens.map((item) =>
          editandoId === item.id ? (
            <Card key={item.id}>
              <div className="space-y-2">
                <Input placeholder="Nome" value={formEdicao.nome} onChange={(e) => setFormEdicao({ ...formEdicao, nome: e.target.value })} />
                <Textarea
                  placeholder="Descrição"
                  value={formEdicao.descricao}
                  onChange={(e) => setFormEdicao({ ...formEdicao, descricao: e.target.value })}
                  rows={2}
                />
                <div className="grid grid-cols-2 gap-2">
                  <Input
                    inputMode="numeric"
                    placeholder="Custo"
                    value={formEdicao.custo}
                    onChange={(e) => setFormEdicao({ ...formEdicao, custo: e.target.value.replace(/\D/g, "") })}
                  />
                  <Input placeholder="Categoria" value={formEdicao.categoria} onChange={(e) => setFormEdicao({ ...formEdicao, categoria: e.target.value })} />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <Input placeholder="Ícone/emoji (opcional)" value={formEdicao.icone} onChange={(e) => setFormEdicao({ ...formEdicao, icone: e.target.value })} />
                  <Input
                    inputMode="numeric"
                    placeholder="Estoque (vazio = ilimitado)"
                    value={formEdicao.quantidadeDisponivel}
                    onChange={(e) => setFormEdicao({ ...formEdicao, quantidadeDisponivel: e.target.value.replace(/\D/g, "") })}
                  />
                </div>
                <div className="flex gap-2">
                  {ESCOPOS.map((e) => (
                    <button
                      key={e.value}
                      onClick={() => setFormEdicao({ ...formEdicao, escopo: e.value })}
                      className={`rounded-full border px-3 py-1.5 text-xs font-medium ${
                        formEdicao.escopo === e.value ? "border-gold bg-gold/10 text-gold-dark" : "border-neutral-200 dark:border-neutral-700"
                      }`}
                    >
                      {e.label}
                    </button>
                  ))}
                </div>
                {erroEdicao && <p className="text-xs text-red-600">{erroEdicao}</p>}
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    disabled={salvando || !formEdicao.nome || !formEdicao.custo || !formEdicao.categoria}
                    onClick={() => salvarEdicao(item.id)}
                  >
                    {salvando ? "Salvando…" : "Salvar"}
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => setEditandoId(null)}>
                    Cancelar
                  </Button>
                </div>
              </div>
            </Card>
          ) : (
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
                <Button size="sm" variant="outline" onClick={() => iniciarEdicao(item)}>
                  Editar
                </Button>
                <Button size="sm" variant="outline" onClick={() => alternarAtivo(item)}>
                  {item.ativo ? "Desativar" : "Ativar"}
                </Button>
                <Button size="sm" variant="outline" onClick={() => excluir(item)}>
                  Excluir
                </Button>
              </div>
            </Card>
          )
        )}
      </div>
    </div>
  );
}
