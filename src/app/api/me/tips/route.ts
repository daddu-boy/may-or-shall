import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getRequestUserId, unauthorized } from "@/lib/requestUser";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * The one time explanations a person has already dismissed, held against the
 * account. Browser storage was the wrong home for this: it made the tips come
 * back on a second machine, and again after clearing site data, which reads as
 * the app forgetting you rather than as a fresh start.
 */
export async function GET(req: NextRequest) {
  const userId = await getRequestUserId(req);
  if (!userId) return unauthorized();
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { tipsSeen: true },
  });
  return NextResponse.json({ seen: [...new Set(user?.tipsSeen ?? [])] });
}

export async function POST(req: NextRequest) {
  const userId = await getRequestUserId(req);
  if (!userId) return unauthorized();

  const body = await req.json().catch(() => null);
  const id = typeof body?.id === "string" ? body.id.trim() : "";
  if (!id || id.length > 64) {
    return NextResponse.json({ error: "A tip id is required" }, { status: 400 });
  }

  /*
   * Appended in the database rather than read, merged and written back: two
   * screens dismissed at the same moment would otherwise each write their own
   * single value and the second would erase the first. Duplicates are possible
   * and harmless, and are folded out on the way back.
   */
  const updated = await prisma.user.update({
    where: { id: userId },
    data: { tipsSeen: { push: id } },
    select: { tipsSeen: true },
  });
  return NextResponse.json({ seen: [...new Set(updated.tipsSeen)] });
}
