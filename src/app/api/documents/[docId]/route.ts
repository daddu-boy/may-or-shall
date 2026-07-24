import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { storage } from "@/lib/storage";
import { DOC_TYPES } from "@/lib/labels";
import { requireResourceOwner, isResponse } from "@/lib/requestUser";

type Params = { params: { docId: string } };

export async function GET(req: NextRequest, { params }: Params) {
  const owner = await requireResourceOwner(req, () => prisma.document.findUnique({ where: { id: params.docId }, select: { matterId: true } }).then((r) => r?.matterId ?? null));
  if (isResponse(owner)) return owner;
  const doc = await prisma.document.findUnique({
    where: { id: params.docId },
    include: { _count: { select: { cards: true } } },
  });
  if (!doc) return NextResponse.json({ error: "Document not found" }, { status: 404 });
  return NextResponse.json(doc);
}

const patchSchema = z.object({
  docType: z.enum(DOC_TYPES).optional(),
  annexureLabel: z.string().nullable().optional(),
  filename: z.string().min(1).optional(),
});

export async function PATCH(req: NextRequest, { params }: Params) {
  const owner = await requireResourceOwner(req, () => prisma.document.findUnique({ where: { id: params.docId }, select: { matterId: true } }).then((r) => r?.matterId ?? null));
  if (isResponse(owner)) return owner;
  const parsed = patchSchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
  }
  const doc = await prisma.document.update({ where: { id: params.docId }, data: parsed.data });
  return NextResponse.json(doc);
}

/**
 * Back-link integrity (PRD): deleting a document that has cards requires
 * ?force=1 — without it the API returns 409 with the card count so the UI
 * can warn about orphaning.
 */
export async function DELETE(req: NextRequest, { params }: Params) {
  const owner = await requireResourceOwner(req, () => prisma.document.findUnique({ where: { id: params.docId }, select: { matterId: true } }).then((r) => r?.matterId ?? null));
  if (isResponse(owner)) return owner;
  const doc = await prisma.document.findUnique({
    where: { id: params.docId },
    include: { _count: { select: { cards: true } } },
  });
  if (!doc) return NextResponse.json({ error: "Document not found" }, { status: 404 });

  const force = req.nextUrl.searchParams.get("force") === "1";
  if (doc._count.cards > 0 && !force) {
    return NextResponse.json(
      { error: "Document has linked cards", cardCount: doc._count.cards },
      { status: 409 }
    );
  }

  await prisma.document.delete({ where: { id: params.docId } });
  if (doc.storagePath) await storage.delete(doc.storagePath);
  return NextResponse.json({ ok: true, orphanedCards: doc._count.cards });
}
