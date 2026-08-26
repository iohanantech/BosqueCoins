"use client";

import { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";

interface Admin {
  id: string;
  nome: string;
  email: string;
  ativo: boolean;
}

export default function AdminAdministradoresPage() {
  const [admins, setAdmins] = useState<Admin[]>([]);
  const [souSuperAdmin, setSouSuperAdmin] = useState(false);
  const [nome, setNome] = useState("");
  const [email, setEmail] = useState("");
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  function carregar() {
    fetch("/api/admin/administradores")
      .then((r) => (r.ok ? r.json() : { souSuperAdmin: false, administradores: [] }))
      .then((json) => {
        setAdmins(json.administradores ?? []);
        setSouSuperAdmin(!!json.souSuperAdmin);
      })
      .catch(() => {
        setAdmins([]);
        setSouSuperAdmin(false);
      });
  }

  useEffect(carregar, []);

  async function criar() {
    setErro(null);
    setSalvando(true);
    try {
      const res = await fetch("/api/admin/administradores", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nome, email }),
      });
      const json = await res.json();
      if (!res.ok) {
        setErro(json.erro ?? "Não foi possível cadastrar o administrador.");
        return;
      }
      setNome("");
      setEmail("");
      carregar();
    } finally {
      setSalvando(false);
    }
  }

  async function alternarAtivo(admin: Admin) {
    setErro(null);
    const res = await fetch(`/api/admin/administradores/${admin.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ativo: !admin.ativo }),
    });
    if (!res.ok) {
      const json = await res.json();
      setErro(json.erro ?? "Não foi possível atualizar o administrador.");
      return;
    }
    carregar();
  }

  return (
    <div className="space-y-4">
      <h1 className="font-display text-lg font-semibold">Administradores</h1>

      {souSuperAdmin ? (
        <Card className="space-y-2">
          <p className="text-sm font-semibold">Novo administrador</p>
          <Input placeholder="Nome" value={nome} onChange={(e) => setNome(e.target.value)} />
          <Input placeholder="E-mail institucional" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
          {erro && <p className="text-xs text-red-600">{erro}</p>}
          <Button className="w-full" disabled={salvando || !nome || !email} onClick={criar}>
            {salvando ? "Salvando…" : "Cadastrar administrador"}
          </Button>
        </Card>
      ) : (
        <p className="text-xs text-neutral-500 dark:text-neutral-400">
          Só o administrador responsável pode cadastrar ou remover outros administradores.
        </p>
      )}

      {!souSuperAdmin && erro && <p className="text-xs text-red-600">{erro}</p>}

      <div className="space-y-2">
        {admins.map((a) => (
          <Card key={a.id} className="flex items-center justify-between">
            <div>
              <p className="text-sm font-semibold">{a.nome}</p>
              <p className="text-xs text-neutral-500 dark:text-neutral-400">{a.email}</p>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant={a.ativo ? "success" : "danger"}>{a.ativo ? "Ativo" : "Removido"}</Badge>
              {souSuperAdmin && (
                <Button size="sm" variant="outline" onClick={() => alternarAtivo(a)}>
                  {a.ativo ? "Remover" : "Restaurar"}
                </Button>
              )}
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
