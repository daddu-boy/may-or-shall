import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";

type Params = { params: { matterId: string } };

export async function GET(_req: NextRequest, { params }: Params) {
  const matter = await prisma.matter.findUnique({
    where: { id: params.matterId },
    include: { _count: { select: { documents: true, cards: true } } },
  });
  if (!matter) return NextResponse.json({ error: "Matter not found" }, { status: 404 });
  return NextResponse.json(matter);
}

const patchSchema = z.object({
  title: z.string().min(1).optional(),
  court: z.string().optional(),
  caseNumber: z.string().optional(),
  parties: z.string().optional(),
  ourSide: z.enum(["PETITIONER_PLAINTIFF", "RESPONDENT_DEFENDANT", "OTHER"]).optional(),
  status: z.enum(["ACTIVE", "ARCHIVED"]).optional(),
});

export async function PATCH(req: NextRequest, { params }: Params) {
  const parsed = patchSchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
  }
  const matter = await prisma.matter.update({ where: { id: params.matterId }, data: parsed.data });
  return NextResponse.json(matter);
}
