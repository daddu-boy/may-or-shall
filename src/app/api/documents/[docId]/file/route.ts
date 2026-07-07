import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { storage } from "@/lib/storage";

type Params = { params: { docId: string } };

export async function GET(_req: NextRequest, { params }: Params) {
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
