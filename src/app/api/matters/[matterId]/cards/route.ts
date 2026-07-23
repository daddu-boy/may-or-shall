import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { syncCardChronology } from "@/lib/chronology";
import { checkApiAuth } from "@/lib/apiAuth";
import { resolvePara, type ParaMarker } from "@/lib/pdf/paraMap";
import { CARD_TYPES } from "@/lib/labels";
import { cardOut, parseJson } from "@/lib/jsonFields";

type Params = { params: { matterId: string } };

export async function GET(req: NextRequest, { params }: Params) {
  const denied = await checkApiAuth(req);
  if (denied) return denied;
  const sp = req.nextUrl.searchParams;
  const where: Prisma.CardWhereInput = { matterId: params.matterId };

  const type = sp.get("type");
  if (type && CARD_TYPES.includes(type as (typeof CARD_TYPES)[number])) {
    where.cardType = type as (typeof CARD_TYPES)[number];
  }
  const documentId = sp.get("documentId");
  if (documentId) where.documentId = documentId;
  const tag = sp.get("tag");
  const q = sp.get("q");
  if (q) {
    // SQLite LIKE is case-insensitive for ASCII, so plain `contains` suffices
    where.OR = [
      { body: { contains: q } },
      { quote: { contains: q } },
      { citation: { contains: q } },
      { proposition: { contains: q } },
    ];
  }
  const from = sp.get("from");
  const to = sp.get("to");
  if (from || to) {
    where.eventDate = {
      ...(from ? { gte: new Date(from) } : {}),
      ...(to ? { lte: new Date(to) } : {}),
    };
  }

  const cards = await prisma.card.findMany({
    where,
    orderBy: [{ orderIndex: "asc" }, { createdAt: "asc" }],
    include: { document: { select: { id: true, filename: true } } },
  });
  let out = cards.map(cardOut);
  if (tag) out = out.filter((c) => c.tags.includes(tag)); // tags live as JSON text in SQLite
  return NextResponse.json(out);
}

const rectSchema = z.object({
  page: z.number().int().min(1),
  x: z.number(),
  y: z.number(),
  w: z.number(),
  h: z.number(),
});

const createSchema = z.object({
  documentId: z.string().optional(),
  page: z.number().int().min(1).optional(),
  para: z.string().nullable().optional(),
  quote: z.string().optional().default(""),
  rects: z.array(rectSchema).optional().default([]),
  cardType: z.enum(CARD_TYPES).optional().default("MISC"),
  body: z.string().optional().default(""),
  eventDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
  tags: z.array(z.string()).optional().default([]),
  pinned: z.boolean().optional().default(false),
  citation: z.string().nullable().optional(),
  sourceUrl: z.string().url().max(2000).nullable().optional(),
  sourceTitle: z.string().max(300).nullable().optional(),
  proposition: z.string().nullable().optional(),
  treatment: z.enum(["RELIED_ON", "DISTINGUISHED", "OVERRULED_RISK"]).nullable().optional(),
});

export async function POST(req: NextRequest, { params }: Params) {
  const denied = await checkApiAuth(req);
  if (denied) return denied;
  const parsed = createSchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
  }
  const data = parsed.data;

  // Detect the paragraph number from the document's para_map unless the
  // caller supplied one explicitly (user can always type it manually).
  let para = data.para ?? null;
  if (para == null && data.documentId && data.page && data.rects.length > 0) {
    const doc = await prisma.document.findUnique({ where: { id: data.documentId } });
    if (doc) {
      const topRect = data.rects.reduce((a, b) => (a.y <= b.y ? a : b));
      para = resolvePara(parseJson<ParaMarker[]>(doc.paraMap, []), data.page, topRect.y);
    }
  }

  const last = await prisma.card.findFirst({
    where: { matterId: params.matterId, cardType: data.cardType },
    orderBy: { orderIndex: "desc" },
    select: { orderIndex: true },
  });

  const card = await prisma.card.create({
    data: {
      matterId: params.matterId,
      documentId: data.documentId,
      page: data.page,
      para,
      quote: data.quote,
      rects: JSON.stringify(data.rects),
      cardType: data.cardType,
      body: data.body || data.quote,
      eventDate: data.eventDate ? new Date(data.eventDate) : null,
      tags: JSON.stringify(data.tags),
      pinned: data.pinned,
      citation: data.citation ?? null,
      sourceUrl: data.sourceUrl ?? null,
      sourceTitle: data.sourceTitle ?? null,
      proposition: data.proposition ?? null,
      treatment: data.treatment ?? null,
      orderIndex: (last?.orderIndex ?? 0) + 1,
    },
    include: { document: { select: { id: true, filename: true } } },
  });

  await syncCardChronology(card.id);
  return NextResponse.json(cardOut(card), { status: 201 });
}
