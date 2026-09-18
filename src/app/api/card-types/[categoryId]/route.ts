import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getRequestUserId, unauthorized } from "@/lib/requestUser";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ categoryId: string }> };

/**
 * Deleting a category never deletes cards. Anything filed under it becomes a
 * Personal note, which is the bucket for a passage whose job is not yet
 * decided, and the person is told how many moved before they confirm.
 */
export async function DELETE(req: NextRequest, { params }: Params) {
  const userId = await getRequestUserId(req);
  if (!userId) return unauthorized();
  const { categoryId } = await params;
  const category = await prisma.cardCategory.findFirst({
    where: { id: categoryId, userId },
    select: { id: true, key: true },
  });
  if (!category) return NextResponse.json({ error: "Category not found" }, { status: 404 });

  const moved = await prisma.card.updateMany({
    where: { cardType: category.key, matter: { userId } },
    data: { cardType: "MISC" },
  });
  await prisma.cardCategory.delete({ where: { id: category.id } });
  return NextResponse.json({ ok: true, movedToPersonalNote: moved.count });
}
