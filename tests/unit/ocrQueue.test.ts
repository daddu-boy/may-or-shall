import test from "node:test";
import assert from "node:assert/strict";
import { preparePdf, runOcr, ocrLoad, OcrBusyError } from "../../src/lib/pdf/ocr";
import type { ExtractionResult } from "../../src/lib/pdf/extract";

const scan = (): ExtractionResult => ({
  pageCount: 1, pageTexts: [""], paraMap: [], hasTextLayer: false, highlights: [],
});

/**
 * The point of the queue: a second person uploading while a first is still
 * being recognised should wait their turn, not be told the server is busy.
 */
test("more than one document can be recognised at a time", async () => {
  assert.ok(ocrLoad().slots >= 2, "at least two run concurrently by default");
});

test("both concurrent calls are attempted, neither is refused outright", async () => {
  // the binary is absent here, so each reaches the subprocess and fails ENOENT;
  // what matters is that both were admitted rather than one rejected as busy
  const outcomes = await Promise.allSettled([
    runOcr(Buffer.from("a")),
    runOcr(Buffer.from("b")),
  ]);
  assert.equal(outcomes.length, 2);
  for (const o of outcomes) {
    assert.equal(o.status, "rejected");
    assert.ok(!((o as PromiseRejectedResult).reason instanceof OcrBusyError),
      "neither was turned away for being busy");
  }
  assert.equal(ocrLoad().inFlight, 0, "slots are handed back afterwards");
});

test("a full queue keeps the original rather than failing the upload", async () => {
  const prepared = await preparePdf(Buffer.from("pdf"), {
    extract: async () => scan(),
    ocr: async () => { throw new OcrBusyError(); },
  });
  assert.equal(prepared.report.ocr, "busy");
  assert.equal(prepared.data.toString(), "pdf", "the upload still keeps the file");
  assert.match(prepared.report.message, /Retry OCR/);
});
