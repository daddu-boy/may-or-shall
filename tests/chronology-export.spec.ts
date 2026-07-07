import { test, expect } from "@playwright/test";
import { getSeedMatter } from "./helpers";

/**
 * PRD F4 acceptance: Date cards appear in the chronology; export produces a
 * Word document with the two-column table.
 */
test("chronology lists seeded Date cards in DD.MM.YYYY order", async ({ page, request }) => {
  const matter = await getSeedMatter(request);
  await page.goto(`/matters/${matter.id}/chronology`);

  const table = page.getByTestId("chronology-table");
  await expect(table).toContainText("12.03.2021");
  await expect(table).toContainText("05.04.2021");
  await expect(table).toContainText("Letter of Intent");
});

test("manual chronology rows can be added", async ({ page, request }) => {
  const matter = await getSeedMatter(request);
  await page.goto(`/matters/${matter.id}/chronology`);

  await page.getByTestId("manual-date").fill("2024-06-01");
  await page.getByTestId("manual-desc").fill("Suit instituted before the Delhi High Court");
  await page.getByTestId("manual-add").click();
  await expect(page.getByTestId("chronology-table")).toContainText("01.06.2024");
});

test("List of Dates exports as a valid .docx", async ({ request }) => {
  const matter = await getSeedMatter(request);
  const res = await request.get(`/api/matters/${matter.id}/exports/list-of-dates`);

  expect(res.status()).toBe(200);
  expect(res.headers()["content-type"]).toContain("wordprocessingml.document");
  expect(res.headers()["content-disposition"]).toContain("List of Dates");

  const body = await res.body();
  expect(body.length).toBeGreaterThan(2000);
  // docx files are zip archives: magic bytes PK, containing word/document.xml
  expect(body.subarray(0, 2).toString()).toBe("PK");
  expect(body.includes(Buffer.from("word/document.xml"))).toBe(true);
});
