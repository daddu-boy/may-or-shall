import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

type Params = { params: { tokenId: string } };

/** Revoke (not delete) so the audit trail survives. */
export async function DELETE(_req: NextRequest, { params }: Params) {
  await prisma.apiToken.update({
    where: { id: params.tokenId },
    data: { revokedAt: new Date() },
  });
  return NextResponse.json({ ok: true });
}
