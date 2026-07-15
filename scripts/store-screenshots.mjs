// Capture 1280×800 Chrome Web Store screenshots with the real extension.
import { chromium } from "@playwright/test";
import path from "node:path";
import fs from "node:fs";
import { fileURLToPath } from "node:url";

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const EXT = path.join(ROOT, "extension");
const OUT = path.join(ROOT, "store", "screenshots");
fs.mkdirSync(OUT, { recursive: true });
const APP = process.env.APP || "http://localhost:3000";

const api = async (p, init) => {
  const res = await fetch(`${APP}${p}`, { headers: { "Content-Type": "application/json" }, ...init });
  if (!res.ok) throw new Error(`${p} -> ${res.status}`);
  return res.json();
};
const matter = (await api("/api/matters"))[0];
const { token } = await api("/api/tokens", {
  method: "POST",
  body: JSON.stringify({ name: "store-screenshots" }),
});

const context = await chromium.launchPersistentContext("", {
  channel: "chromium",
  headless: true,
  viewport: { width: 1280, height: 800 },
  deviceScaleFactor: 1,
  args: [`--disable-extensions-except=${EXT}`, `--load-extension=${EXT}`],
});

let [worker] = context.serviceWorkers();
if (!worker) worker = await context.waitForEvent("serviceworker", { timeout: 10000 });
const extId = new URL(worker.url()).host;
await worker.evaluate(
  (cfg) => chrome.storage.sync.set(cfg),
  { apiBase: APP, token, matterId: matter.id, explicitApiBase: true }
);

// 1 — popover over the demo judgment
const page = await context.newPage();
await page.goto(APP.replace("localhost", "127.0.0.1") + "/demo-judgment.html");
await page.waitForTimeout(600);
await page.evaluate(() => {
  const paras = document.querySelectorAll(".page p");
  const target = paras[2]; // the "settled law … admission" paragraph
  const range = document.createRange();
  range.selectNodeContents(target);
  const sel = window.getSelection();
  sel.removeAllRanges();
  sel.addRange(range);
  target.dispatchEvent(new MouseEvent("mouseup", { bubbles: true }));
});
await page.waitForTimeout(1200); // matters load into the popover
await page.screenshot({ path: path.join(OUT, "01-popover.png") });

// 2 — toolbar popup (natural size, composited to 1280×800 in post)
const popup = await context.newPage();
await popup.setViewportSize({ width: 320, height: 460 });
await popup.goto(`chrome-extension://${extId}/popup.html`);
await popup.waitForTimeout(1200);
await popup.fill("#note", "Check limitation for counter-claim — RA bills admitted, argue O8R5 on paras 4 and 7");
await popup.screenshot({ path: path.join(OUT, "02-popup-raw.png") });

// 3 — the card board in the app
const board = await context.newPage();
await board.goto(`${APP}/matters/${matter.id}/cards`);
await board.waitForTimeout(2500);
await board.screenshot({ path: path.join(OUT, "03-board.png") });

await context.close();
// cleanup the throwaway token
const tokens = await api("/api/tokens");
const t = tokens.find((x) => x.name === "store-screenshots" && !x.revokedAt);
if (t) await api(`/api/tokens/${t.id}`, { method: "DELETE" });
console.log("screenshots captured");
