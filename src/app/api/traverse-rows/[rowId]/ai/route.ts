import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { MODELS, aiUnavailableReason, generate, loadPrompt } from "@/lib/ai";
import { cardDigest, ourSideLabel } from "@/lib/cardDigest";
import { parseJson } from "@/lib/jsonFields";
import { requireResourceOwner, isResponse } from "@/lib/requestUser";

export const maxDuration = 120;

type Params = { params: { rowId: string } };

/**
 * AI assist per traverse row (PRD F5): draft a specific denial/response from
 * the plaint para plus attached cards. Returns a suggestion for the editor —
 * never saved automatically.
 */
export async function POST(req: NextRequest, { params }: Params) {
  const owner = await requireResourceOwner(req, () => prisma.traverseRow.findUnique({ where: { id: params.rowId }, select: { sheet: { select: { matterId: true } } } }).then((r) => r?.sheet.matterId ?? null));
  if (isResponse(owner)) return owner;
  const row = await prisma.traverseRow.findUnique({
    where: { id: params.rowId },
    include: { sheet: { include: { matter: true } } },
  });
  if (!row) return NextResponse.json({ error: "Row not found" }, { status: 404 });

  const reason = aiUnavailableReason(row.sheet.matter.aiEnabled);
  if (reason) return NextResponse.json({ error: reason }, { status: 503 });

  const cardIds = parseJson<string[]>(row.linkedCardIds, []);
  const cards = cardIds.length
    ? await prisma.card.findMany({
        where: { id: { in: cardIds } },
        include: { document: { select: { filename: true } } },
      })
    : [];

  const prompt = await loadPrompt("traverse-response", {
    ourSide: ourSideLabel(row.sheet.matter.ourSide),
    paraNo: row.paraNo,
    paraText: row.paraText,
    cards: cards.length ? cardDigest(cards) : "(no cards attached)",
  });

  try {
    const result = await generate({ model: MODELS.drafting, prompt, maxTokens: 2000 });
    return NextResponse.json({ suggestion: result.text.trim() });
  } catch (e) {
    return NextResponse.json({ error: `AI generation failed: ${(e as Error).message}` }, { status: 502 });
  }
}
