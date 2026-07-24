import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { buildCompilation, resolveSources } from "@/lib/compilation";
import { parseJson } from "@/lib/jsonFields";
import { requireMatterOwner, isResponse } from "@/lib/requestUser";

export const maxDuration = 300;

type Params = { params: { matterId: string } };

const buildSchema = z.object({
  /** which cards drive the compilation: explicit ids, or filter by issues/pinned/all */
  cardIds: z.array(z.string()).optional(),
  issues: z.array(z.string()).default([]),
  pinnedOnly: z.boolean().default(false),
  scope: z.enum(["full", "cited"]).default("cited"),
  contextPages: z.number().int().min(0).max(10).default(1),
});

/** Build a convenience compilation PDF from the pages referenced by cards (PRD F7). */
export async function POST(req: NextRequest, { params }: Params) {
  const owner = await requireMatterOwner(req, params.matterId);
  if (isResponse(owner)) return owner;
  const parsed = buildSchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
  }
  const matter = await prisma.matter.findUnique({ where: { id: params.matterId } });
  if (!matter) return NextResponse.json({ error: "Matter not found" }, { status: 404 });

  const { cardIds, issues, pinnedOnly, scope, contextPages } = parsed.data;

  const rawCards = await prisma.card.findMany({
    where: cardIds?.length
      ? { matterId: params.matterId, id: { in: cardIds } }
      : { matterId: params.matterId },
    select: { id: true, documentId: true, page: true, tags: true, pinned: true },
  });
  let cards = rawCards.map((c) => ({ ...c, tags: parseJson<string[]>(c.tags, []) }));
  if (!cardIds?.length) {
    if (issues.length) cards = cards.filter((c) => c.tags.some((t) => issues.includes(t)));
    if (pinnedOnly) cards = cards.filter((c) => c.pinned);
  }
  if (cards.filter((c) => c.documentId).length === 0) {
    return NextResponse.json({ error: "No source-linked cards match the selection" }, { status: 422 });
  }

  const docs = await prisma.document.findMany({
    where: { matterId: params.matterId },
    select: { id: true, pageCount: true },
  });
  const pageCounts = new Map(docs.map((d) => [d.id, d.pageCount]));

  const sources = resolveSources(cards, { scope, contextPages }, pageCounts);

  try {
    const pdf = await buildCompilation({ matterTitle: matter.title, sources });
    const safeTitle = matter.title.replace(/[^\w\- ]+/g, "").trim() || "Matter";
    return new NextResponse(new Uint8Array(pdf), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="Compilation - ${safeTitle}.pdf"`,
      },
    });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 422 });
  }
}
