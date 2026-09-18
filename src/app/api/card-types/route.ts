import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getRequestUserId, unauthorized } from "@/lib/requestUser";
import { categoriesFor, keyFor, MAX_CATEGORIES, MAX_LABEL } from "@/lib/cardCategories";
import { CARD_TYPE_LABEL } from "@/lib/labels";
import { z } from "zod";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const userId = await getRequestUserId(req);
  if (!userId) return unauthorized();
  return NextResponse.json(await categoriesFor(userId));
}

const createSchema = z.object({
  label: z.string().trim().min(1).max(MAX_LABEL),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
});

/** A palette that keeps its distance from the built in types' colours. */
const PALETTE = ["#0ea5e9", "#a855f7", "#14b8a6", "#f43f5e", "#eab308", "#64748b", "#22c55e", "#fb7185"];

export async function POST(req: NextRequest) {
  const userId = await getRequestUserId(req);
  if (!userId) return unauthorized();
  const parsed = createSchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: `A category needs a name of 1 to ${MAX_LABEL} characters.` }, { status: 400 });
  }
  const label = parsed.data.label;
  const existing = await categoriesFor(userId);
  if (existing.length >= MAX_CATEGORIES) {
    return NextResponse.json(
      { error: `You can have ${MAX_CATEGORIES} categories of your own. Delete one to add another.` },
      { status: 400 }
    );
  }
  const clash =
    existing.some((c) => c.label.toLowerCase() === label.toLowerCase()) ||
    Object.values(CARD_TYPE_LABEL).some((l) => l.toLowerCase() === label.toLowerCase());
  if (clash) return NextResponse.json({ error: `There is already a "${label}" category.` }, { status: 409 });

  const category = await prisma.cardCategory.create({
    data: {
      userId,
      key: keyFor(label, existing.map((c) => c.key)),
      label,
      color: parsed.data.color ?? PALETTE[existing.length % PALETTE.length],
    },
    select: { id: true, key: true, label: true, color: true },
  });
  return NextResponse.json(category, { status: 201 });
}
