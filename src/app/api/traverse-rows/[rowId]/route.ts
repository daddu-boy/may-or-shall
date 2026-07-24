import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { rowOut } from "@/lib/jsonFields";
import { requireResourceOwner, isResponse } from "@/lib/requestUser";

type Params = { params: { rowId: string } };

const patchSchema = z.object({
  responseText: z.string().optional(),
  status: z
    .enum(["NOT_STARTED", "DENIED_BARE", "DENIED_SPECIFIC", "ADMITTED", "ADMITTED_PARTLY", "LEGAL_OBJECTION"])
    .optional(),
  linkedCardIds: z.array(z.string()).optional(),
});

export async function PATCH(req: NextRequest, { params }: Params) {
  const owner = await requireResourceOwner(req, () => prisma.traverseRow.findUnique({ where: { id: params.rowId }, select: { sheet: { select: { matterId: true } } } }).then((r) => r?.sheet.matterId ?? null));
  if (isResponse(owner)) return owner;
  const parsed = patchSchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
  }
  const { linkedCardIds, ...rest } = parsed.data;
  const row = await prisma.traverseRow.update({
    where: { id: params.rowId },
    data: {
      ...rest,
      ...(linkedCardIds !== undefined ? { linkedCardIds: JSON.stringify(linkedCardIds) } : {}),
    },
  });
  return NextResponse.json(rowOut(row));
}
