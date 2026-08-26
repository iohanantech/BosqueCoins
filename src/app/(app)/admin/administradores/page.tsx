"use client";

import { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

interface Admin {
  id: string;
  nome: string;
  email: string;
  ativo: boolean;
}

export default function AdminAdministradoresPage() {
  const [admins, setAdmins] = useState<Admin[]>([]);
  const [nome, setNome] = useState("");
  const [email, setEmail] = useState("");
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  function carregar() {
    fetch("/api/usuarios?papel=admin")
      .then((r) => (r.ok ? r.json() : []))
      .then(setAdmins)
      .catch(() => setAdmins([]));
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

  return (
    <div className="space-y-4">
      <h1 className="font-display text-lg font-semibold">Administradores</h1>

      <Card className="space-y-2">
        <p className="text-sm font-semibold">Novo administrador</p>
        <Input placeholder="Nome" value={nome} onChange={(e) => setNome(e.target.value)} />
        <Input placeholder="E-mail institucional" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
        {erro && <p className="text-xs text-red-600">{erro}</p>}
        <Button className="w-full" disabled={salvando || !nome || !email} onClick={criar}>
          {salvando ? "Salvando…" : "Cadastrar administrador"}
        </Button>
      </Card>

      <div className="space-y-2">
        {admins.map((a) => (
          <Card key={a.id} className="flex items-center justify-between">
            <div>
              <p className="text-sm font-semibold">{a.nome}</p>
              <p className="text-xs text-neutral-500 dark:text-neutral-400">{a.email}</p>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
