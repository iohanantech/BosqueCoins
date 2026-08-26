import { NextRequest, NextResponse } from "next/server";
import { requireSession, requirePapel, handleApiError, ApiError } from "@/lib/auth/server";
import { criarCasaSchema } from "@/lib/validation/schemas";
import { prisma } from "@/lib/db";

/** GET /api/casas — lista as Casas cadastradas (secao 1; admin pode criar novas, ver POST). */
export async function GET() {
  try {
    await requireSession();
    const casas = await prisma.casa.findMany({ orderBy: { nome: "asc" } });
    return NextResponse.json(casas);
  } catch (error) {
    return handleApiError(error);
  }
}

/** POST /api/casas — cadastra uma nova Casa, so admin. */
export async function POST(req: NextRequest) {
  try {
    await requirePapel("admin");
    const body = await req.json();
    const parsed = criarCasaSchema.safeParse(body);
    if (!parsed.success) throw new ApiError(400, parsed.error.issues[0]?.message ?? "Payload invalido.");

    const existente = await prisma.casa.findUnique({ where: { nome: parsed.data.nome } });
    if (existente) throw new ApiError(400, "Ja existe uma Casa com esse nome.");

    const casa = await prisma.casa.create({ data: parsed.data });
    return NextResponse.json(casa, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}
