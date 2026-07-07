import { prisma } from "./db";

/**
 * Annexure registry helpers (PRD F8). Labels derive from position + the
 * matter's prefix; renumbering rewrites the mirrored Document.annexureLabel
 * and every live reference embedded in rich text across the matter.
 */

export function derivePrefix(matter: { annexurePrefix: string; ourSide: string }): string {
  if (matter.annexurePrefix.trim()) return matter.annexurePrefix.trim();
  if (matter.ourSide === "PETITIONER_PLAINTIFF") return "P";
  if (matter.ourSide === "RESPONDENT_DEFENDANT") return "R";
  return "A";
}

export function labelFor(prefix: string, position: number): string {
  return `Annexure ${prefix}-${position}`;
}

/**
 * Recompute labels for every registry item (1-based, in position order),
 * mirror them onto Document.annexureLabel, and update live references
 * (<span data-annexure-id="<docId>">…</span>) in traverse rows and drafts.
 */
export async function renumberAnnexures(matterId: string): Promise<void> {
  const matter = await prisma.matter.findUnique({ where: { id: matterId } });
  if (!matter) return;
  const prefix = derivePrefix(matter);

  const items = await prisma.annexureItem.findMany({
    where: { matterId },
    orderBy: { position: "asc" },
  });

  const labelByDoc = new Map<string, string>();
  for (let i = 0; i < items.length; i++) {
    const label = labelFor(prefix, i + 1);
    labelByDoc.set(items[i].documentId, label);
    await prisma.annexureItem.update({
      where: { id: items[i].id },
      data: { position: i + 1 },
    });
    await prisma.document.updateMany({
      where: { id: items[i].documentId },
      data: { annexureLabel: label },
    });
  }

  // Clear labels on documents no longer in the registry.
  await prisma.document.updateMany({
    where: { matterId, id: { notIn: items.map((i) => i.documentId) }, annexureLabel: { not: null } },
    data: { annexureLabel: null },
  });

  // Rewrite live references in stored rich text.
  const rewrite = (html: string): string => {
    let out = html;
    labelByDoc.forEach((label, docId) => {
      out = out.replace(
        new RegExp(`(<span[^>]*data-annexure-id="${docId}"[^>]*>)([^<]*)(</span>)`, "g"),
        `$1${label}$3`
      );
    });
    return out;
  };

  const sheet = await prisma.traverseSheet.findUnique({
    where: { matterId },
    include: { rows: { select: { id: true, responseText: true } } },
  });
  for (const row of sheet?.rows ?? []) {
    if (!row.responseText.includes("data-annexure-id")) continue;
    const next = rewrite(row.responseText);
    if (next !== row.responseText) {
      await prisma.traverseRow.update({ where: { id: row.id }, data: { responseText: next } });
    }
  }

  const artefacts = await prisma.generatedArtefact.findMany({
    where: { matterId },
    select: { id: true, content: true },
  });
  for (const artefact of artefacts) {
    if (!artefact.content.includes("data-annexure-id")) continue;
    const next = rewrite(artefact.content);
    if (next !== artefact.content) {
      await prisma.generatedArtefact.update({
        where: { id: artefact.id },
        data: { content: next },
      });
    }
  }
}
