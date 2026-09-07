import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { extractPdf, type ExtractionResult } from "./extract";

import { executeOcr } from "./ocrProcess";

export const MAX_PDF_BYTES = 50 * 1024 * 1024;
export const MAX_PDF_PAGES = 500;
export const MAX_OCR_PAGES = 100;
export interface ExtractionReport {
  ocr: "not_needed" | "completed" | "unavailable" | "failed" | "limited" | "busy";
  ocrPages: number[];
  warningPages: number[];
  message: string;
}

export function sparsePages(texts: string[]): number[] {
  return texts.flatMap((text, i) => text.replace(/\s/g, "").length < 20 ? [i + 1] : []);
}

// The subprocess never invokes a shell. OCR runs locally with bounded CPU/time and
// private temporary files; document contents are never sent to a third party.
/**
 * OCR is CPU bound, so it runs a few at a time rather than one at a time or
 * all at once. A second person uploading while the first is being recognised
 * waits their turn instead of being told the server is busy, and only if the
 * queue is genuinely long does the upload fall back to keeping the original.
 *
 * This is per process. It bounds this container's CPU, which is what matters
 * on a single instance; a second instance would need a shared lock.
 */
const OCR_SLOTS = Math.max(1, Number(process.env.OCR_CONCURRENCY) || 2);
const QUEUE_WAIT_MS = Math.max(1000, Number(process.env.OCR_QUEUE_WAIT_MS) || 90_000);

let inFlight = 0;
const waiting: (() => void)[] = [];

export class OcrBusyError extends Error {
  constructor() {
    super("OCR queue is full");
    this.name = "OcrBusyError";
  }
}

function releaseSlot() {
  inFlight--;
  const next = waiting.shift();
  if (next) next();
}

/** Wait for a slot, giving up after the queue wait so an upload never hangs. */
function takeSlot(): Promise<void> {
  if (inFlight < OCR_SLOTS) {
    inFlight++;
    return Promise.resolve();
  }
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      const i = waiting.indexOf(admit);
      if (i >= 0) waiting.splice(i, 1);
      reject(new OcrBusyError());
    }, QUEUE_WAIT_MS);
    const admit = () => {
      clearTimeout(timer);
      inFlight++;
      resolve();
    };
    waiting.push(admit);
  });
}

/** exported for tests and for a health view later */
export function ocrLoad() {
  return { inFlight, waiting: waiting.length, slots: OCR_SLOTS };
}

export async function runOcr(data: Buffer): Promise<Buffer> {
  await takeSlot();
  let dir: string | undefined;
  try {
    dir = await fs.mkdtemp(path.join(os.tmpdir(), "mos-ocr-"));
    const input = path.join(dir, "input.pdf");
    const output = path.join(dir, "output.pdf");
    await fs.writeFile(input, data, { mode: 0o600 });
    await executeOcr(process.env.OCRMYPDF_BIN || "ocrmypdf", [
      "--skip-text", "--output-type", "pdf", "--optimize", "0",
      "--jobs", "1", "--tesseract-timeout", "30", "--skip-big", "25",
      "--language", process.env.OCR_LANGUAGES || "eng", input, output,
    ]);
    const stat = await fs.stat(output);
    if (stat.size > MAX_PDF_BYTES * 3) throw new Error("OCR output exceeds size limit");
    return await fs.readFile(output);
  } finally {
    releaseSlot();
    if (dir) await fs.rm(dir, { recursive: true, force: true });
  }
}

export async function preparePdf(
  original: Buffer,
  dependencies = { extract: extractPdf, ocr: runOcr },
): Promise<{ data: Buffer; extraction: ExtractionResult; report: ExtractionReport }> {
  if (original.length > MAX_PDF_BYTES) throw new Error("PDF exceeds the 50 MB upload limit.");
  const extraction = await dependencies.extract(original, MAX_PDF_PAGES);
  const candidates = sparsePages(extraction.pageTexts);
  const report: ExtractionReport = {
    ocr: "not_needed", ocrPages: [], warningPages: candidates, message: "",
  };
  if (!candidates.length) return { data: original, extraction, report };
  if (candidates.length > MAX_OCR_PAGES) {
    report.ocr = "limited";
    report.message = "Automatic OCR is limited to 100 scanned pages per upload. Split the bundle into smaller PDFs and upload again.";
    return { data: original, extraction, report };
  }
  try {
    const data = await dependencies.ocr(original);
    const processed = await dependencies.extract(data, MAX_PDF_PAGES);
    if (processed.pageCount !== extraction.pageCount) throw new Error("OCR changed page count");
    report.ocrPages = candidates.filter((p) => processed.pageTexts[p - 1].trim() !== extraction.pageTexts[p - 1].trim());
    report.warningPages = sparsePages(processed.pageTexts);
    report.ocr = "completed";
    report.message = "OCR text can contain mistakes. Check quotations, dates and paragraph numbers against the page image. Pages with existing text are preserved; a scan with only a typed header may still need external OCR.";
    return { data, extraction: processed, report };
  } catch (error) {
    if (error instanceof OcrBusyError) {
      report.ocr = "busy";
      report.message =
        "Several documents are being recognised at once, so this one was saved without OCR. Press Retry OCR in a minute and it will be picked up.";
      return { data: original, extraction, report };
    }
    report.ocr = (error as NodeJS.ErrnoException).code === "ENOENT" ? "unavailable" : "failed";
    report.message = report.ocr === "unavailable"
      ? "OCR is not installed on this server. The original PDF is saved; contact the administrator to enable OCR, then retry."
      : "OCR could not finish. The original PDF is saved. Retry OCR or upload a smaller, unlocked PDF.";
    return { data: original, extraction, report };
  }
}
