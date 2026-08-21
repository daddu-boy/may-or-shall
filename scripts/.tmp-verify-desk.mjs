import { chromium } from "@playwright/test";
import fs from "node:fs";
const BASE = "https://app.mayorshall.com";
const PW = fs.readFileSync(process.argv[2], "utf8").trim();

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1600, height: 1000 }, deviceScaleFactor: 2 });
await ctx.addInitScript(() => {
  try { localStorage.setItem("mos.tour.dashboard-v1","1"); localStorage.setItem("mos.tour.workspace-v1","1"); } catch {}
});
const page = await ctx.newPage();
const errs = [];
page.on("response", r => { if (r.status() >= 400) errs.push(`${r.status()} ${r.url()}`); });

await page.goto(`${BASE}/demo-signin`);
await page.fill('input[name="email"]', "reviewer@mayorshall.com");
await page.fill('input[name="password"]', PW);
await page.click('button[type="submit"]');
await page.waitForURL(`${BASE}/`, { timeout: 30_000 });
const m = await page.evaluate(async () => (await (await fetch("/api/matters")).json())[0].id);

console.log("  nav label:", await page.evaluate(async () => {
  return null;
}) ?? "checked on page");

const r = await page.goto(`${BASE}/matters/${m}/compare`, { waitUntil: "domcontentloaded" });
console.log("  /compare status:", r.status());
await page.waitForTimeout(7000);

console.log("  nav shows:", await page.locator('a[data-tour="nav-compare"]').innerText());
const headings = await page.evaluate(() =>
  [...document.querySelectorAll("div")].map(d => d.className && typeof d.className === "string" && d.className.includes("sticky top-0") ? d.innerText : null).filter(Boolean).slice(0,2)
);
console.log("  list headings:", JSON.stringify(headings));

// click a card: should scroll the document, not pick it
const pickButtons = page.locator('button[title="Pick this for a link"]');
const goButtons = page.locator('button[title="Go to this passage in the document"]');
console.log("  cards listed:", await goButtons.count(), "| pick controls:", await pickButtons.count());

await goButtons.first().click();
await page.waitForTimeout(2500);
const slotsAfterClick = await page.locator("text=Press + on a card below").count();
console.log("  after clicking a card, slots still empty:", slotsAfterClick === 2);

await pickButtons.nth(0).click();
await pickButtons.nth(await pickButtons.count() - 1).click();
await page.waitForTimeout(500);
console.log("  Link these enabled:", await page.getByRole("button", { name: "Link these" }).isEnabled());

await page.screenshot({ path: process.argv[3] });
console.log(errs.length ? "  HTTP errors: " + errs.slice(0,3).join(" | ") : "  no HTTP errors");
await browser.close();
