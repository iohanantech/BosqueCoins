import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/options";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

/**
 * O JWT guarda uma copia de papel/ativo tirada no momento do login, e a
 * sessao dura ate 30 dias (padrao do NextAuth) - sem reconferir aqui contra o
 * banco, desativar ou rebaixar alguem (ex.: "Remover administrador" em
 * /admin/administradores) so faria efeito no proximo login dessa pessoa, nao
 * imediatamente. Uma consulta a mais por requisicao e barata no volume de
 * uma escola, e e o unico jeito de "remover acesso" significar isso de fato.
 */
export async function requireSession() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    throw new ApiError(401, "Nao autenticado.");
  }

  const usuarioAtual = await prisma.usuario.findUnique({
    where: { id: session.user.id },
    select: { ativo: true, papel: true },
  });
  if (!usuarioAtual || !usuarioAtual.ativo) {
    throw new ApiError(401, "Sua conta foi desativada. Faca login novamente.");
  }

  // Reflete o papel ATUAL do banco (nao o congelado no token) no resto da
  // requisicao, para o caso de ter sido alterado desde o login.
  session.user.papel = usuarioAtual.papel;
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
 * env var, nunca pelo papel. SEM fallback embutido no codigo: um ambiente
 * sem essa variavel deve falhar de forma visivel, nao escolher em silencio
 * quem manda.
 */
export function ehSuperAdmin(session: { user: { email?: string | null } }) {
  const superAdminEmail = process.env.SUPER_ADMIN_EMAIL?.toLowerCase().trim();
  if (!superAdminEmail) return false;
  return session.user.email?.toLowerCase() === superAdminEmail;
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
