import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { renumberAnnexures } from "@/lib/annexures";

type Params = { params: { itemId: string } };

export async function DELETE(_req: NextRequest, { params }: Params) {
  const item = await prisma.annexureItem.findUnique({ where: { id: params.itemId } });
  if (!item) return NextResponse.json({ error: "Not found" }, { status: 404 });
  await prisma.annexureItem.delete({ where: { id: params.itemId } });
  await renumberAnnexures(item.matterId);
  return NextResponse.json({ ok: true });
}
