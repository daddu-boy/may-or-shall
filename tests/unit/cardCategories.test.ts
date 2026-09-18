import test from "node:test";
import assert from "node:assert/strict";
import { CUSTOM_PREFIX, isCustomType, keyFor, labelWith } from "../../src/lib/cardCategories";

test("a category's key is derived from its name and never collides", () => {
  assert.equal(keyFor("Compliance"), `${CUSTOM_PREFIX}COMPLIANCE`);
  assert.equal(keyFor("Witness statements"), `${CUSTOM_PREFIX}WITNESS_STATEMENTS`);
  assert.equal(keyFor("Costs & fees"), `${CUSTOM_PREFIX}COSTS_FEES`);
  assert.equal(keyFor("Costs", [`${CUSTOM_PREFIX}COSTS`]), `${CUSTOM_PREFIX}COSTS_2`);
  assert.equal(keyFor("...", []), `${CUSTOM_PREFIX}CATEGORY`, "a name of punctuation still yields a key");
});

test("a custom type is recognisable, a built in one is not", () => {
  assert.ok(isCustomType(`${CUSTOM_PREFIX}COMPLIANCE`));
  assert.ok(!isCustomType("FACT"));
  assert.ok(!isCustomType("MISC"));
});

test("labels fall back sensibly for built in, custom and unknown types", () => {
  const cats = [{ id: "1", key: `${CUSTOM_PREFIX}COMPLIANCE`, label: "Compliance", color: "#0ea5e9" }];
  assert.equal(labelWith(`${CUSTOM_PREFIX}COMPLIANCE`, cats), "Compliance");
  assert.equal(labelWith("FACT", cats), "Fact");
  assert.equal(labelWith("MISC", cats), "Personal note");
  // a category deleted after a card was filed under it: show the key, not "undefined"
  assert.equal(labelWith(`${CUSTOM_PREFIX}GONE`, cats), `${CUSTOM_PREFIX}GONE`);
});
