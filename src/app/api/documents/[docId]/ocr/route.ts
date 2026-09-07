import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { prisma } from "@/lib/db";
import { storage } from "@/lib/storage";
import { preparePdf } from "@/lib/pdf/ocr";
import { documentOut } from "@/lib/jsonFields";
import { requireResourceOwner, isResponse } from "@/lib/requestUser";

export const runtime = "nodejs";
export const maxDuration = 300;

export async function POST(req: NextRequest, { params }: { params: { docId: string } }) {
  const owner = await requireResourceOwner(req, () => prisma.document.findUnique({ where: { id: params.docId }, select: { matterId: true } }).then(d => d?.matterId ?? null));
  if (isResponse(owner)) return owner;
  const doc = await prisma.document.findUnique({ where: { id: params.docId } });
  if (!doc) return NextResponse.json({ error: "Document not found" }, { status: 404 });
  const nextPath = `documents/${doc.id}.${randomUUID()}.pdf`;
  try {
    const original = await storage.get(doc.originalStoragePath || doc.storagePath);
    const prepared = await preparePdf(original);
    if (prepared.report.ocr !== "completed") return NextResponse.json({ error: prepared.report.message || "This PDF already has text.", report: prepared.report }, { status: 422 });
    await storage.put(nextPath, prepared.data);
    const updated = await prisma.$transaction(async tx => {
      // Compare-and-swap prevents simultaneous retries overwriting one another.
      const changed = await tx.document.updateMany({ where: { id: doc.id, updatedAt: doc.updatedAt }, data: {
        storagePath: nextPath, originalStoragePath: doc.originalStoragePath || doc.storagePath,
        extractionReport: JSON.stringify(prepared.report), paraMap: JSON.stringify(prepared.extraction.paraMap),
        hasTextLayer: prepared.extraction.hasTextLayer,
      } });
      if (changed.count !== 1) throw new Error("Document changed during OCR. Please retry.");
      await tx.documentPage.deleteMany({ where: { documentId: doc.id } });
      await tx.documentPage.createMany({ data: prepared.extraction.pageTexts.map((text, i) => ({ documentId: doc.id, page: i + 1, text })) });
      return tx.document.findUniqueOrThrow({ where: { id: doc.id } });
    }, { timeout: 30_000 });
    if (doc.originalStoragePath) await storage.delete(doc.storagePath).catch(() => {});
    return NextResponse.json(documentOut(updated));
  } catch {
    await storage.delete(nextPath).catch(() => {});
    return NextResponse.json({ error: "OCR could not be saved. Your current PDF is unchanged; please retry." }, { status: 500 });
  }
}
