import { chromium } from "@playwright/test";
import fs from "node:fs";

const BASE = "https://app.mayorshall.com";
const PASSWORD = fs.readFileSync(process.argv[2], "utf8").trim();

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1600, height: 1000 } });
await ctx.addInitScript(() => {
  // the onboarding tour renders a full screen overlay that swallows clicks
  try {
    localStorage.setItem("mos.tour.dashboard-v1", "1");
    localStorage.setItem("mos.tour.workspace-v1", "1");
  } catch {}
});
const page = await ctx.newPage();
const problems = [];
page.on("pageerror", (e) => problems.push("pageerror: " + e.message));
page.on("console", (m) => { if (m.type() === "error") problems.push("console: " + m.text().slice(0, 160)); });
page.on("response", async (r) => {
  if (r.status() >= 400) {
    let body = "";
    try { body = (await r.text()).slice(0, 300); } catch {}
    problems.push(`HTTP ${r.status()} ${r.request().method()} ${r.url()}\n      ${body}`);
  }
});

// sign in
await page.goto(`${BASE}/demo-signin`);
await page.fill('input[name="email"]', "reviewer@mayorshall.com");
await page.fill('input[name="password"]', PASSWORD);
await page.click('button[type="submit"]');
await page.waitForURL(`${BASE}/`, { timeout: 30_000 });

const matterId = await page.evaluate(async () => (await (await fetch("/api/matters")).json())[0].id);
console.log("matter:", matterId);

await page.goto(`${BASE}/matters/${matterId}/compare`);
await page.waitForTimeout(6000);

// how many readers rendered, and did their text layers load?
const state = await page.evaluate(() => ({
  canvases: document.querySelectorAll("canvas").length,
  textSpans: document.querySelectorAll(".textLayer span").length,
  scrolls: document.querySelectorAll('[data-testid="pdf-scroll"]').length,
  rails: [...document.querySelectorAll("div")].filter((d) => d.textContent?.startsWith("Cards here")).length,
}));
console.log("rendered:", JSON.stringify(state));

// select a sentence in the FIRST pane, exactly as the passing suite does
const selected = await page.evaluate(() => {
  const scroll = document.querySelectorAll('[data-testid="pdf-scroll"]')[0];
  if (!scroll) return "no scroll container";
  const span = [...scroll.querySelectorAll(".textLayer span")].find(
    (s) => (s.textContent || "").trim().length > 25
  );
  if (!span) return "no text span found";
  const range = document.createRange();
  range.selectNodeContents(span);
  const sel = window.getSelection();
  sel.removeAllRanges();
  sel.addRange(range);
  span.dispatchEvent(new MouseEvent("mouseup", { bubbles: true }));
  return (span.textContent || "").slice(0, 50);
});
console.log("selected:", selected);

await page.waitForTimeout(1200);
const popover = await page.locator('[data-testid="highlight-popover"]').count();
console.log("highlight popover visible:", popover > 0);

if (popover > 0) {
  await page.getByTestId("chip-FACT").first().click();
  await page.waitForTimeout(2500);
  const railCards = await page.evaluate(
    () => document.body.innerText.match(/Cards here \((\d+)\)/g)
  );
  console.log("rails after save:", railCards);
}

console.log(problems.length ? "PROBLEMS:\n  " + problems.slice(0, 6).join("\n  ") : "no page errors");
await page.screenshot({ path: process.argv[3], fullPage: false });
await browser.close();
