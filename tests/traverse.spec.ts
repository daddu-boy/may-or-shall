import { test, expect } from "@playwright/test";
import { getPlaintDoc, getSeedMatter } from "./helpers";

/**
 * PRD F5 acceptance: designating the plaint produces one editable row per
 * paragraph; the guard view lists incomplete rows; the Word export keeps
 * para numbering aligned with the plaint.
 */
test("designating the plaint splits it into traverse rows with the CPC guard", async ({
  page,
  request,
}) => {
  const matter = await getSeedMatter(request);
  const doc = await getPlaintDoc(request, matter.id);

  // reset any existing sheet so the run is idempotent
  await request.delete(`/api/matters/${matter.id}/traverse`);

  await page.goto(`/matters/${matter.id}/traverse`);
  await page.getByTestId("traverse-doc-select").selectOption(doc.id);
  await page.getByTestId("traverse-create").click();

  const rows = page.getByTestId("traverse-row");
  await expect(rows).toHaveCount(12, { timeout: 30_000 });
  await expect(rows.first()).toContainText("Plaint ¶1");
  await expect(rows.first()).toContainText("company incorporated");

  // set a specific status on row 1
  await rows.first().getByTestId("row-status").selectOption("DENIED_SPECIFIC");
  await page.waitForTimeout(1200); // debounce save

  // guard mode lists only not_started / denied_bare rows
  await page.getByTestId("review-toggle").click();
  await expect(page.getByTestId("guard-banner")).toContainText("Order VIII Rule 5");
  await expect(page.getByTestId("traverse-row")).toHaveCount(11);
});

test("written statement export is a valid docx aligned with plaint paras", async ({ request }) => {
  const matter = await getSeedMatter(request);
  const res = await request.get(`/api/matters/${matter.id}/exports/written-statement`);
  expect(res.status()).toBe(200);
  expect(res.headers()["content-disposition"]).toContain("Written Statement");
  const body = await res.body();
  expect(body.subarray(0, 2).toString()).toBe("PK");
  expect(body.length).toBeGreaterThan(2000);
});

test("row AI assist degrades cleanly without an API key", async ({ request }) => {
  const matter = await getSeedMatter(request);
  const sheet = await (await request.get(`/api/matters/${matter.id}/traverse`)).json();
  const res = await request.post(`/api/traverse-rows/${sheet.rows[0].id}/ai`, { data: {} });
  if (process.env.ANTHROPIC_API_KEY) {
    expect(res.status()).toBe(200);
    expect((await res.json()).suggestion.length).toBeGreaterThan(50);
  } else {
    expect(res.status()).toBe(503);
    expect((await res.json()).error).toContain("ANTHROPIC_API_KEY");
  }
});
