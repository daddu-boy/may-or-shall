import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getRequestUserId, unauthorized, notFound } from "@/lib/requestUser";

type Params = { params: { tokenId: string } };

/** Revoke (not delete) so the audit trail survives. Only the token's owner may. */
export async function DELETE(req: NextRequest, { params }: Params) {
  const userId = await getRequestUserId(req);
  if (!userId) return unauthorized();
  const tok = await prisma.apiToken.findUnique({
    where: { id: params.tokenId },
    select: { userId: true },
  });
  if (!tok || tok.userId !== userId) return notFound("Token not found");
  await prisma.apiToken.update({
    where: { id: params.tokenId },
    data: { revokedAt: new Date() },
  });
  return NextResponse.json({ ok: true });
}
