import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { DEV_AUTH_ENABLED } from "@/lib/auth/options";

/**
 * GET /api/dev/usuarios — lista usuarios ativos para o seletor de login de
 * desenvolvimento (Fase 2 do CONTINUACAO.md). So responde quando o provider
 * de dev esta habilitado; em producao (ou sem DEV_AUTH_ENABLED=true) retorna 404.
 */
export async function GET() {
  if (!DEV_AUTH_ENABLED) {
    return NextResponse.json({ erro: "Nao encontrado." }, { status: 404 });
  }

  const usuarios = await prisma.usuario.findMany({
    where: { ativo: true },
    select: { id: true, nome: true, email: true, papel: true },
    orderBy: [{ papel: "asc" }, { nome: "asc" }],
  });

  return NextResponse.json({ usuarios });
}
