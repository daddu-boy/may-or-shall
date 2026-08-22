import { chromium } from "@playwright/test";
import fs from "node:fs";
const BASE = "https://app.mayorshall.com";
const PW = fs.readFileSync(process.argv[2], "utf8").trim();
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

const zoom = () => page.locator('[data-testid="zoom-input"]').first().inputValue();
const pageW = () => page.evaluate(() => Math.round(document.querySelector("canvas").getBoundingClientRect().width));
const paneW = () => page.evaluate(() => Math.round(document.querySelectorAll('[data-testid="pdf-scroll"]')[0].clientWidth));

console.log(`  on load     zoom=${await zoom()}  page=${await pageW()}px in a ${await paneW()}px pane`);

const divider = page.locator('div[title^="Drag to resize"]');
const box = await divider.boundingBox();
await page.mouse.move(box.x + 1, box.y + 300);
await page.mouse.down();
await page.mouse.move(box.x + 300, box.y + 300, { steps: 12 });
await page.mouse.up();
await page.waitForTimeout(1500);
console.log(`  after drag  zoom=${await zoom()}  page=${await pageW()}px in a ${await paneW()}px pane`);

const zi = page.locator('[data-testid="zoom-input"]').first();
await zi.click();
await page.waitForTimeout(200);
console.log(`  after focus value=${await zi.inputValue()}`);
await zi.type("140", { delay: 60 });
console.log(`  typed value=${await zi.inputValue()}`);
await zi.press("Enter");
await page.waitForTimeout(1800);
const fitActive = await page.evaluate(() => {
  const b = document.querySelector('[data-testid="zoom-fit"]');
  return getComputedStyle(b).backgroundColor;
});
console.log(`  after enter zoom=${await zoom()}  page=${await pageW()}px  fitPill=${fitActive}`);

await page.locator('[data-testid="zoom-fit"]').first().click();
await page.waitForTimeout(1500);
console.log(`  pressed Fit zoom=${await zoom()}  page=${await pageW()}px in a ${await paneW()}px pane`);
await browser.close();
