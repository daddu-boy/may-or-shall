import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { renumberAnnexures } from "@/lib/annexures";
import { requireResourceOwner, isResponse } from "@/lib/requestUser";

type Params = { params: { itemId: string } };

export async function DELETE(req: NextRequest, { params }: Params) {
  const owner = await requireResourceOwner(req, () => prisma.annexureItem.findUnique({ where: { id: params.itemId }, select: { matterId: true } }).then((r) => r?.matterId ?? null));
  if (isResponse(owner)) return owner;
  const item = await prisma.annexureItem.findUnique({ where: { id: params.itemId } });
  if (!item) return NextResponse.json({ error: "Not found" }, { status: 404 });
  await prisma.annexureItem.delete({ where: { id: params.itemId } });
  await renumberAnnexures(item.matterId);
  return NextResponse.json({ ok: true });
}
