import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { MODELS, aiReadiness, generate, loadPrompt } from "@/lib/ai";
import { GROUNDING_INSTRUCTIONS, validateGroundedDraft } from "@/lib/groundedDraft";
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

  const reason = await aiReadiness(row.sheet.matter.aiEnabled, ["traverse-response"]);
  if (reason) return NextResponse.json({ error: reason }, { status: 503 });

  const cardIds = parseJson<string[]>(row.linkedCardIds, []);
  const cards = cardIds.length
    ? await prisma.card.findMany({
        where: { id: { in: cardIds }, matterId: row.sheet.matterId },
        include: { document: { select: { filename: true } } },
      })
    : [];

  try {
    const prompt = await loadPrompt("traverse-response", {
      ourSide: ourSideLabel(row.sheet.matter.ourSide),
      paraNo: row.paraNo,
      paraText: row.paraText,
      cards: cards.length ? cardDigest(cards) : "(no cards attached)",
    });

    const result = await generate({ model: MODELS.drafting, system: GROUNDING_INSTRUCTIONS, prompt, maxTokens: 6000 });
    const validated = validateGroundedDraft(result.text, cards);
    return NextResponse.json({ suggestion: validated.html, sourceReview: validated.review });
  } catch (e) {
    return NextResponse.json({ error: `AI generation failed: ${(e as Error).message}` }, { status: 502 });
  }
}
