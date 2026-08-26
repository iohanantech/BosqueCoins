import { PrismaClient } from "@prisma/client";

// Singleton do Prisma Client, seguindo o padrao recomendado para Next.js
// (evita esgotar o pool de conexoes com hot-reload em dev).
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
  });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
