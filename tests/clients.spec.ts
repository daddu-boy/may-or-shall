import { test, expect } from "@playwright/test";
import { getSeedMatter } from "./helpers";

/** API tokens + web-capture cards + the Word add-in task pane (browser mode). */

test("API tokens: create, authenticate, reject bad, revoke", async ({ request }) => {
  const created = await (
    await request.post("/api/tokens", { data: { name: "spec-token" } })
  ).json();
  expect(created.token).toMatch(/^mos_/);

  const matter = await getSeedMatter(request);

  // valid bearer works
  const ok = await request.get(`/api/matters/${matter.id}/cards`, {
    headers: { Authorization: `Bearer ${created.token}` },
  });
  expect(ok.status()).toBe(200);

  // invalid bearer is rejected
  const bad = await request.get(`/api/matters/${matter.id}/cards`, {
    headers: { Authorization: "Bearer mos_definitely_wrong" },
  });
  expect(bad.status()).toBe(401);

  // revoked token stops working
  await request.delete(`/api/tokens/${created.id}`);
  const revoked = await request.get(`/api/matters/${matter.id}/cards`, {
    headers: { Authorization: `Bearer ${created.token}` },
  });
  expect(revoked.status()).toBe(401);
});

test("web-capture cards carry URL sources into the board", async ({ page, request }) => {
  const matter = await getSeedMatter(request);
  const card = await (
    await request.post(`/api/matters/${matter.id}/cards`, {
      data: {
        cardType: "FACT",
        quote: "Web capture spec check",
        body: "Web capture spec check",
        sourceUrl: "https://example.com/judgment/42",
        sourceTitle: "Example v Example",
      },
    })
  ).json();
  expect(card.sourceUrl).toBe("https://example.com/judgment/42");

  await page.goto(`/matters/${matter.id}/cards`);
  const chip = page.locator('a[href="https://example.com/judgment/42"]').first();
  await expect(chip).toBeVisible();
  await expect(chip).toContainText("example.com");

  await request.delete(`/api/cards/${card.id}`);
});

test("add-in task pane lists cards in copy mode outside Word", async ({ page, request }) => {
  const matter = await getSeedMatter(request);
  await page.goto("/addin/taskpane");
  await expect(page.getByTestId("addin-matter")).toBeVisible();
  await page.getByTestId("addin-matter").selectOption(matter.id);
  await expect(page.getByTestId("addin-card").first()).toBeVisible();
  // outside Word the footer button is in copy mode
  await expect(page.getByTestId("addin-insert")).toContainText("Copy");
});
