import { detectParaMarkers, type ExtractedLine, type ParaMarker } from "./paraMap";

export interface ExtractionResult {
  pageCount: number;
  /** plain text per page, index 0 = page 1 */
  pageTexts: string[];
  paraMap: ParaMarker[];
  hasTextLayer: boolean;
}

interface TextItemLike {
  str: string;
  transform: number[];
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
  };
}
