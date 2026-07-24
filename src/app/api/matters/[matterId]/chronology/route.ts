import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { textSimilarity } from "@/lib/chronology";
import { requireMatterOwner, isResponse } from "@/lib/requestUser";

type Params = { params: { matterId: string } };

const DUPLICATE_THRESHOLD = 0.6;

export async function GET(req: NextRequest, { params }: Params) {
  const owner = await requireMatterOwner(req, params.matterId);
  if (isResponse(owner)) return owner;
  const entries = await prisma.chronologyEntry.findMany({
    where: { matterId: params.matterId },
    orderBy: [{ eventDate: "asc" }, { sortOrder: "asc" }, { createdAt: "asc" }],
    include: {
      sourceCard: {
        select: {
          id: true,
          page: true,
          para: true,
          documentId: true,
          document: { select: { id: true, filename: true } },
        },
      },
    },
  });

  // Duplicate detection: same date + similar text (PRD F4).
  const duplicateIds = new Set<string>();
  for (let i = 0; i < entries.length; i++) {
    for (let j = i + 1; j < entries.length; j++) {
      if (entries[i].eventDate.getTime() !== entries[j].eventDate.getTime()) break;
      if (textSimilarity(entries[i].description, entries[j].description) >= DUPLICATE_THRESHOLD) {
        duplicateIds.add(entries[i].id);
        duplicateIds.add(entries[j].id);
      }
    }
  }

  return NextResponse.json(
    entries.map((e) => ({ ...e, flaggedDuplicate: duplicateIds.has(e.id) }))
  );
}

const createSchema = z.object({
  eventDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  description: z.string().min(1),
  includeInFiling: z.boolean().optional().default(true),
});

/** Manual chronology rows not tied to a highlight (PRD F4). */
export async function POST(req: NextRequest, { params }: Params) {
  const owner = await requireMatterOwner(req, params.matterId);
  if (isResponse(owner)) return owner;
  const parsed = createSchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
  }
  const eventDate = new Date(parsed.data.eventDate);
  const entry = await prisma.chronologyEntry.create({
    data: {
      matterId: params.matterId,
      eventDate,
      description: parsed.data.description,
      includeInFiling: parsed.data.includeInFiling,
      sortOrder: eventDate.getTime(),
    },
  });
  return NextResponse.json(entry, { status: 201 });
}
