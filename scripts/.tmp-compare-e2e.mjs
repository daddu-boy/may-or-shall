import { chromium } from "@playwright/test";
import fs from "node:fs";

const BASE = "https://app.mayorshall.com";
const PASSWORD = fs.readFileSync(process.argv[2], "utf8").trim();
const step = (m) => console.log("  " + m);

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1700, height: 1000 } });
await ctx.addInitScript(() => {
  try {
    localStorage.setItem("mos.tour.dashboard-v1", "1");
    localStorage.setItem("mos.tour.workspace-v1", "1");
  } catch {}
});
const page = await ctx.newPage();
const errs = [];
page.on("response", (r) => { if (r.status() >= 400) errs.push(`${r.status()} ${r.request().method()} ${r.url()}`); });

await page.goto(`${BASE}/demo-signin`);
await page.fill('input[name="email"]', "reviewer@mayorshall.com");
await page.fill('input[name="password"]', PASSWORD);
await page.click('button[type="submit"]');
await page.waitForURL(`${BASE}/`, { timeout: 30_000 });
const matterId = await page.evaluate(async () => (await (await fetch("/api/matters")).json())[0].id);

// clear any links from earlier probing so the count is meaningful
await page.evaluate(async (m) => {
  const links = await (await fetch(`/api/matters/${m}/links`)).json();
  for (const l of links) await fetch(`/api/links/${l.id}`, { method: "DELETE" });
}, matterId);

step("hard load of /compare (this was the 500)");
const resp = await page.goto(`${BASE}/matters/${matterId}/compare`, { waitUntil: "domcontentloaded" });
step(`   status ${resp.status()}`);
await page.waitForTimeout(7000);

// make one card in each pane
const makeCard = async (paneIndex, chip) => {
  const text = await page.evaluate((i) => {
    const scroll = document.querySelectorAll('[data-testid="pdf-scroll"]')[i];
    const span = [...scroll.querySelectorAll(".textLayer span")].find(
      (s) => (s.textContent || "").trim().length > 25
    );
    if (!span) return null;
    const r = document.createRange();
    r.selectNodeContents(span);
    const sel = window.getSelection();
    sel.removeAllRanges();
    sel.addRange(r);
    span.dispatchEvent(new MouseEvent("mouseup", { bubbles: true }));
    return (span.textContent || "").slice(0, 40);
  }, paneIndex);
  await page.waitForTimeout(900);
  await page.getByTestId(`chip-${chip}`).first().click();
  await page.waitForTimeout(2500);
  return text;
};

step("create a card in the LEFT pane");
step(`   "${await makeCard(0, "FACT")}"`);
step("create a card in the RIGHT pane");
step(`   "${await makeCard(1, "EVIDENCE")}"`);

const railCounts = await page.evaluate(() =>
  [...document.body.innerText.matchAll(/Cards here \((\d+)\)/g)].map((m) => m[1])
);
step(`rails now hold: ${JSON.stringify(railCounts)} cards`);

step("pick one card from each rail");
const rails = page.locator("div", { hasText: /^Cards here/ });
const cardButtons = page.locator("button", { hasText: /p\.\d/ });
const n = await cardButtons.count();
step(`   ${n} pickable cards on screen`);
await cardButtons.nth(0).click();
await cardButtons.nth(n - 1).click();
await page.waitForTimeout(400);

const linkBtn = page.getByRole("button", { name: "Link these" });
step(`   "Link these" enabled: ${await linkBtn.isEnabled()}`);
await linkBtn.click();
await page.waitForTimeout(2500);

const links = await page.evaluate(
  async (m) => (await (await fetch(`/api/matters/${m}/links`)).json()).length,
  matterId
);
step(`LINKS IN MATTER: ${links}`);

await page.screenshot({ path: process.argv[3] });
console.log(errs.length ? "  HTTP errors: " + errs.slice(0, 4).join(" | ") : "  no HTTP errors");
await browser.close();
