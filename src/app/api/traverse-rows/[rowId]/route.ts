import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";

type Params = { params: { rowId: string } };

const patchSchema = z.object({
  responseText: z.string().optional(),
  status: z
    .enum(["NOT_STARTED", "DENIED_BARE", "DENIED_SPECIFIC", "ADMITTED", "ADMITTED_PARTLY", "LEGAL_OBJECTION"])
    .optional(),
  linkedCardIds: z.array(z.string()).optional(),
});

export async function PATCH(req: NextRequest, { params }: Params) {
  const parsed = patchSchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
  }
  const row = await prisma.traverseRow.update({
    where: { id: params.rowId },
    data: parsed.data,
  });
  return NextResponse.json(row);
}
