// Verifies the two disconnected states:
//  A. fresh install (nothing configured, auto-detect finds no server) -> welcome guidance
//  B. explicitly configured server that is down -> red error + Open-the-app/Retry
//
// PRECONDITION: nothing may be listening on localhost:3000 (http or https),
// so auto-detection genuinely fails for state A.
import { chromium } from "@playwright/test";

const EXT = "/Users/sidharthkapoor/Desktop/Desktop/may-or-shall/extension";
const DEAD = "https://localhost:9443"; // nothing listens here

const context = await chromium.launchPersistentContext("", {
  channel: "chromium", headless: true,
  args: [`--disable-extensions-except=${EXT}`, `--load-extension=${EXT}`],
});
try {
  let [w] = context.serviceWorkers();
  if (!w) w = await context.waitForEvent("serviceworker", { timeout: 10000 });
  const extId = new URL(w.url()).host;

  // A: fresh install — nothing configured at all; auto-detect probes the
  // localhost candidates, finds nothing, and the popup should welcome, not alarm
  const p1 = await context.newPage();
  await p1.goto(`chrome-extension://${extId}/popup.html`);
  await p1.locator("#welcome").waitFor({ state: "visible", timeout: 15000 });
  const welcomeText = await p1.locator("#welcome").textContent();
  if (!/connect your app/i.test(welcomeText)) throw new Error("welcome text wrong");
  const errShown = await p1.locator("#fixrow").isVisible();
  if (errShown) throw new Error("fixrow visible in first-run state");
  console.log("A fresh install: welcome guidance shown, no error UI ✓");

  // popover on a page, same state
  const page = await context.newPage();
  await page.goto("https://example.com");
  await page.evaluate(() => {
    const p = document.createElement("p");
    p.textContent = "Some passage to select for the clipper.";
    document.body.prepend(p);
    const r = document.createRange(); r.selectNodeContents(p);
    const s = window.getSelection(); s.removeAllRanges(); s.addRange(r);
    p.dispatchEvent(new MouseEvent("mouseup", { bubbles: true }));
  });
  await page.waitForTimeout(1500);
  const popText = await page.evaluate(() => {
    const host = [...document.querySelectorAll("div")].find((d) => d.shadowRoot);
    return host ? host.shadowRoot.textContent : "";
  });
  if (!/Almost there/.test(popText)) throw new Error("popover missing setup guidance: " + popText.slice(0, 120));
  if (!/Setup guide/.test(popText)) throw new Error("popover missing guide link");
  console.log("A popover: setup guidance shown ✓");

  // B: explicitly configured (explicitApiBase) but server down -> real error UI
  await w.evaluate((dead) =>
    chrome.storage.sync.set({ apiBase: dead, explicitApiBase: true }), DEAD);
  const p2 = await context.newPage();
  await p2.goto(`chrome-extension://${extId}/popup.html`);
  await p2.locator("#fixrow").waitFor({ state: "visible", timeout: 15000 });
  const status = await p2.locator("#status").textContent();
  if (!/Can't reach|Timed out/.test(status)) throw new Error("expected error text, got: " + status);
  const welcomeShown = await p2.locator("#welcome").isVisible();
  if (welcomeShown) throw new Error("welcome visible in configured-error state");
  console.log("B configured-but-down: error + recovery buttons ✓");

  console.log("FIRST-RUN UX: PASS");
} finally {
  await context.close();
}
