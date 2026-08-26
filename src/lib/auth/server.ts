import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/options";
import { NextResponse } from "next/server";

export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

export async function requireSession() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    throw new ApiError(401, "Nao autenticado.");
  }
  return session;
}

/** Garante que o usuario logado tem um dos papeis informados (403 caso contrario). */
export async function requirePapel(...papeis: Array<"admin" | "professor" | "aluno">) {
  const session = await requireSession();
  if (!papeis.includes(session.user.papel)) {
    throw new ApiError(403, "Voce nao tem permissao para esta acao.");
  }
  return session;
}

/**
 * Cadastrar/remover administradores e um poder reservado a UMA unica conta
 * (o coordenador responsavel), nao a qualquer admin - definido por e-mail via
 * env var (com fallback pra quem pediu essa restricao), nunca pelo papel.
 */
const SUPER_ADMIN_EMAIL = (process.env.SUPER_ADMIN_EMAIL ?? "iohanan.carvalho@bosquemananciais.org.br").toLowerCase();

export function ehSuperAdmin(session: { user: { email?: string | null } }) {
  return session.user.email?.toLowerCase() === SUPER_ADMIN_EMAIL;
}

/** Garante que o usuario logado E o super admin (unico com poder de gerenciar outros admins). */
export async function requireSuperAdmin() {
  const session = await requirePapel("admin");
  if (!ehSuperAdmin(session)) {
    throw new ApiError(403, "So o administrador responsavel pode cadastrar ou remover outros administradores.");
  }
  return session;
}

/**
 * RN-08 — Privacidade do aluno: garante que o usuario so acessa os proprios
 * dados quando o recurso pertence a um aluno. Admin sempre pode.
 * Usar em toda rota que recebe um alunoId por parametro/payload.
 */
export function garantirAcessoProprioOuAdmin(session: { user: { id: string; papel: string } }, alunoId: string) {
  if (session.user.papel === "admin") return;
  if (session.user.id !== alunoId) {
    throw new ApiError(403, "Voce so pode acessar os proprios dados.");
  }
}

/** Traduz ApiError em uma resposta JSON consistente; outros erros viram 500 generico. */
export function handleApiError(error: unknown) {
  if (error instanceof ApiError) {
    return NextResponse.json({ erro: error.message }, { status: error.status });
  }
  console.error(error);
  return NextResponse.json({ erro: "Erro interno do servidor." }, { status: 500 });
}
