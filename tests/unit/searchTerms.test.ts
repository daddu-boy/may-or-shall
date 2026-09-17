import test from "node:test";
import assert from "node:assert/strict";
import { queryTerms, scoreText, firstHit } from "../../src/lib/searchTerms";

const hits = (text: string, query: string) => scoreText(text, queryTerms(query), query).matched;

test("a query is split into words rather than matched as one phrase", () => {
  assert.equal(hits("The delay in giving notice led to termination.", "termination delay"), 2);
});

test("forms of a word meet: terminated finds termination", () => {
  assert.equal(hits("The agreement was terminated on 4 May.", "termination"), 1);
  assert.equal(hits("Payments were delayed twice.", "delay"), 1);
});

test("a single typo in a longer word is forgiven, at a discount", () => {
  const s = scoreText("Notice of arbitration was served.", queryTerms("arbitraton"), "arbitraton");
  assert.equal(s.matched, 1);
  assert.ok(s.score < 1);
});

test("the exact phrase still ranks above scattered words", () => {
  const terms = queryTerms("running account");
  const exact = scoreText("This is a running account between the parties.", terms, "running account");
  const loose = scoreText("The account was kept running for years.", terms, "running account");
  assert.ok(exact.score > loose.score);
});

test("filler words are dropped and numbers kept whole", () => {
  assert.deepEqual(queryTerms("find the cards about section 138 of the Act"), ["section", "138", "act"]);
  assert.equal(hits("Complaint under section 1380", "138"), 1, "prefix of a number still matches");
  assert.equal(hits("Paid 2138 rupees", "138"), 0, "a number inside another does not");
});

test("unrelated text scores nothing, and short queries do not crash", () => {
  assert.equal(hits("Rent was paid in cash.", "termination delay"), 0);
  assert.deepEqual(queryTerms("a of"), []);
  assert.equal(scoreText("anything", [], "a of").matched, 0);
});

test("firstHit points at the first matching word for a snippet", () => {
  assert.equal(firstHit("Long preamble. Then termination followed.", queryTerms("termination")), 20);
  assert.equal(firstHit("nothing here", ["zzz"]), -1);
});

test("a typo still finds other forms of the word", () => {
  const terms = queryTerms("terminaton");
  assert.equal(scoreText("The agreement was terminated.", terms, "terminaton").matched, 1);
  assert.equal(scoreText("Notice of termination.", terms, "terminaton").matched, 1);
  assert.equal(scoreText("The term of the lease.", terms, "terminaton").matched, 0);
});
