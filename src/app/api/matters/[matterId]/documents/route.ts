import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { storage } from "@/lib/storage";
import { extractPdf } from "@/lib/pdf/extract";
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

  const buffer = Buffer.from(await file.arrayBuffer());

  let extraction;
  try {
    extraction = await extractPdf(buffer);
  } catch {
    return NextResponse.json({ error: `Could not parse ${file.name} as a PDF` }, { status: 422 });
  }

  const doc = await prisma.document.create({
    data: {
      matterId: params.matterId,
      filename: file.name,
      docType,
      storagePath: "",
      pageCount: extraction.pageCount,
      hasTextLayer: extraction.hasTextLayer,
      paraMap: JSON.stringify(extraction.paraMap),
      status: "ready",
    },
  });

  const storagePath = `documents/${doc.id}.pdf`;
  await storage.put(storagePath, buffer);
  await prisma.document.update({ where: { id: doc.id }, data: { storagePath } });

  if (extraction.pageTexts.length > 0) {
    await prisma.documentPage.createMany({
      data: extraction.pageTexts.map((text, i) => ({
        documentId: doc.id,
        page: i + 1,
        text,
      })),
    });
  }

  /*
   * Highlights the file already carried become cards, so a bundle somebody has
   * spent months marking up in Acrobat, Preview or LiquidText arrives with that
   * work intact rather than asking them to do it again here.
   *
   * They land as Personal note: the reader knew a passage mattered, not what it
   * was for. Retyping one is a click, and the imported tag makes the whole
   * batch easy to find and triage.
   */
  let importedCards = 0;
  if (extraction.highlights.length > 0) {
    const last = await prisma.card.findFirst({
      where: { matterId: params.matterId },
      orderBy: { orderIndex: "desc" },
      select: { orderIndex: true },
    });
    let order = last?.orderIndex ?? 0;
    const created = await prisma.card.createMany({
      data: extraction.highlights.map((h) => {
        const topRect = h.rects.reduce((a, b) => (a.y <= b.y ? a : b));
        return {
          matterId: params.matterId,
          documentId: doc.id,
          page: h.page,
          para: resolvePara(extraction.paraMap, h.page, topRect.y),
          quote: h.quote,
          rects: JSON.stringify(h.rects),
          cardType: "MISC",
          body: h.note || h.quote,
          tags: JSON.stringify(["imported"]),
          createdBy: "import",
          orderIndex: ++order,
        };
      }),
    });
    importedCards = created.count;
  }

  return NextResponse.json({ ...documentOut({ ...doc, storagePath }), importedCards }, { status: 201 });
}
