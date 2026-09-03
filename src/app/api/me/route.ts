import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getRequestUserId, unauthorized } from "@/lib/requestUser";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Who is signed in. Enough to show the account you are about to act as. */
export async function GET(req: NextRequest) {
  const userId = await getRequestUserId(req);
  if (!userId) return unauthorized();
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { email: true, name: true },
  });
  return NextResponse.json({ email: user?.email ?? null, name: user?.name ?? null });
}
