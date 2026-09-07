import test from "node:test";
import assert from "node:assert/strict";
import { validateGroundedDraft, type GroundingCard } from "../../src/lib/groundedDraft";

const card: GroundingCard = { id: "card-one", quote: "The agreement was signed on 12 January 2024.", body: "Commentary is not evidence.", documentId: "doc-one", document: { filename: "Agreement.pdf" }, page: 2, sourceUrl: null, sourceTitle: null };
const fact = { kind: "fact", text: "The agreement was signed in January.", sources: [{ cardId: card.id, quote: "signed on 12 January 2024" }] };
const payload = (block: unknown) => JSON.stringify({ blocks: [block] });

test("valid claim retains evidence and server-rendered source label", () => {
  const { html, review } = validateGroundedDraft(payload(fact), [card]);
  assert.match(html, /Agreement.pdf, p.2/);
  assert.equal(review.claims[0].sources[0].cardId, card.id);
  assert.equal(review.generatedContent, html);
});
test("missing, unknown and invented evidence are rejected", () => {
  assert.throws(() => validateGroundedDraft(payload({ ...fact, sources: [] }), [card]), /uncited/);
  assert.throws(() => validateGroundedDraft(payload({ ...fact, sources: [{ cardId: "foreign", quote: card.quote }] }), [card]), /outside/);
  assert.throws(() => validateGroundedDraft(payload({ ...fact, sources: [{ cardId: card.id, quote: card.body }] }), [card]), /quotation/);
});
test("orphaned source cards cannot substantiate a fact", () => {
  assert.throws(() => validateGroundedDraft(payload(fact), [{ ...card, documentId: null, document: null }]), /traceable/);
});
test("untrusted model text is escaped and analysis remains visibly unverified", () => {
  const { html, review } = validateGroundedDraft(payload({ kind: "analysis", text: '<img src=x> Proposed argument', sources: [] }), [card]);
  assert.equal(html, '<p>[&lt;img src=x&gt; Proposed argument]</p>');
  assert.equal(review.claims[0].kind, "analysis");
});
test("truncated JSON and empty output do not become drafts", () => {
  assert.throws(() => validateGroundedDraft('{"blocks":', [card]), /invalid/);
  assert.throws(() => validateGroundedDraft('{"blocks":[]}', [card]), /incomplete/);
});
