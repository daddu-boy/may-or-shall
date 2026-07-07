import {
  PDFDocument,
  PDFHexString,
  PDFName,
  StandardFonts,
  rgb,
} from "pdf-lib";
import { prisma } from "./db";
import { storage } from "./storage";

/**
 * Convenience compilation builder (PRD F7): a single PDF with a generated
 * index page whose page numbers match the continuous pagination stamped on
 * every page, plus PDF bookmarks per document.
 */

export interface CompilationSource {
  documentId: string;
  /** 1-based page numbers to include; null = full document */
  pages: number[] | null;
}

const A4 = { w: 595.28, h: 841.89 };
const INDEX_ROWS_PER_PAGE = 22;

export async function buildCompilation(opts: {
  matterTitle: string;
  sources: CompilationSource[];
}): Promise<Uint8Array> {
  // Load source documents and resolve their selected pages.
  const resolved: { filename: string; src: PDFDocument; indices: number[] }[] = [];
  for (const source of opts.sources) {
    const doc = await prisma.document.findUnique({ where: { id: source.documentId } });
    if (!doc || !doc.storagePath) continue;
    const bytes = await storage.get(doc.storagePath);
    const src = await PDFDocument.load(new Uint8Array(bytes));
    const total = src.getPageCount();
    const indices = (
      source.pages
        ? [...new Set(source.pages)].filter((p) => p >= 1 && p <= total).sort((a, b) => a - b)
        : Array.from({ length: total }, (_, i) => i + 1)
    ).map((p) => p - 1);
    if (indices.length > 0) resolved.push({ filename: doc.filename, src, indices });
  }
  if (resolved.length === 0) throw new Error("No pages resolved for compilation");

  const indexPageCount = Math.max(1, Math.ceil(resolved.length / INDEX_ROWS_PER_PAGE));

  // Continuous pagination: index pages come first, then content.
  let cursor = indexPageCount + 1;
  const ranges = resolved.map((r) => {
    const from = cursor;
    cursor += r.indices.length;
    return { ...r, from, to: cursor - 1 };
  });
  const totalPages = cursor - 1;

  const out = await PDFDocument.create();
  const font = await out.embedFont(StandardFonts.TimesRoman);
  const bold = await out.embedFont(StandardFonts.TimesRomanBold);

  // Index pages first so their positions match the stamped numbering.
  for (let i = 0; i < indexPageCount; i++) {
    const page = out.addPage([A4.w, A4.h]);
    let y = A4.h - 80;
    if (i === 0) {
      page.drawText("CONVENIENCE COMPILATION", {
        x: 72, y, size: 15, font: bold,
      });
      y -= 22;
      page.drawText(opts.matterTitle.slice(0, 90), { x: 72, y, size: 11, font });
      y -= 34;
      page.drawText("INDEX", { x: 72, y, size: 13, font: bold });
      y -= 26;
    }
    const rows = ranges.slice(i * INDEX_ROWS_PER_PAGE, (i + 1) * INDEX_ROWS_PER_PAGE);
    rows.forEach((row, j) => {
      const n = i * INDEX_ROWS_PER_PAGE + j + 1;
      const name = row.filename.replace(/\.pdf$/i, "");
      const label = `${n}. ${name.length > 62 ? `${name.slice(0, 62)}…` : name}`;
      const pages = row.from === row.to ? `p. ${row.from}` : `pp. ${row.from}–${row.to}`;
      page.drawText(label, { x: 72, y, size: 11, font });
      page.drawText(pages, { x: A4.w - 72 - font.widthOfTextAtSize(pages, 11), y, size: 11, font });
      y -= 24;
    });
  }

  // Copy content pages document by document, remembering each doc's first page.
  const firstPageIndexOf: number[] = [];
  for (const range of ranges) {
    firstPageIndexOf.push(out.getPageCount());
    const copied = await out.copyPages(range.src, range.indices);
    copied.forEach((p) => out.addPage(p));
  }

  // Stamp continuous pagination on every page, index included.
  const pages = out.getPages();
  pages.forEach((page, i) => {
    const text = `Page ${i + 1} of ${totalPages}`;
    const w = font.widthOfTextAtSize(text, 10);
    page.drawText(text, {
      x: (page.getWidth() - w) / 2,
      y: 24,
      size: 10,
      font,
      color: rgb(0.25, 0.25, 0.25),
    });
  });

  // Bookmarks: one outline item per document (pdf-lib has no high-level API,
  // so build the outline dictionary directly).
  const ctx = out.context;
  const outlinesRef = ctx.nextRef();
  const itemRefs = ranges.map(() => ctx.nextRef());
  ranges.forEach((range, i) => {
    const pageRef = out.getPage(firstPageIndexOf[i]).ref;
    const dict = ctx.obj({
      Title: PDFHexString.fromText(range.filename.replace(/\.pdf$/i, "")),
      Parent: outlinesRef,
      Dest: [pageRef, PDFName.of("XYZ"), null, null, null],
    });
    if (i > 0) dict.set(PDFName.of("Prev"), itemRefs[i - 1]);
    if (i < ranges.length - 1) dict.set(PDFName.of("Next"), itemRefs[i + 1]);
    ctx.assign(itemRefs[i], dict);
  });
  ctx.assign(
    outlinesRef,
    ctx.obj({
      Type: PDFName.of("Outlines"),
      First: itemRefs[0],
      Last: itemRefs[itemRefs.length - 1],
      Count: itemRefs.length,
    })
  );
  out.catalog.set(PDFName.of("Outlines"), outlinesRef);
  out.catalog.set(PDFName.of("PageMode"), PDFName.of("UseOutlines"));

  return out.save();
}

/**
 * Resolve cards → document page ranges (PRD F7): the set of documents and
 * pages referenced by the selected cards, optionally expanded by N context
 * pages, or the full documents.
 */
export function resolveSources(
  cards: { documentId: string | null; page: number | null }[],
  opts: { scope: "full" | "cited"; contextPages: number },
  pageCountByDoc: Map<string, number>
): CompilationSource[] {
  const byDoc = new Map<string, Set<number>>();
  for (const card of cards) {
    if (!card.documentId) continue;
    if (!byDoc.has(card.documentId)) byDoc.set(card.documentId, new Set());
    if (card.page) byDoc.get(card.documentId)!.add(card.page);
  }

  return [...byDoc.entries()].map(([documentId, pages]) => {
    if (opts.scope === "full" || pages.size === 0) return { documentId, pages: null };
    const total = pageCountByDoc.get(documentId) ?? Number.MAX_SAFE_INTEGER;
    const expanded = new Set<number>();
    pages.forEach((p) => {
      for (let q = p - opts.contextPages; q <= p + opts.contextPages; q++) {
        if (q >= 1 && q <= total) expanded.add(q);
      }
    });
    return { documentId, pages: [...expanded].sort((a, b) => a - b) };
  });
}
