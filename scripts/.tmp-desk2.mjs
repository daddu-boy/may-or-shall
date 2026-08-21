import { chromium } from "@playwright/test";
import fs from "node:fs";
const BASE = "https://app.mayorshall.com";
const PW = fs.readFileSync(process.argv[2], "utf8").trim();
const OUT = process.argv[3];

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1600, height: 1000 }, deviceScaleFactor: 2 });
await ctx.addInitScript(() => { try { localStorage.setItem("mos.tour.dashboard-v1","1"); localStorage.setItem("mos.tour.workspace-v1","1"); } catch {} });
const page = await ctx.newPage();
await page.goto(`${BASE}/demo-signin`);
await page.fill('input[name="email"]', "reviewer@mayorshall.com");
await page.fill('input[name="password"]', PW);
await page.click('button[type="submit"]');
await page.waitForURL(`${BASE}/`, { timeout: 30_000 });
const m = await page.evaluate(async () => (await (await fetch("/api/matters")).json())[0].id);
await page.goto(`${BASE}/matters/${m}/compare`);
await page.waitForTimeout(7000);

// does clicking a card actually move the document?
const before = await page.evaluate(() => document.querySelectorAll('[data-testid="pdf-scroll"]')[0].scrollTop);
const go = page.locator('button[title="Go to this passage in the document"]');
const n = await go.count();
await go.nth(Math.min(6, n - 1)).click();
await page.waitForTimeout(2200);
const after = await page.evaluate(() => document.querySelectorAll('[data-testid="pdf-scroll"]')[0].scrollTop);
console.log(`  scroll moved on card click: ${before} -> ${after}  ${after !== before ? "YES" : "NO"}`);

// splitter
const row = await page.evaluate(() => {
  const panes = [...document.querySelectorAll('[data-testid="pdf-scroll"]')].map(e => Math.round(e.getBoundingClientRect().width));
  return panes;
});
console.log("  pane widths before drag:", row);
const divider = page.locator('div[title^="Drag to resize"]');
const box = await divider.boundingBox();
await page.mouse.move(box.x + 1, box.y + 300);
await page.mouse.down();
await page.mouse.move(box.x + 260, box.y + 300, { steps: 12 });
await page.mouse.up();
await page.waitForTimeout(900);
console.log("  pane widths after drag:", await page.evaluate(() =>
  [...document.querySelectorAll('[data-testid="pdf-scroll"]')].map(e => Math.round(e.getBoundingClientRect().width))));

await page.screenshot({ path: `${OUT}/desk-split.png` });

// hide panel and sidebar for maximum width
await page.locator('button[title^="Hide, so both documents"]').click();
await page.locator('button[title="Hide the sidebar"]').click();
await page.waitForTimeout(1200);
console.log("  widths with panel and nav hidden:", await page.evaluate(() =>
  [...document.querySelectorAll('[data-testid="pdf-scroll"]')].map(e => Math.round(e.getBoundingClientRect().width))));
await page.screenshot({ path: `${OUT}/desk-wide.png` });
await browser.close();
