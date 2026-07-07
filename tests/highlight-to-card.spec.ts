import { test, expect } from "@playwright/test";
import { deleteCardsContaining, getPlaintDoc, getSeedMatter } from "./helpers";

/**
 * PRD F2 acceptance: highlight → saved card in 2 clicks; highlights persist
 * and re-render after reload; the card deep-links back to the exact page.
 */
test("highlight text in the reader creates a card and a persistent highlight", async ({
  page,
  request,
}) => {
  const matter = await getSeedMatter(request);
  const doc = await getPlaintDoc(request, matter.id);
  await deleteCardsContaining(request, matter.id, "mobilised");

  await page.goto(`/matters/${matter.id}/documents/${doc.id}`);

  // Wait for the pdf.js text layer of page 1 to render.
  const textLayerSpan = page.locator("[data-pdf-page='1'] .textLayer span").first();
  await expect(textLayerSpan).toBeAttached({ timeout: 30_000 });

  const needle = "mobilised its resources";
  await page.waitForFunction(
    (n) =>
      [...document.querySelectorAll(".textLayer span")].some((s) =>
        (s.textContent || "").includes(n)
      ),
    needle,
    { timeout: 30_000 }
  );

  // Select the sentence programmatically and fire mouseup, as a user drag would.
  await page.evaluate((n) => {
    const span = [...document.querySelectorAll(".textLayer span")].find((s) =>
      (s.textContent || "").includes(n)
    )!;
    const range = document.createRange();
    range.selectNodeContents(span);
    const sel = window.getSelection()!;
    sel.removeAllRanges();
    sel.addRange(range);
    span.dispatchEvent(new MouseEvent("mouseup", { bubbles: true }));
  }, needle);

  // Popover appears; one click on a type chip saves the card.
  await expect(page.getByTestId("highlight-popover")).toBeVisible();
  await page.getByTestId("chip-FACT").click();

  // Card shows up in the right panel with its source chip.
  const newCard = page.getByTestId("panel-card").filter({ hasText: "mobilised" }).first();
  await expect(newCard).toBeVisible();
  await expect(newCard.getByTestId("source-chip")).toContainText("p.1");

  // Highlight persists and re-renders after reload (rects painted on the page).
  await page.reload();
  await expect(page.locator("[data-pdf-page='1'] [data-testid='highlight-rect']").first()).toBeVisible(
    { timeout: 30_000 }
  );
  await expect(page.getByTestId("panel-card").filter({ hasText: "mobilised" }).first()).toBeVisible();
});

test("a Date card created from a highlight appears in the chronology", async ({
  page,
  request,
}) => {
  const matter = await getSeedMatter(request);
  const doc = await getPlaintDoc(request, matter.id);

  await deleteCardsContaining(request, matter.id, "terminate the contract");
  await page.goto(`/matters/${matter.id}/documents/${doc.id}`);
  const needle = "terminate the contract";
  await page.waitForFunction(
    (n) =>
      [...document.querySelectorAll(".textLayer span")].some((s) =>
        (s.textContent || "").includes(n)
      ),
    needle,
    { timeout: 30_000 }
  );

  await page.evaluate((n) => {
    const span = [...document.querySelectorAll(".textLayer span")].find((s) =>
      (s.textContent || "").includes(n)
    )!;
    const range = document.createRange();
    range.selectNodeContents(span);
    const sel = window.getSelection()!;
    sel.removeAllRanges();
    sel.addRange(range);
    span.dispatchEvent(new MouseEvent("mouseup", { bubbles: true }));
  }, needle);

  await expect(page.getByTestId("highlight-popover")).toBeVisible();
  await page.getByTestId("chip-DATE").click(); // first click reveals the date input
  await page.getByTestId("popover-date").fill("2022-04-11");
  await page.getByTestId("popover-date-save").click();
  await expect(page.getByTestId("panel-card").filter({ hasText: "terminate" }).first()).toBeVisible();

  await page.goto(`/matters/${matter.id}/chronology`);
  await expect(page.getByTestId("chronology-table")).toContainText("11.04.2022");
});
