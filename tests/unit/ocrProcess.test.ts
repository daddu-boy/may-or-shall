import test from "node:test";
import assert from "node:assert/strict";
import { executeOcr } from "../../src/lib/pdf/ocrProcess";

test("OCR subprocess completes and rejects failures", async () => {
  await executeOcr(process.execPath, ["-e", "process.exit(0)"], 2000);
  await assert.rejects(executeOcr(process.execPath, ["-e", "process.exit(3)"], 2000), /could not process/);
});
test("missing executable retains ENOENT for the installation warning", async () => {
  await assert.rejects(executeOcr("/nonexistent/mos-ocr", [], 2000), { code: "ENOENT" });
});
test("OCR subprocess has a hard wall-clock deadline", async () => {
  await assert.rejects(executeOcr(process.execPath, ["-e", "setInterval(() => {}, 1000)"], 100), /time limit/);
});
