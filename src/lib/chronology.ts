import { prisma } from "./db";

/**
 * Keep the derived ChronologyEntry for a card in step with the card (PRD F4:
 * a Date card created in the reader appears in the chronology immediately).
 * Called after any card create/update. Card deletion cascades via the FK.
 */
export async function syncCardChronology(cardId: string): Promise<void> {
  const card = await prisma.card.findUnique({ where: { id: cardId } });
  if (!card) return;

  const existing = await prisma.chronologyEntry.findUnique({
    where: { sourceCardId: cardId },
  });

  if (card.cardType === "DATE" && card.eventDate) {
    const description = (card.body || card.quote).trim();
    if (existing) {
      await prisma.chronologyEntry.update({
        where: { id: existing.id },
        data: { eventDate: card.eventDate, description },
      });
    } else {
      await prisma.chronologyEntry.create({
        data: {
          matterId: card.matterId,
          eventDate: card.eventDate,
          description,
          sourceCardId: card.id,
          sortOrder: card.eventDate.getTime(),
        },
      });
    }
  } else if (existing) {
    await prisma.chronologyEntry.delete({ where: { id: existing.id } });
  }
}

/** Token-overlap similarity used to flag likely duplicate chronology rows. */
export function textSimilarity(a: string, b: string): number {
  const tok = (s: string) =>
    new Set(s.toLowerCase().replace(/[^\p{L}\p{N}\s]/gu, "").split(/\s+/).filter(Boolean));
  const ta = tok(a);
  const tb = tok(b);
  if (ta.size === 0 || tb.size === 0) return 0;
  let inter = 0;
  ta.forEach((t) => {
    if (tb.has(t)) inter++;
  });
  return inter / Math.min(ta.size, tb.size);
}
