import { chromium } from "@playwright/test";
import fs from "node:fs";
const BASE = "https://app.mayorshall.com";
const PASSWORD = fs.readFileSync(process.argv[2], "utf8").trim();
const OUT = process.argv[3];

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1500, height: 950 }, deviceScaleFactor: 2 });
await ctx.addInitScript(() => {
  try {
    localStorage.setItem("mos.tour.dashboard-v1", "1");
    localStorage.setItem("mos.tour.workspace-v1", "1");
  } catch {}
});
const page = await ctx.newPage();
await page.goto(`${BASE}/demo-signin`);
await page.fill('input[name="email"]', "reviewer@mayorshall.com");
await page.fill('input[name="password"]', PASSWORD);
await page.click('button[type="submit"]');
await page.waitForURL(`${BASE}/`, { timeout: 30_000 });
await page.waitForTimeout(1500);
await page.screenshot({ path: `${OUT}/dashboard.png` });

const m = await page.evaluate(async () => (await (await fetch("/api/matters")).json())[0].id);
await page.goto(`${BASE}/matters/${m}/cards`);
await page.waitForTimeout(3000);
await page.screenshot({ path: `${OUT}/cards.png` });
await browser.close();
console.log("shots written");
