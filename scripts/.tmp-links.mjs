import { chromium } from "@playwright/test";
import fs from "node:fs";
const BASE = "https://app.mayorshall.com";
const PW = fs.readFileSync(process.argv[2], "utf8").trim();
const OUT = process.argv[3];
const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1500, height: 1000 }, deviceScaleFactor: 2 });
await ctx.addInitScript(() => { try { localStorage.setItem("mos.tour.dashboard-v1","1"); localStorage.setItem("mos.tour.workspace-v1","1"); } catch {} });
const page = await ctx.newPage();
const errs = [];
page.on("response", r => { if (r.status() >= 400) errs.push(`${r.status()} ${r.url()}`); });

await page.goto(`${BASE}/demo-signin`);
await page.fill('input[name="email"]', "reviewer@mayorshall.com");
await page.fill('input[name="password"]', PW);
await page.click('button[type="submit"]');
await page.waitForURL(`${BASE}/`, { timeout: 30_000 });
const m = await page.evaluate(async () => (await (await fetch("/api/matters")).json())[0].id);

await page.goto(`${BASE}/matters/${m}/cards?tab=links`);
await page.waitForTimeout(3500);
console.log("  Links tab present:", await page.getByRole("button", { name: "Links", exact: true }).count() > 0);
console.log("  links listed:", await page.locator("li.surface").count());

await page.getByRole("button", { name: "+ Add your own note" }).first().click();
await page.waitForTimeout(400);
const note = "This admission answers the plea in para 7 of the plaint.";
await page.locator("textarea").first().fill(note);
await page.getByRole("button", { name: "Save note" }).click();
await page.waitForTimeout(2500);

const shown = await page.evaluate(() => document.body.innerText.includes("This admission answers the plea in para 7"));
console.log("  note saved and shown prominently:", shown);

const persisted = await page.evaluate(async (mid) => {
  const l = await (await fetch(`/api/matters/${mid}/links`)).json();
  return l[0]?.note || "";
}, m);
console.log("  persisted on the server:", JSON.stringify(persisted.slice(0, 46)));
await page.screenshot({ path: `${OUT}/links-tab.png` });
console.log(errs.length ? "  HTTP errors: " + errs.slice(0,3).join(" | ") : "  no HTTP errors");
await browser.close();
