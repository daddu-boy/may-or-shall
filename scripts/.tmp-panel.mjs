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

const widths = () => page.evaluate(() =>
  [...document.querySelectorAll('[data-testid="pdf-scroll"]')].map(e => Math.round(e.getBoundingClientRect().width)));
const overlap = () => page.evaluate(() => {
  const a = [...document.querySelectorAll("aside")].pop();
  const panes = [...document.querySelectorAll('[data-testid="pdf-scroll"]')];
  if (!a || !panes.length) return "n/a";
  const ar = a.getBoundingClientRect();
  return panes.some(p => p.getBoundingClientRect().right > ar.left + 2) ? "OVERLAPS" : "no overlap";
});
console.log("  panes:", await widths(), "|", await overlap());
await page.screenshot({ path: `${OUT}/panel-float.png` });

await page.locator('button[title^="Hide, so both documents"]').click();
await page.waitForTimeout(1200);
console.log("  after collapse:", await widths());
await page.waitForTimeout(600);
await page.screenshot({ path: `${OUT}/panel-button.png` });
const btn = page.locator('button[title="Show cards and links"]');
const bb = await btn.boundingBox();
console.log(`  trigger button: ${Math.round(bb.width)}x${Math.round(bb.height)} at top-right`);
await btn.click();
await page.waitForTimeout(1200);
console.log("  after reopen:  ", await widths());
await browser.close();
