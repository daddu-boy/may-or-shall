import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getRequestUserId, unauthorized } from "@/lib/requestUser";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** The AI clients this user has connected, so they can be reviewed and cut off. */
export async function GET(req: NextRequest) {
  const userId = await getRequestUserId(req);
  if (!userId) return unauthorized();

  const tokens = await prisma.oAuthToken.findMany({
    where: { userId, revokedAt: null, expiresAt: { gt: new Date() } },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      createdAt: true,
      lastUsedAt: true,
      client: { select: { clientName: true } },
    },
  });

  return NextResponse.json(
    tokens.map((t) => ({
      id: t.id,
      name: t.client.clientName,
      connectedAt: t.createdAt,
      lastUsedAt: t.lastUsedAt,
    }))
  );
}
