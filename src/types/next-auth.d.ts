import type { DefaultSession } from "next-auth";

// Estende os tipos do NextAuth para incluir id interno e papel do usuario
// (usados em toda a autorizacao por papel - middleware e API routes).
declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      papel: "admin" | "professor" | "aluno";
    } & DefaultSession["user"];
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    usuarioId?: string;
    papel?: "admin" | "professor" | "aluno";
    nome?: string;
  }
}
