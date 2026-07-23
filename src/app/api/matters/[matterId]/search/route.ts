import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

type Params = { params: { matterId: string } };

function snippet(text: string, q: string, radius = 60): string {
  const idx = text.toLowerCase().indexOf(q.toLowerCase());
  if (idx < 0) return text.slice(0, radius * 2);
  const start = Math.max(0, idx - radius);
  const end = Math.min(text.length, idx + q.length + radius);
  return `${start > 0 ? "…" : ""}${text.slice(start, end).replace(/\s+/g, " ")}${end < text.length ? "…" : ""}`;
}

/** Global search within a matter across document text and cards (PRD F1). */
export async function GET(req: NextRequest, { params }: Params) {
  const q = (req.nextUrl.searchParams.get("q") || "").trim();
  if (q.length < 2) return NextResponse.json({ documents: [], cards: [] });

  const [pageHits, cardHits] = await Promise.all([
    prisma.documentPage.findMany({
      where: {
        text: { contains: q },
        document: { matterId: params.matterId },
      },
      include: { document: { select: { id: true, filename: true } } },
      orderBy: [{ documentId: "asc" }, { page: "asc" }],
      take: 50,
    }),
    prisma.card.findMany({
      where: {
        matterId: params.matterId,
        OR: [
          { body: { contains: q } },
          { quote: { contains: q } },
        ],
      },
      include: { document: { select: { id: true, filename: true } } },
      take: 50,
    }),
  ]);

  return NextResponse.json({
    documents: pageHits.map((h) => ({
      documentId: h.document.id,
      filename: h.document.filename,
      page: h.page,
      snippet: snippet(h.text, q),
    })),
    cards: cardHits.map((c) => ({
      id: c.id,
      cardType: c.cardType,
      body: snippet(c.body || c.quote, q),
      documentId: c.documentId,
      filename: c.document?.filename ?? null,
      page: c.page,
      para: c.para,
    })),
  });
}
