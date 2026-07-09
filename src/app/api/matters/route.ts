import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { checkApiAuth } from "@/lib/apiAuth";

export async function GET(req: NextRequest) {
  const denied = await checkApiAuth(req);
  if (denied) return denied;
  const matters = await prisma.matter.findMany({
    orderBy: { updatedAt: "desc" },
    include: { _count: { select: { documents: true, cards: true } } },
  });
  return NextResponse.json(matters);
}

const createSchema = z.object({
  title: z.string().min(1),
  court: z.string().optional().default(""),
  caseNumber: z.string().optional().default(""),
  parties: z.string().optional().default(""),
  ourSide: z.enum(["PETITIONER_PLAINTIFF", "RESPONDENT_DEFENDANT", "OTHER"]).optional().default("OTHER"),
});

export async function POST(req: NextRequest) {
  const parsed = createSchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
  }
  const matter = await prisma.matter.create({ data: parsed.data });
  return NextResponse.json(matter, { status: 201 });
}
