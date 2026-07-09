import type { Card } from "@prisma/client";

type CardWithDoc = Card & { document?: { filename: string } | null };

export function sourceChip(card: CardWithDoc): string {
  if (!card.document) {
    if (card.sourceUrl) {
      const title = card.sourceTitle ? `${card.sourceTitle}, ` : "";
      return `(${title}${card.sourceUrl})`;
    }
    return "";
  }
  const name = card.document.filename.replace(/\.pdf$/i, "");
  const bits = [name];
  if (card.page) bits.push(`p.${card.page}`);
  if (card.para) bits.push(`¶${card.para}`);
  return `(${bits.join(", ")})`;
}

/** Structured plain-text digest of cards for AI prompts (never raw PDFs, per PRD F6). */
export function cardDigest(cards: CardWithDoc[]): string {
  return cards
    .map((card) => {
      const lines = [`- [${card.cardType}] ${card.body || card.quote}`];
      const chip = sourceChip(card);
      if (chip) lines.push(`  source: ${chip}`);
      if (card.quote && card.quote !== card.body) lines.push(`  quote: "${card.quote}"`);
      if (card.eventDate) lines.push(`  date: ${card.eventDate.toISOString().slice(0, 10)}`);
      if (card.citation) lines.push(`  citation: ${card.citation}`);
      if (card.proposition) lines.push(`  proposition: ${card.proposition}`);
      if (card.treatment) lines.push(`  treatment: ${card.treatment}`);
      if (card.tags.length) lines.push(`  issues: ${card.tags.join(", ")}`);
      return lines.join("\n");
    })
    .join("\n");
}

export function ourSideLabel(ourSide: string): string {
  if (ourSide === "PETITIONER_PLAINTIFF") return "petitioner/plaintiff";
  if (ourSide === "RESPONDENT_DEFENDANT") return "respondent/defendant";
  return "party";
}
