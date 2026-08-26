import Link from "next/link";
import { Card } from "@/components/ui/card";
import { Users, Gift, Upload, CalendarClock, GraduationCap, Trophy, ClipboardCheck, Receipt } from "lucide-react";

const SECOES = [
  { href: "/admin/turmas", label: "Turmas", desc: "Gerenciar turmas e PECs", icon: GraduationCap },
  { href: "/admin/casas", label: "Casas", desc: "As 4 Casas oficiais", icon: Trophy },
  { href: "/admin/catalogo", label: "Catálogo", desc: "Itens de recompensa", icon: Gift },
  { href: "/admin/resgates", label: "Resgates", desc: "Aprovar ou recusar pedidos", icon: ClipboardCheck },
  { href: "/admin/professores", label: "Professores", desc: "Dar pontos a professores", icon: Users },
  { href: "/admin/extrato", label: "Extrato", desc: "Filtros avançados por data, Casa, tipo e ano", icon: Receipt },
  { href: "/admin/importar", label: "Importar planilha", desc: "Alunos em massa (.csv/.xlsx)", icon: Upload },
  { href: "/admin/ano-letivo", label: "Ano letivo", desc: "Encerrar ano e reatribuir turmas", icon: CalendarClock },
];

/** Desktop-friendly: a especificacao (secao 9) pede aviso em telas pequenas para importar/encerrar ano. */
export default function AdminHubPage() {
  return (
    <div className="space-y-4">
      <h1 className="font-display text-lg font-semibold">Administração</h1>
      <div className="grid grid-cols-2 gap-3">
        {SECOES.map((s) => {
          const Icon = s.icon;
          return (
            <Link key={s.href} href={s.href}>
              <Card className="h-full">
                <Icon className="mb-2 h-6 w-6 text-gold-dark" />
                <p className="text-sm font-semibold">{s.label}</p>
                <p className="text-xs text-neutral-500 dark:text-neutral-400">{s.desc}</p>
              </Card>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
