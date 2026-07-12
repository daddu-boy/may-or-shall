// End-to-end smoke test of the Web Clipper extension against the running app.
// Loads the unpacked extension in Chromium, configures it via its options page,
// selects text on a page, clicks a card-type chip in the popover, and verifies
// the card landed in the API.
import { chromium } from "@playwright/test";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const EXT = path.join(ROOT, "extension");
const APP = process.env.APP || "http://localhost:3000";
// different origin string for the same server, so the content script treats it
// as a foreign page (the popover is suppressed on the app's own origin)
const PAGE = (process.env.APP || "http://localhost:3000").replace("localhost", "127.0.0.1") + "/settings";

const api = async (pathname, init) => {
  const res = await fetch(`${APP}${pathname}`, {
    headers: { "Content-Type": "application/json" },
    ...init,
  });
  if (!res.ok) throw new Error(`${pathname} -> ${res.status}`);
  return res.json();
};

const matters = await api("/api/matters");
const matter = matters[0];
const { token } = await api("/api/tokens", {
  method: "POST",
  body: JSON.stringify({ name: "extension-e2e" }),
});

const context = await chromium.launchPersistentContext("", {
  channel: "chromium",
  headless: true,
  args: [`--disable-extensions-except=${EXT}`, `--load-extension=${EXT}`],
});

try {
  // find the extension id via its service worker
  let [worker] = context.serviceWorkers();
  if (!worker) worker = await context.waitForEvent("serviceworker", { timeout: 10000 });
  const extId = new URL(worker.url()).host;
  console.log("extension id:", extId);

  // configure via the options page
  const options = await context.newPage();
  await options.goto(`chrome-extension://${extId}/options.html`);
  await options.fill("#apiBase", APP);
  await options.fill("#token", token);
  await options.click("#save");
  await options.waitForFunction(
    () => document.getElementById("status").textContent.includes("Connected"),
    { timeout: 10000 }
  );
  // pick the matter explicitly
  await options.selectOption("#matter", matter.id);
  console.log("options configured:", await options.locator("#status").textContent());

  // visit a "foreign" page, select text, expect the popover
  const page = await context.newPage();
  await page.goto(PAGE);
  await page.waitForTimeout(800);
  const marker = `Clipped-by-extension-${Date.now()}`;
  await page.evaluate((text) => {
    const p = document.createElement("p");
    p.id = "clip-target";
    p.textContent = text;
    document.body.prepend(p);
    const range = document.createRange();
    range.selectNodeContents(p);
    const sel = window.getSelection();
    sel.removeAllRanges();
    sel.addRange(range);
    p.dispatchEvent(new MouseEvent("mouseup", { bubbles: true }));
  }, marker);

  const chip = page.locator("button", { hasText: "Admission" });
  await chip.waitFor({ state: "visible", timeout: 5000 });
  await chip.click();
  await page.locator("text=✓ Card saved").waitFor({ timeout: 10000 });
  console.log("popover saved a card");

  // verify through the API
  const cards = await api(`/api/matters/${matter.id}/cards`);
  const created = cards.find((c) => c.quote.includes(marker));
  if (!created) throw new Error("card not found via API");
  if (created.cardType !== "ADMISSION") throw new Error(`wrong type: ${created.cardType}`);
  if (!created.sourceUrl?.includes("127.0.0.1")) throw new Error(`bad sourceUrl: ${created.sourceUrl}`);
  console.log("card verified:", created.cardType, created.sourceUrl);

  // cleanup test card
  await api(`/api/cards/${created.id}`, { method: "DELETE" });
  console.log("EXTENSION E2E: PASS");
} finally {
  await context.close();
}
