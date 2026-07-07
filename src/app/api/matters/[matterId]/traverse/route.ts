import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { splitPlaintParas } from "@/lib/paraSplit";

type Params = { params: { matterId: string } };

export async function GET(_req: NextRequest, { params }: Params) {
  const sheet = await prisma.traverseSheet.findUnique({
    where: { matterId: params.matterId },
    include: { rows: { orderBy: { order: "asc" } } },
  });
  if (!sheet) return NextResponse.json({ error: "No traverse sheet" }, { status: 404 });

  const doc = await prisma.document.findUnique({
    where: { id: sheet.documentId },
    select: { id: true, filename: true },
  });

  // hydrate linked cards for all rows in one query
  const cardIds = [
    ...new Set(sheet.rows.flatMap((r) => (r.linkedCardIds as string[]) ?? [])),
  ];
  const cards = cardIds.length
    ? await prisma.card.findMany({
        where: { id: { in: cardIds } },
        include: { document: { select: { id: true, filename: true } } },
      })
    : [];

  return NextResponse.json({ ...sheet, document: doc, linkedCards: cards });
}

const createSchema = z.object({ documentId: z.string().min(1) });

/** Designate a document as the plaint and split it into traverse rows (PRD F5). */
export async function POST(req: NextRequest, { params }: Params) {
  const parsed = createSchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
  }

  const existing = await prisma.traverseSheet.findUnique({ where: { matterId: params.matterId } });
  if (existing) {
    return NextResponse.json(
      { error: "A traverse sheet already exists for this matter. Delete it to re-designate." },
      { status: 409 }
    );
  }

  const doc = await prisma.document.findUnique({
    where: { id: parsed.data.documentId },
    include: { pages: { orderBy: { page: "asc" } } },
  });
  if (!doc || doc.matterId !== params.matterId) {
    return NextResponse.json({ error: "Document not found in this matter" }, { status: 404 });
  }

  const paras = splitPlaintParas(doc.pages.map((p) => p.text));
  if (paras.length === 0) {
    return NextResponse.json(
      { error: "No numbered paragraphs detected in this document" },
      { status: 422 }
    );
  }

  const sheet = await prisma.traverseSheet.create({
    data: {
      matterId: params.matterId,
      documentId: doc.id,
      rows: {
        create: paras.map((para, i) => ({
          order: i + 1,
          paraNo: String(para.no),
          paraText: para.text,
        })),
      },
    },
    include: { rows: { orderBy: { order: "asc" } } },
  });

  return NextResponse.json(sheet, { status: 201 });
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  await prisma.traverseSheet.deleteMany({ where: { matterId: params.matterId } });
  return NextResponse.json({ ok: true });
}
