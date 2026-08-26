"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, Coins, Receipt, Gift, User, ShieldCheck, ClipboardList, TrendingUp } from "lucide-react";
import { cn } from "@/lib/utils";

interface NavItem {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}

/**
 * Bottom tab bar (secao 9) - navegacao principal em mobile, nao menu lateral.
 * Itens variam por papel: aluno ve Início/Investir/Extrato/Prêmios/Perfil
 * (secao 4.1, INVESTIMENTOS.md); professor/PEC ganham o atalho "Pontuar";
 * admin ganha "Admin".
 */
export function BottomNav({ papel }: { papel: "admin" | "professor" | "aluno" }) {
  const pathname = usePathname();

  const itensBase: NavItem[] = [{ href: "/dashboard", label: "Início", icon: Home }];

  const itensPapel: NavItem[] =
    papel === "aluno"
      ? [
          { href: "/investir", label: "Investir", icon: TrendingUp },
          { href: "/extrato", label: "Extrato", icon: Receipt },
          { href: "/premios", label: "Prêmios", icon: Gift },
        ]
      : [
          { href: "/pontuar", label: "Pontuar", icon: Coins },
          { href: "/extrato", label: "Extrato", icon: Receipt },
          { href: "/pec", label: "PEC", icon: ClipboardList },
        ];

  const itensFinais: NavItem[] =
    papel === "admin"
      ? [...itensBase, ...itensPapel, { href: "/admin", label: "Admin", icon: ShieldCheck }]
      : [...itensBase, ...itensPapel, { href: "/perfil", label: "Perfil", icon: User }];

  return (
    <nav className="safe-bottom fixed inset-x-0 bottom-0 z-40 border-t border-neutral-200 bg-white/95 backdrop-blur dark:border-neutral-800 dark:bg-graphite/95">
      <ul className="mx-auto flex max-w-lg items-stretch justify-around">
        {itensFinais.map((item) => {
          const ativo = pathname === item.href || pathname.startsWith(item.href + "/");
          const Icon = item.icon;
          return (
            <li key={item.href} className="flex-1">
              <Link
                href={item.href}
                className={cn(
                  "flex flex-col items-center justify-center gap-0.5 py-2 text-[11px] font-medium",
                  ativo ? "text-gold-dark dark:text-gold-light" : "text-neutral-500 dark:text-neutral-400"
                )}
              >
                <Icon className="h-5 w-5" />
                {item.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
