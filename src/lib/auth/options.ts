import type { NextAuthOptions } from "next-auth";
import GoogleProvider from "next-auth/providers/google";
import { prisma } from "@/lib/db";

const ALLOWED_DOMAIN = process.env.ALLOWED_EMAIL_DOMAIN ?? "bosquemananciais.org.br";

/**
 * Erros de login usados para mostrar mensagens claras na tela de login
 * (ver src/app/(auth)/login). O NextAuth so permite propagar uma string
 * curta via query param `error`, entao usamos codigos e traduzimos na UI.
 */
export const AUTH_ERROR_CODES = {
  DOMINIO_INVALIDO: "DominioInvalido",
  CONTA_NAO_CADASTRADA: "ContaNaoCadastrada",
  CONTA_INATIVA: "ContaInativa",
} as const;

export const authOptions: NextAuthOptions = {
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID ?? "",
      clientSecret: process.env.GOOGLE_CLIENT_SECRET ?? "",
      // 'hd' e so uma camada de UX do lado do Google - NUNCA a fonte da verdade
      // (secao 3). A validacao real acontece no callback signIn abaixo.
      authorization: {
        params: {
          hd: ALLOWED_DOMAIN,
          prompt: "select_account",
        },
      },
    }),
  ],
  session: {
    strategy: "jwt",
  },
  pages: {
    signIn: "/login",
    error: "/login",
  },
  callbacks: {
    /**
     * RN-10 — Dominio de e-mail: validado aqui no backend, nunca so no
     * parametro `hd` do lado do cliente.
     * Acesso por pre-cadastro: o e-mail precisa ja existir em `usuarios`
     * (cadastrado pelo admin manualmente ou via planilha) - nao criamos
     * conta automaticamente no primeiro login.
     */
    async signIn({ user, account }) {
      const email = user.email?.toLowerCase().trim();
      if (!email) return `/login?error=${AUTH_ERROR_CODES.CONTA_NAO_CADASTRADA}`;

      if (!email.endsWith(`@${ALLOWED_DOMAIN}`)) {
        return `/login?error=${AUTH_ERROR_CODES.DOMINIO_INVALIDO}`;
      }

      const usuarioExistente = await prisma.usuario.findUnique({ where: { email } });

      if (!usuarioExistente) {
        return `/login?error=${AUTH_ERROR_CODES.CONTA_NAO_CADASTRADA}`;
      }

      if (!usuarioExistente.ativo) {
        return `/login?error=${AUTH_ERROR_CODES.CONTA_INATIVA}`;
      }

      // No primeiro login bem-sucedido, grava o google_id no registro existente.
      if (!usuarioExistente.googleId && account?.providerAccountId) {
        await prisma.usuario.update({
          where: { id: usuarioExistente.id },
          data: { googleId: account.providerAccountId },
        });
      }

      return true;
    },

    async jwt({ token, user }) {
      // Ao logar, busca o registro completo (papel, id interno) e embute no token.
      if (user?.email) {
        const usuarioDb = await prisma.usuario.findUnique({ where: { email: user.email.toLowerCase() } });
        if (usuarioDb) {
          token.usuarioId = usuarioDb.id;
          token.papel = usuarioDb.papel;
          token.nome = usuarioDb.nome;
        }
      }
      return token;
    },

    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.usuarioId as string;
        session.user.papel = token.papel as "admin" | "professor" | "aluno";
        session.user.name = (token.nome as string) ?? session.user.name;
      }
      return session;
    },
  },
};
