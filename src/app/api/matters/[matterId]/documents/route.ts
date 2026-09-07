import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { storage } from "@/lib/storage";
import { preparePdf, MAX_PDF_BYTES } from "@/lib/pdf/ocr";
import { randomUUID } from "node:crypto";
import { resolvePara } from "@/lib/pdf/paraMap";
import { DOC_TYPES, type DocTypeValue } from "@/lib/labels";
import { documentOut } from "@/lib/jsonFields";
import { requireMatterOwner, isResponse } from "@/lib/requestUser";

export const runtime = "nodejs";
export const maxDuration = 300;

type Params = { params: { matterId: string } };

export async function GET(req: NextRequest, { params }: Params) {
  const owner = await requireMatterOwner(req, params.matterId);
  if (isResponse(owner)) return owner;
  const documents = await prisma.document.findMany({
    where: { matterId: params.matterId },
    orderBy: { createdAt: "asc" },
    include: { _count: { select: { cards: true } } },
  });
  return NextResponse.json(documents.map(documentOut));
}

/** Multi-file upload happens as one request per file so the client can show per-file progress. */
export async function POST(req: NextRequest, { params }: Params) {
  const owner = await requireMatterOwner(req, params.matterId);
  if (isResponse(owner)) return owner;
  const matter = await prisma.matter.findUnique({ where: { id: params.matterId } });
  if (!matter) return NextResponse.json({ error: "Matter not found" }, { status: 404 });

  const declaredSize = Number(req.headers.get("content-length"));
  if (declaredSize > MAX_PDF_BYTES + 1024 * 1024) {
    return NextResponse.json({ error: "PDF exceeds the 50 MB upload limit." }, { status: 413 });
  }
  const form = await req.formData();
  const file = form.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "No file provided" }, { status: 400 });
  }
  if (!file.name.toLowerCase().endsWith(".pdf")) {
    return NextResponse.json({ error: "Only PDF files are supported" }, { status: 400 });
  }
  const docTypeRaw = form.get("docType");
  const docType = DOC_TYPES.includes(docTypeRaw as DocTypeValue)
    ? (docTypeRaw as DocTypeValue)
    : "MISC";

  if (file.size > MAX_PDF_BYTES) return NextResponse.json({ error: "PDF exceeds the 50 MB upload limit." }, { status: 413 });
  const buffer = Buffer.from(await file.arrayBuffer());

  let prepared;
  try {
    prepared = await preparePdf(buffer);
  } catch {
    return NextResponse.json({ error: "Could not process PDF. Use an unlocked PDF of at most 500 pages and 50 MB." }, { status: 422 });
  }
  const { extraction, report } = prepared;
  const id = randomUUID();
  const storagePath = `documents/${id}.pdf`;
  const originalStoragePath = prepared.data !== buffer ? `documents/${id}.original.pdf` : null;
  try {
    await storage.put(storagePath, prepared.data);
    if (originalStoragePath) await storage.put(originalStoragePath, buffer);
    const result = await prisma.$transaction(async (tx) => {
      const doc = await tx.document.create({ data: {
        id, matterId: params.matterId, filename: file.name, docType,
        storagePath, originalStoragePath, extractionReport: JSON.stringify(report),
        pageCount: extraction.pageCount, hasTextLayer: extraction.hasTextLayer,
        paraMap: JSON.stringify(extraction.paraMap), status: "ready",
      } });
      if (extraction.pageTexts.length) await tx.documentPage.createMany({
        data: extraction.pageTexts.map((text, i) => ({ documentId: id, page: i + 1, text })),
      });
      let importedCards = 0;
      if (extraction.highlights.length) {
        const last = await tx.card.findFirst({ where: { matterId: params.matterId }, orderBy: { orderIndex: "desc" }, select: { orderIndex: true } });
        let order = last?.orderIndex ?? 0;
        const imported = await tx.card.createMany({ data: extraction.highlights.map((h) => ({
          matterId: params.matterId, documentId: id, page: h.page,
          para: resolvePara(extraction.paraMap, h.page, h.rects.reduce((a, b) => a.y <= b.y ? a : b).y),
          quote: h.quote, rects: JSON.stringify(h.rects), cardType: "MISC",
          body: h.note || h.quote, tags: JSON.stringify(["imported"]), createdBy: "import", orderIndex: ++order,
        })) });
        importedCards = imported.count;
      }
      return { ...documentOut(doc), importedCards };
    }, { timeout: 30_000 });
    return NextResponse.json(result, { status: 201 });
  } catch {
    await Promise.allSettled([storage.delete(storagePath), ...(originalStoragePath ? [storage.delete(originalStoragePath)] : [])]);
    return NextResponse.json({ error: "The document could not be saved. Please retry the upload." }, { status: 500 });
  }
}
