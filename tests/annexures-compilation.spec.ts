import { test, expect } from "@playwright/test";
import { getSeedMatter } from "./helpers";

/**
 * PRD F8 acceptance: renumbering updates every live reference across drafts
 * instantly. PRD F7 acceptance: compilation builds with index + pagination.
 */
test("reordering annexures renumbers labels and rewrites live references", async ({ request }) => {
  const matter = await getSeedMatter(request);

  // ensure both seed documents are registered (idempotent: 409 = already there)
  const docs = await (await request.get(`/api/matters/${matter.id}/documents`)).json();
  for (const doc of docs) {
    await request.post(`/api/matters/${matter.id}/annexures`, { data: { documentId: doc.id } });
  }

  let registry = await (await request.get(`/api/matters/${matter.id}/annexures`)).json();
  expect(registry.items.length).toBeGreaterThanOrEqual(2);
  const firstDoc = registry.items[0].documentId;
  const firstLabel = registry.items[0].document.annexureLabel;
  expect(firstLabel).toMatch(/^Annexure [A-Z]+-1$/);

  // plant a live reference to the current first annexure inside a draft
  const artefact = await (
    await request.post(`/api/matters/${matter.id}/artefacts`, {
      data: { artefactType: "SENIOR_BRIEF", mode: "blank", title: "Renumber test" },
    })
  ).json();
  await request.patch(`/api/artefacts/${artefact.id}`, {
    data: { content: `<p>See <span data-annexure-id="${firstDoc}">${firstLabel}</span>.</p>` },
  });

  // reorder: reverse the registry → the referenced doc moves to last position
  const reversed = [...registry.items].reverse().map((i: { id: string }) => i.id);
  registry = await (
    await request.patch(`/api/matters/${matter.id}/annexures`, { data: { order: reversed } })
  ).json();
  const newLabel = registry.items.find(
    (i: { documentId: string }) => i.documentId === firstDoc
  ).document.annexureLabel;
  expect(newLabel).not.toBe(firstLabel);

  // the live reference in the draft now shows the new label
  const updated = await (await request.get(`/api/artefacts/${artefact.id}`)).json();
  expect(updated.content).toContain(`>${newLabel}</span>`);

  // annexure index export is a valid docx
  const index = await request.get(`/api/matters/${matter.id}/exports/annexure-index`);
  expect(index.status()).toBe(200);
  expect((await index.body()).subarray(0, 2).toString()).toBe("PK");

  // cleanup: restore original order, remove test artefact
  await request.patch(`/api/matters/${matter.id}/annexures`, {
    data: { order: [...reversed].reverse() },
  });
  await request.delete(`/api/artefacts/${artefact.id}`);
});

test("compilation builds a paginated PDF from cited pages", async ({ request }) => {
  const matter = await getSeedMatter(request);
  const res = await request.post(`/api/matters/${matter.id}/compilation`, {
    data: { scope: "cited", contextPages: 1 },
  });
  expect(res.status()).toBe(200);
  expect(res.headers()["content-type"]).toBe("application/pdf");
  const body = await res.body();
  expect(body.subarray(0, 5).toString()).toBe("%PDF-");
  expect(body.length).toBeGreaterThan(2000);
});

test("blank drafts version and export to docx", async ({ request }) => {
  const matter = await getSeedMatter(request);
  const v1 = await (
    await request.post(`/api/matters/${matter.id}/artefacts`, {
      data: { artefactType: "JUDGE_NOTE", mode: "blank", title: "Versioning test" },
    })
  ).json();
  const v2 = await (
    await request.post(`/api/matters/${matter.id}/artefacts`, {
      data: { artefactType: "JUDGE_NOTE", mode: "blank", title: "Versioning test" },
    })
  ).json();
  expect(v2.version).toBe(v1.version + 1);

  const exported = await request.get(`/api/artefacts/${v1.id}/export`);
  expect(exported.status()).toBe(200);
  expect((await exported.body()).subarray(0, 2).toString()).toBe("PK");

  await request.delete(`/api/artefacts/${v1.id}`);
  await request.delete(`/api/artefacts/${v2.id}`);
});
