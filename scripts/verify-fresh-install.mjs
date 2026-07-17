// Simulates a brand-new Chrome Web Store install of the published package:
// no options configured at all — defaults (https://localhost:3000, no token).
// The popup must connect, the popover must appear on selection and save a card.
import { chromium } from "@playwright/test";

const EXT = process.env.EXT; // path to the unzipped store package
const APP = "https://localhost:3000";
const PAGE = "https://127.0.0.1:3000/settings"; // foreign origin vs the app itself

const api = async (pathname, init) => {
  const res = await fetch(`${APP}${pathname}`, {
    headers: { "Content-Type": "application/json" },
    ...init,
  });
  if (!res.ok) throw new Error(`${pathname} -> ${res.status}`);
  return res.json();
};
const matter = (await api("/api/matters"))[0];

const context = await chromium.launchPersistentContext("", {
  channel: "chromium",
  headless: true,
  args: [`--disable-extensions-except=${EXT}`, `--load-extension=${EXT}`],
});

try {
  let [worker] = context.serviceWorkers();
  if (!worker) worker = await context.waitForEvent("serviceworker", { timeout: 10000 });
  const extId = new URL(worker.url()).host;
  console.log("extension id:", extId, "(fresh install, nothing configured)");

  // 1 — toolbar popup straight after install
  const popup = await context.newPage();
  await popup.goto(`chrome-extension://${extId}/popup.html`);
  await popup.waitForFunction(
    () => /Connected|Can.t reach|Cannot reach/.test(document.getElementById("status").textContent),
    { timeout: 12000 }
  );
  const popupStatus = await popup.locator("#status").textContent();
  console.log("popup status:", popupStatus.trim());
  if (!popupStatus.includes("Connected")) throw new Error("popup did not connect on defaults");
  const matterOptions = await popup.locator("#matter option").allTextContents();
  console.log("popup matters:", matterOptions.join(" | "));
  if (!matterOptions.some((t) => t.includes("New matter")))
    throw new Error("popup missing the New matter option");

  // 2 — selection popover on a foreign page, still zero-config
  const page = await context.newPage();
  await page.goto(PAGE);
  await page.waitForTimeout(800);
  const marker = `Fresh-install-clip-${Math.floor(performance.now())}`;
  await page.evaluate((text) => {
    const p = document.createElement("p");
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
  console.log("popover appeared and saved a card");

  const cards = await api(`/api/matters/${matter.id}/cards`);
  const created = cards.find((c) => c.quote.includes(marker));
  if (!created) throw new Error("card not found via API");
  await api(`/api/cards/${created.id}`, { method: "DELETE" });
  console.log("FRESH STORE INSTALL: PASS");
} finally {
  await context.close();
}
