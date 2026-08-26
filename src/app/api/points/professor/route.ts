import { NextRequest, NextResponse } from "next/server";
import { requirePapel, handleApiError, ApiError } from "@/lib/auth/server";
import { pontuarProfessorSchema } from "@/lib/validation/schemas";
import { pontuarProfessor } from "@/lib/services/pointsService";

/** POST /api/points/professor — so admin (RN-12), nunca propaga, nunca ranking (RN-13). */
export async function POST(req: NextRequest) {
  try {
    const session = await requirePapel("admin");
    const body = await req.json();
    const parsed = pontuarProfessorSchema.safeParse(body);
    if (!parsed.success) throw new ApiError(400, parsed.error.issues[0]?.message ?? "Payload invalido.");

    await pontuarProfessor({
      ...parsed.data,
      autorId: session.user.id,
      autorPapel: session.user.papel,
    });

    return NextResponse.json({ ok: true }, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}
