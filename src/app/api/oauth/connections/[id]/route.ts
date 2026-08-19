import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getRequestUserId, unauthorized, notFound } from "@/lib/requestUser";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Disconnect one client. Its access stops on the next call it makes. */
export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const userId = await getRequestUserId(req);
  if (!userId) return unauthorized();

  const token = await prisma.oAuthToken.findUnique({
    where: { id: params.id },
    select: { userId: true },
  });
  if (!token || token.userId !== userId) return notFound();

  await prisma.oAuthToken.update({
    where: { id: params.id },
    data: { revokedAt: new Date() },
  });
  return NextResponse.json({ ok: true });
}
