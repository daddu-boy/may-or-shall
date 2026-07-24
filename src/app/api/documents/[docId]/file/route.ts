import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { storage } from "@/lib/storage";
import { requireResourceOwner, isResponse } from "@/lib/requestUser";

type Params = { params: { docId: string } };

export async function GET(req: NextRequest, { params }: Params) {
  const owner = await requireResourceOwner(req, () => prisma.document.findUnique({ where: { id: params.docId }, select: { matterId: true } }).then((r) => r?.matterId ?? null));
  if (isResponse(owner)) return owner;
  const doc = await prisma.document.findUnique({ where: { id: params.docId } });
  if (!doc || !doc.storagePath) {
    return NextResponse.json({ error: "Document not found" }, { status: 404 });
  }
  const data = await storage.get(doc.storagePath);
  return new NextResponse(new Uint8Array(data), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="${encodeURIComponent(doc.filename)}"`,
      "Cache-Control": "private, max-age=3600",
    },
  });
}
