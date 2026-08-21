import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireMatterOwner, isResponse } from "@/lib/requestUser";
import { LINK_KINDS, type LinkKindValue } from "@/lib/labels";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Every link in the matter, both directions, for the reader and the card board. */
export async function GET(req: NextRequest, { params }: { params: { matterId: string } }) {
  const owner = await requireMatterOwner(req, params.matterId);
  if (isResponse(owner)) return owner;

  const links = await prisma.cardLink.findMany({
    where: { matterId: params.matterId },
    orderBy: { createdAt: "desc" },
  });
  return NextResponse.json(links);
}

/**
 * Draw a link between two cards. Both must belong to this matter, which is
 * what stops a link being used to reach a card in someone else's account.
 */
export async function POST(req: NextRequest, { params }: { params: { matterId: string } }) {
  const owner = await requireMatterOwner(req, params.matterId);
  if (isResponse(owner)) return owner;

  const body = await req.json().catch(() => null);
  const fromCardId = typeof body?.fromCardId === "string" ? body.fromCardId : "";
  const toCardId = typeof body?.toCardId === "string" ? body.toCardId : "";
  const kind: LinkKindValue = LINK_KINDS.includes(body?.kind) ? body.kind : "RELATES_TO";
  const note = typeof body?.note === "string" ? body.note.slice(0, 500) : "";

  if (!fromCardId || !toCardId) {
    return NextResponse.json({ error: "Two cards are required" }, { status: 400 });
  }
  if (fromCardId === toCardId) {
    return NextResponse.json({ error: "A card cannot link to itself" }, { status: 400 });
  }

  const cards = await prisma.card.findMany({
    where: { id: { in: [fromCardId, toCardId] }, matterId: params.matterId },
    select: { id: true },
  });
  if (cards.length !== 2) {
    return NextResponse.json({ error: "Both cards must be in this matter" }, { status: 404 });
  }

  // The same pair in the other direction is the same link, so reuse it rather
  // than creating a mirrored duplicate the reader would draw twice.
  const existing = await prisma.cardLink.findFirst({
    where: {
      OR: [
        { fromCardId, toCardId },
        { fromCardId: toCardId, toCardId: fromCardId },
      ],
    },
  });
  if (existing) {
    const updated = await prisma.cardLink.update({
      where: { id: existing.id },
      data: { kind, note: note || existing.note, suggested: false },
    });
    return NextResponse.json(updated);
  }

  const link = await prisma.cardLink.create({
    data: { matterId: params.matterId, fromCardId, toCardId, kind, note },
  });
  return NextResponse.json(link, { status: 201 });
}
