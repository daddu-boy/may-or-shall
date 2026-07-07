import type { Matter } from "@prisma/client";
import { prisma } from "./db";
import { MODELS, generate, loadPrompt } from "./ai";
import { cardDigest, ourSideLabel } from "./cardDigest";
import { mdToHtml } from "./docxUtils";

export const GENERATABLE_TYPES = {
  SENIOR_BRIEF: { prompt: "senior-brief", title: "Note of brief to senior counsel" },
  WRITTEN_SUBMISSIONS: { prompt: "written-submissions", title: "Written submissions" },
  JUDGE_NOTE: { prompt: "judge-note", title: "Note for the judge" },
} as const;

export type GeneratableType = keyof typeof GENERATABLE_TYPES;

/**
 * Card selection for generation (PRD F6 defaults): everything pinned plus
 * everything tagged to the selected issues; if no issues selected, all cards.
 */
export async function selectCards(matterId: string, issues: string[]) {
  const cards = await prisma.card.findMany({
    where: { matterId },
    include: { document: { select: { filename: true } } },
    orderBy: [{ cardType: "asc" }, { orderIndex: "asc" }],
  });
  if (issues.length === 0) return cards;
  return cards.filter((c) => c.pinned || c.tags.some((t) => issues.includes(t)));
}

export async function generateArtefactContent(
  matter: Matter,
  artefactType: GeneratableType,
  issues: string[]
): Promise<{ html: string; promptSnapshot: string; model: string }> {
  const template = GENERATABLE_TYPES[artefactType];
  const cards = await selectCards(matter.id, issues);
  if (cards.length === 0) throw new Error("No cards match the selection — create or tag cards first.");

  const prompt = await loadPrompt(template.prompt, {
    ourSide: ourSideLabel(matter.ourSide),
    matterTitle: matter.title,
    court: matter.court || "—",
    caseNumber: matter.caseNumber || "—",
    issues: issues.length ? issues.join(", ") : "(all)",
    cards: cardDigest(cards),
  });

  const result = await generate({ model: MODELS.brief, prompt, maxTokens: 32000 });
  return { html: mdToHtml(result.text), promptSnapshot: prompt, model: result.model };
}
