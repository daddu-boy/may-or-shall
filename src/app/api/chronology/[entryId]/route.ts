import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";

type Params = { params: { entryId: string } };

const patchSchema = z.object({
  eventDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  description: z.string().min(1).optional(),
  includeInFiling: z.boolean().optional(),
  sortOrder: z.number().optional(),
});

export async function PATCH(req: NextRequest, { params }: Params) {
  const parsed = patchSchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
  }
  const { eventDate, ...rest } = parsed.data;
  const entry = await prisma.chronologyEntry.update({
    where: { id: params.entryId },
    data: { ...rest, ...(eventDate ? { eventDate: new Date(eventDate) } : {}) },
  });
  return NextResponse.json(entry);
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  const entry = await prisma.chronologyEntry.findUnique({ where: { id: params.entryId } });
  if (!entry) return NextResponse.json({ error: "Entry not found" }, { status: 404 });
  if (entry.sourceCardId) {
    return NextResponse.json(
      { error: "This row is derived from a Date card. Delete the card, or exclude the row from filing instead." },
      { status: 409 }
    );
  }
  await prisma.chronologyEntry.delete({ where: { id: params.entryId } });
  return NextResponse.json({ ok: true });
}
