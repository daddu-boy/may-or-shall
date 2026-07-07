import type { APIRequestContext } from "@playwright/test";

export const SEED_MATTER_TITLE = "Sharma Infra Projects v. National Buildcon";

export async function getSeedMatter(request: APIRequestContext) {
  const matters = await (await request.get("/api/matters")).json();
  const matter = matters.find((m: { title: string }) => m.title === SEED_MATTER_TITLE);
  if (!matter) throw new Error("Seed matter not found — run `npm run db:seed` first.");
  return matter;
}

/** Remove cards whose quote contains `needle` so test runs stay idempotent. */
export async function deleteCardsContaining(
  request: APIRequestContext,
  matterId: string,
  needle: string
) {
  const cards = await (await request.get(`/api/matters/${matterId}/cards`)).json();
  for (const card of cards) {
    if ((card.quote || "").includes(needle) || (card.body || "").includes(needle)) {
      await request.delete(`/api/cards/${card.id}`);
    }
  }
}

export async function getPlaintDoc(request: APIRequestContext, matterId: string) {
  const docs = await (await request.get(`/api/matters/${matterId}/documents`)).json();
  const doc = docs.find((d: { docType: string }) => d.docType === "PLAINT");
  if (!doc) throw new Error("Seed plaint not found.");
  return doc;
}
