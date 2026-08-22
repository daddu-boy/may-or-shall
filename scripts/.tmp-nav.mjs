import { chromium } from "@playwright/test";
import fs from "node:fs";
const BASE = "https://app.mayorshall.com";
const PW = fs.readFileSync(process.argv[2], "utf8").trim();
const OUT = process.argv[3];
const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1400, height: 1000 }, deviceScaleFactor: 2 });
await ctx.addInitScript(() => { try { localStorage.setItem("mos.tour.dashboard-v1","1"); localStorage.setItem("mos.tour.workspace-v1","1"); } catch {} });
const page = await ctx.newPage();
await page.goto(`${BASE}/demo-signin`);
await page.fill('input[name="email"]', "reviewer@mayorshall.com");
await page.fill('input[name="password"]', PW);
await page.click('button[type="submit"]');
await page.waitForURL(`${BASE}/`, { timeout: 30_000 });
const m = await page.evaluate(async () => (await (await fetch("/api/matters")).json())[0].id);

await page.goto(`${BASE}/matters/${m}/cards?tab=links`);
await page.waitForTimeout(3000);
console.log("  sidebar:");
console.log((await page.locator("nav").innerText()).split("\n").filter(Boolean).map(l => "    " + l).join("\n"));

// every renamed item still routes
for (const slug of ["documents","compare","cards","chronology","drafts","compilation","annexures","traverse"]) {
  const r = await page.goto(`${BASE}/matters/${m}/${slug}`, { waitUntil: "domcontentloaded" });
  process.stdout.write(`  ${slug}:${r.status()} `);
}
console.log();

// exports
for (const [fmt, label] of [["", "docx"], ["?format=pdf", "pdf"]]) {
  const r = await page.request.get(`${BASE}/api/matters/${m}/exports/links${fmt}`);
  const buf = await r.body();
  console.log(`  links export ${label}: HTTP ${r.status()} ${r.headers()["content-type"].split(";")[0]} ${buf.length} bytes`);
  fs.writeFileSync(`${OUT}/Links.${label === "pdf" ? "pdf" : "docx"}`, buf);
}
await page.goto(`${BASE}/matters/${m}/cards?tab=links`);
await page.waitForTimeout(2500);
await page.screenshot({ path: `${OUT}/nav.png` });
await browser.close();
