import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { MATTER_KINDS } from "@/lib/labels";
import { getRequestUserId, unauthorized } from "@/lib/requestUser";

export async function GET(req: NextRequest) {
  const userId = await getRequestUserId(req);
  if (!userId) return unauthorized();
  const matters = await prisma.matter.findMany({
    where: { userId },
    orderBy: { updatedAt: "desc" },
    include: { _count: { select: { documents: true, cards: true } } },
  });
  return NextResponse.json(matters);
}

const createSchema = z.object({
  title: z.string().min(1),
  kind: z.enum(MATTER_KINDS).optional().default("CASE"),
  court: z.string().optional().default(""),
  caseNumber: z.string().optional().default(""),
  parties: z.string().optional().default(""),
  ourSide: z.enum(["PETITIONER_PLAINTIFF", "RESPONDENT_DEFENDANT", "OTHER"]).optional().default("OTHER"),
});

export async function POST(req: NextRequest) {
  const userId = await getRequestUserId(req);
  if (!userId) return unauthorized();
  const parsed = createSchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
  }
  // A project has no court and no case number. If any arrived, drop them
  // rather than storing details that no screen will ever show.
  const data =
    parsed.data.kind === "PROJECT"
      ? { ...parsed.data, court: "", caseNumber: "", ourSide: "OTHER" as const }
      : parsed.data;
  const matter = await prisma.matter.create({ data: { ...data, userId } });
  return NextResponse.json(matter, { status: 201 });
}
