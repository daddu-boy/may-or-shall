// Proves the "just download both" story: a fresh, UNCONFIGURED extension
// auto-detects a May or Shall server that speaks http (the desktop app),
// with no options set, and clips a card into it.
//
// Requires a server answering on http://localhost:3000 (the running desktop app).
import { chromium } from "@playwright/test";

const EXT = "/Users/sidharthkapoor/Desktop/Desktop/may-or-shall/extension";
const APP = "http://localhost:3000";

const api = async (p, init) => {
  const res = await fetch(`${APP}${p}`, { headers: { "Content-Type": "application/json" }, ...init });
  if (!res.ok) throw new Error(`${p} -> ${res.status}`);
  return res.json();
};
const matter = (await api("/api/matters"))[0];
if (!matter) throw new Error("no matter in the desktop app — create one first");

const context = await chromium.launchPersistentContext("", {
  channel: "chromium", headless: true,
  args: [`--disable-extensions-except=${EXT}`, `--load-extension=${EXT}`],
});
try {
  let [w] = context.serviceWorkers();
  if (!w) w = await context.waitForEvent("serviceworker", { timeout: 10000 });
  const extId = new URL(w.url()).host;
  console.log("extension id:", extId, "(nothing configured — must auto-detect http)");

  // popup with ZERO configuration: should auto-detect the http server
  const popup = await context.newPage();
  await popup.goto(`chrome-extension://${extId}/popup.html`);
  await popup.waitForFunction(
    () => /Connected/.test(document.getElementById("status").textContent),
    { timeout: 15000 }
  );
  const status = await popup.locator("#status").textContent();
  console.log("popup:", status.trim());
  const matters = await popup.locator("#matter option").allTextContents();
  if (!matters.some((t) => t.includes(matter.title)))
    throw new Error("auto-detected server but matter missing: " + matters.join(" | "));
  console.log("auto-detected the desktop app over http, matters listed ✓");

  // clip a card via the selection popover on a foreign page
  const page = await context.newPage();
  await page.goto("https://example.com");
  const marker = `Desktop-connect-${Math.floor(performance.now())}`;
  await page.evaluate((text) => {
    const p = document.createElement("p");
    p.textContent = text;
    document.body.prepend(p);
    const r = document.createRange(); r.selectNodeContents(p);
    const s = window.getSelection(); s.removeAllRanges(); s.addRange(r);
    p.dispatchEvent(new MouseEvent("mouseup", { bubbles: true }));
  }, marker);
  const chip = page.locator("button", { hasText: "Admission" });
  await chip.waitFor({ state: "visible", timeout: 5000 });
  await chip.click();
  await page.locator("text=✓ Card saved").waitFor({ timeout: 10000 });

  const cards = await api(`/api/matters/${matter.id}/cards`);
  const created = cards.find((c) => c.quote.includes(marker));
  if (!created) throw new Error("card not found in desktop app via API");
  await api(`/api/cards/${created.id}`, { method: "DELETE" });
  console.log("clipped a card into the desktop app, verified via its API ✓");

  console.log("DESKTOP + EXTENSION (zero config): PASS");
} finally {
  await context.close();
}
