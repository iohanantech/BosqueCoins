import type { NextAuthOptions } from "next-auth";
import GoogleProvider from "next-auth/providers/google";
import CredentialsProvider from "next-auth/providers/credentials";
import { prisma } from "@/lib/db";
import { ALLOWED_EMAIL_DOMAIN, emailDominioPermitido } from "@/lib/auth/dominioEmail";

/**
 * O provider de dev existe SÓ para permitir testar os 4 papéis sem depender
 * das credenciais reais do Google OAuth (que só o time do colégio possui).
 * NUNCA deve ir para produção: exige NODE_ENV !== 'production' *e* a env var
 * explícita DEV_AUTH_ENABLED=true (nenhuma das duas sozinha basta). Ver README.
 */
export const DEV_AUTH_ENABLED =
  process.env.NODE_ENV !== "production" && process.env.DEV_AUTH_ENABLED === "true";

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
      // (secao 3). A validacao real acontece no callback signIn abaixo. So faz
      // sentido quando ha um dominio institucional configurado; sem ele, o
      // usuario escolhe qualquer conta Google dele (inclusive Gmail).
      authorization: {
        params: {
          ...(ALLOWED_EMAIL_DOMAIN ? { hd: ALLOWED_EMAIL_DOMAIN } : {}),
          prompt: "select_account",
        },
      },
    }),
    ...(DEV_AUTH_ENABLED
      ? [
          CredentialsProvider({
            id: "dev",
            name: "Dev (sem Google)",
            credentials: { email: { label: "E-mail", type: "text" } },
            // So resolve um `usuarios` ja existente - passa pelas MESMAS checagens
            // de dominio/cadastro/ativo do callback signIn abaixo. Nao cria conta,
            // nao aceita senha: nao e um atalho para RN-08/RN-09/RN-12, so evita
            // depender do Google para obter uma sessao valida.
            async authorize(credentials) {
              const email = credentials?.email?.toLowerCase().trim();
              if (!email) return null;
              const usuario = await prisma.usuario.findUnique({ where: { email } });
              if (!usuario || !usuario.ativo) return null;
              return { id: usuario.id, email: usuario.email, name: usuario.nome };
            },
          }),
        ]
      : []),
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
     * Acesso por PRE-CADASTRO: o e-mail precisa ja existir em `usuarios`
     * (cadastrado pelo admin manualmente ou via planilha) e estar ativo -
     * nao criamos conta automaticamente no primeiro login. Esse e o porteiro
     * de verdade.
     * RN-10 (restricao de dominio) e opcional: so barra quando
     * ALLOWED_EMAIL_DOMAIN esta definido. Sem ele, qualquer dominio (Gmail
     * etc.) entra, desde que pre-cadastrado.
     */
    async signIn({ user, account }) {
      const email = user.email?.toLowerCase().trim();
      if (!email) return `/login?error=${AUTH_ERROR_CODES.CONTA_NAO_CADASTRADA}`;

      if (!emailDominioPermitido(email)) {
        return `/login?error=${AUTH_ERROR_CODES.DOMINIO_INVALIDO}`;
      }

      const usuarioExistente = await prisma.usuario.findUnique({ where: { email } });

      if (!usuarioExistente) {
        return `/login?error=${AUTH_ERROR_CODES.CONTA_NAO_CADASTRADA}`;
      }

      if (!usuarioExistente.ativo) {
        return `/login?error=${AUTH_ERROR_CODES.CONTA_INATIVA}`;
      }

      // No primeiro login bem-sucedido via Google, grava o google_id no registro existente.
      if (account?.provider === "google" && !usuarioExistente.googleId && account.providerAccountId) {
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
