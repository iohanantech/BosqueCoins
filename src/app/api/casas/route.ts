import { NextResponse } from "next/server";
import { requireSession, handleApiError } from "@/lib/auth/server";
import { prisma } from "@/lib/db";

/** GET /api/casas — lista das 4 Casas oficiais (cadastro fixo, secao 1). */
export async function GET() {
  try {
    await requireSession();
    const casas = await prisma.casa.findMany({ orderBy: { nome: "asc" } });
    return NextResponse.json(casas);
  } catch (error) {
    return handleApiError(error);
  }
}
