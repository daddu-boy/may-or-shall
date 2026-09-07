import test from "node:test";
import assert from "node:assert/strict";
import { preparePdf, sparsePages, MAX_PDF_BYTES } from "../../src/lib/pdf/ocr";
import type { ExtractionResult } from "../../src/lib/pdf/extract";

const original = Buffer.from("original PDF");
const result = (pageTexts: string[]): ExtractionResult => ({ pageCount: pageTexts.length, pageTexts, paraMap: [], hasTextLayer: pageTexts.some(t => t.length >= 20), highlights: [] });
const native = "This native text page must remain available.";
test("mixed bundle detects sparse pages individually", () => assert.deepEqual(sparsePages([native, "", "  3 "]), [2, 3]));
test("native PDFs bypass OCR unchanged", async () => {
  const prepared = await preparePdf(original, { extract: async () => result([native]), ocr: async () => { throw new Error("must not run"); } });
  assert.equal(prepared.data, original);
  assert.equal(prepared.report.ocr, "not_needed");
});
test("mixed scan is re-extracted and unresolved pages remain flagged", async () => {
  const processed = Buffer.from("searchable PDF");
  const prepared = await preparePdf(original, { extract: async data => result(data === original ? [native, "", ""] : [native, "Recognized text on second page.", ""]), ocr: async () => processed });
  assert.equal(prepared.data, processed);
  assert.deepEqual(prepared.report.ocrPages, [2]);
  assert.deepEqual(prepared.report.warningPages, [3]);
});
test("unavailable engine and timeout preserve original with actionable warning", async () => {
  for (const error of [Object.assign(new Error(), { code: "ENOENT" }), new Error("timeout")]) {
    const prepared = await preparePdf(original, { extract: async () => result([""]), ocr: async () => { throw error; } });
    assert.equal(prepared.data, original);
    assert.ok(["unavailable", "failed"].includes(prepared.report.ocr));
    assert.ok(prepared.report.message.length);
  }
});
test("page count changes are rejected without replacing original", async () => {
  const prepared = await preparePdf(original, { extract: async data => result(data === original ? [""] : [native, native]), ocr: async () => Buffer.from("bad") });
  assert.equal(prepared.data, original);
  assert.equal(prepared.report.ocr, "failed");
});
test("oversized upload is rejected before extraction", async () => {
  await assert.rejects(preparePdf(Buffer.alloc(MAX_PDF_BYTES + 1), { extract: async () => { throw new Error("must not run"); }, ocr: async () => original }), /50 MB/);
});
test("large scan keeps its original without starting excessive OCR work", async () => {
  const prepared = await preparePdf(original, { extract: async () => result(Array(101).fill("")), ocr: async () => { throw new Error("must not run"); } });
  assert.equal(prepared.report.ocr, "limited");
});
