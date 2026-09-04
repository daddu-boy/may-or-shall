import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { syncCardChronology } from "@/lib/chronology";
import { CARD_TYPES } from "@/lib/labels";
import { cardOut } from "@/lib/jsonFields";
import { requireResourceOwner, isResponse } from "@/lib/requestUser";

type Params = { params: { cardId: string } };

export async function GET(req: NextRequest, { params }: Params) {
  const owner = await requireResourceOwner(req, () => prisma.card.findUnique({ where: { id: params.cardId }, select: { matterId: true } }).then((r) => r?.matterId ?? null));
  if (isResponse(owner)) return owner;
  const card = await prisma.card.findUnique({
    where: { id: params.cardId },
    include: { document: { select: { id: true, filename: true } } },
  });
  if (!card) return NextResponse.json({ error: "Card not found" }, { status: 404 });
  return NextResponse.json(cardOut(card));
}

const patchSchema = z.object({
  cardType: z.enum(CARD_TYPES).optional(),
  body: z.string().optional(),
  para: z.string().nullable().optional(),
  eventDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
  tags: z.array(z.string()).optional(),
  pinned: z.boolean().optional(),
  citation: z.string().nullable().optional(),
  proposition: z.string().nullable().optional(),
  treatment: z.enum(["RELIED_ON", "DISTINGUISHED", "OVERRULED_RISK"]).nullable().optional(),
  orderIndex: z.number().optional(),
  /** a date to be reminded on, or null to clear it. Personal notes only. */
  remindAt: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
});

export async function PATCH(req: NextRequest, { params }: Params) {
  const owner = await requireResourceOwner(req, () => prisma.card.findUnique({ where: { id: params.cardId }, select: { matterId: true } }).then((r) => r?.matterId ?? null));
  if (isResponse(owner)) return owner;
  const parsed = patchSchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
  }
  const { eventDate, tags, remindAt, ...rest } = parsed.data;

  /*
   * A reminder belongs on a personal note and nowhere else. Every other type
   * records something that happened, and the chronology is built from those
   * dates; a future date on one would quietly corrupt the List of Dates.
   */
  if (remindAt !== undefined) {
    const existing = await prisma.card.findUnique({
      where: { id: params.cardId },
      select: { cardType: true },
    });
    const type = rest.cardType ?? existing?.cardType;
    if (remindAt !== null && type !== "MISC") {
      return NextResponse.json(
        { error: "Reminders can only be set on a personal note." },
        { status: 400 }
      );
    }
  }
  const card = await prisma.card.update({
    where: { id: params.cardId },
    data: {
      ...(remindAt !== undefined
        ? {
            // noon UTC, so a date never slips a day either side of IST
            remindAt: remindAt ? new Date(`${remindAt}T12:00:00.000Z`) : null,
            remindSentAt: null,
          }
        : {}),
      ...rest,
      ...(tags !== undefined ? { tags: JSON.stringify(tags) } : {}),
      ...(eventDate !== undefined ? { eventDate: eventDate ? new Date(eventDate) : null } : {}),
    },
    include: { document: { select: { id: true, filename: true } } },
  });
  await syncCardChronology(card.id);
  return NextResponse.json(cardOut(card));
}

export async function DELETE(req: NextRequest, { params }: Params) {
  const owner = await requireResourceOwner(req, () => prisma.card.findUnique({ where: { id: params.cardId }, select: { matterId: true } }).then((r) => r?.matterId ?? null));
  if (isResponse(owner)) return owner;
  await prisma.card.delete({ where: { id: params.cardId } });
  return NextResponse.json({ ok: true });
}
