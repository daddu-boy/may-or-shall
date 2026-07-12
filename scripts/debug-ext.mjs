import { chromium } from "@playwright/test";
const EXT = "/Users/sidharthkapoor/Desktop/Desktop/may-or-shall/extension";
const context = await chromium.launchPersistentContext("", {
  channel: "chromium", headless: true,
  args: [`--disable-extensions-except=${EXT}`, `--load-extension=${EXT}`],
});
let [worker] = context.serviceWorkers();
if (!worker) worker = await context.waitForEvent("serviceworker", { timeout: 10000 });
// call the worker's own functions directly
const cfg = await worker.evaluate(() => getConfig());
console.log("config:", JSON.stringify(cfg));
await worker.evaluate(() => chrome.storage.sync.set({ apiBase: "http://localhost:3000", explicitApiBase: true }));
const cfg2 = await worker.evaluate(() => getConfig());
console.log("config after explicit set:", JSON.stringify(cfg2));
const state = await worker.evaluate(() => getState());
console.log("state:", JSON.stringify(state).slice(0, 300));
await context.close();
