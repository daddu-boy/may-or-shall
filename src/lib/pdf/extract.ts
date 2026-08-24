import { detectParaMarkers, type ExtractedLine, type ParaMarker } from "./paraMap";

export interface HighlightRect {
  page: number;
  x: number;
  y: number;
  w: number;
  h: number;
}

/** A highlight somebody drew in another PDF reader, recovered from the file. */
export interface ExtractedHighlight {
  page: number;
  /** the words the highlight actually covers, in reading order */
  quote: string;
  /** whatever they typed on the highlight, if anything */
  note: string;
  rects: HighlightRect[];
}

export interface ExtractionResult {
  pageCount: number;
  /** plain text per page, index 0 = page 1 */
  pageTexts: string[];
  paraMap: ParaMarker[];
  hasTextLayer: boolean;
  highlights: ExtractedHighlight[];
}

interface TextItemLike {
  str: string;
  transform: number[];
  width?: number;
  height?: number;
}

interface Quad {
  left: number;
  right: number;
  bottom: number;
  top: number;
}

/**
 * A highlight's QuadPoints, one box per line it covers. The shape differs
 * between pdf.js versions and writers: a flat Float32Array of eights, an array
 * of arrays, or a list of {x, y} points. All three flatten to the same numbers.
 * If a writer omitted them entirely, the annotation's own rectangle stands in.
 */
function toQuads(quadPoints: unknown, rect: unknown): Quad[] {
  const flat: number[] = [];
  const push = (v: unknown) => {
    if (typeof v === "number") flat.push(v);
    else if (v && typeof v === "object" && typeof (v as { x?: number }).x === "number") {
      flat.push((v as { x: number }).x, (v as { y: number }).y);
    }
  };
  if (quadPoints && (Array.isArray(quadPoints) || ArrayBuffer.isView(quadPoints))) {
    for (const el of quadPoints as unknown[]) {
      if (Array.isArray(el) || ArrayBuffer.isView(el)) for (const v of el as unknown[]) push(v);
      else push(el);
    }
  }

  const quads: Quad[] = [];
  for (let i = 0; i + 7 < flat.length; i += 8) {
    const xs = [flat[i], flat[i + 2], flat[i + 4], flat[i + 6]];
    const ys = [flat[i + 1], flat[i + 3], flat[i + 5], flat[i + 7]];
    quads.push({
      left: Math.min(...xs),
      right: Math.max(...xs),
      bottom: Math.min(...ys),
      top: Math.max(...ys),
    });
  }

  if (quads.length === 0 && Array.isArray(rect) && rect.length === 4) {
    const r = rect as number[];
    quads.push({
      left: Math.min(r[0], r[2]),
      right: Math.max(r[0], r[2]),
      bottom: Math.min(r[1], r[3]),
      top: Math.max(r[1], r[3]),
    });
  }
  return quads;
}

/** Whatever the reader typed on the highlight, across pdf.js versions. */
function annotationNote(a: Record<string, unknown>): string {
  if (typeof a.contents === "string") return a.contents.trim();
  const obj = a.contentsObj as { str?: unknown } | undefined;
  if (obj && typeof obj.str === "string") return obj.str.trim();
  return "";
}

/**
 * The words a set of quads covers. A glyph run counts as covered when it
 * genuinely sits inside the box rather than merely touching it, because a
 * highlight drawn slightly tall would otherwise swallow the line above.
 */
function wordsUnder(items: TextItemLike[], quads: Quad[]): string {
  const picked: { x: number; y: number; str: string }[] = [];
  for (const item of items) {
    if (!item.str || !item.str.trim()) continue;
    const x = item.transform[4];
    const y = item.transform[5];
    const w = item.width ?? 0;
    const h = item.height ?? 0;
    for (const q of quads) {
      const vOverlap = Math.min(y + h, q.top) - Math.max(y, q.bottom);
      const hOverlap = Math.min(x + w, q.right) - Math.max(x, q.left);
      if (vOverlap <= 0 || hOverlap <= 0) continue;
      if (h > 0 && vOverlap < h * 0.35) continue;
      if (w > 0 && hOverlap < w * 0.35) continue;
      picked.push({ x, y, str: item.str });
      break;
    }
  }
  return picked
    .sort((a, b) => (Math.abs(a.y - b.y) > 3 ? b.y - a.y : a.x - b.x))
    .map((i) => i.str)
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Extract the text layer and paragraph map from a PDF using pdf.js (legacy
 * build, Node-safe). Scanned PDFs with no text layer are flagged so the UI
 * can warn that highlighting is limited to notes (OCR is out of scope for v1).
 */
export async function extractPdf(data: Buffer): Promise<ExtractionResult> {
  const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
  const loadingTask = pdfjs.getDocument({
    data: new Uint8Array(data),
    useSystemFonts: true,
  });
  const doc = await loadingTask.promise;

  const pageTexts: string[] = [];
  const allLines: ExtractedLine[][] = [];
  const highlights: ExtractedHighlight[] = [];

  for (let p = 1; p <= doc.numPages; p++) {
    const page = await doc.getPage(p);
    const viewport = page.getViewport({ scale: 1 });
    const content = await page.getTextContent();

    // Group items into lines by their y position (PDF origin is bottom-left).
    const buckets = new Map<number, { x: number; str: string }[]>();
    for (const item of content.items as TextItemLike[]) {
      if (!item.str || !item.str.trim()) continue;
      const x = item.transform[4];
      const y = item.transform[5];
      const key = Math.round(y / 3) * 3; // 3pt tolerance for same line
      if (!buckets.has(key)) buckets.set(key, []);
      buckets.get(key)!.push({ x, str: item.str });
    }

    const lines: ExtractedLine[] = [...buckets.entries()]
      .sort((a, b) => b[0] - a[0]) // top of page first
      .map(([y, items]) => {
        items.sort((a, b) => a.x - b.x);
        return {
          text: items.map((i) => i.str).join(" ").replace(/\s+/g, " ").trim(),
          x: Math.max(0, Math.min(1, items[0].x / viewport.width)),
          y: Math.max(0, Math.min(1, 1 - y / viewport.height)),
        };
      })
      .filter((l) => l.text.length > 0);

    /*
     * Highlights already in the file, drawn in Acrobat, Preview, LiquidText or
     * anything else that writes standard annotations. They are recovered here
     * so a bundle somebody has already read arrives with its markings intact.
     */
    const annots = (await page.getAnnotations().catch(() => [])) as Record<string, unknown>[];
    for (const a of annots) {
      if (a.subtype !== "Highlight") continue;
      const quads = toQuads(a.quadPoints, a.rect);
      if (quads.length === 0) continue;
      const quote = wordsUnder(content.items as TextItemLike[], quads);
      // a highlight over a scan covers no words: nothing to make a card from
      if (!quote) continue;
      highlights.push({
        page: p,
        quote,
        // pdf.js moved the typed note from `contents` to `contentsObj.str`,
        // and writers differ, so both are read
        note: annotationNote(a),
        rects: quads.map((q) => {
          const [x1, y1] = viewport.convertToViewportPoint(q.left, q.top);
          const [x2, y2] = viewport.convertToViewportPoint(q.right, q.bottom);
          return {
            page: p,
            x: Math.min(x1, x2) / viewport.width,
            y: Math.min(y1, y2) / viewport.height,
            w: Math.abs(x2 - x1) / viewport.width,
            h: Math.abs(y2 - y1) / viewport.height,
          };
        }),
      });
    }

    allLines.push(lines);
    pageTexts.push(lines.map((l) => l.text).join("\n"));
    page.cleanup();
  }

  const totalChars = pageTexts.reduce((n, t) => n + t.length, 0);
  const hasTextLayer = doc.numPages > 0 && totalChars / doc.numPages >= 20;

  const pageCount = doc.numPages;
  await loadingTask.destroy();

  return {
    pageCount,
    pageTexts,
    paraMap: detectParaMarkers(allLines),
    hasTextLayer,
    highlights,
  };
}
