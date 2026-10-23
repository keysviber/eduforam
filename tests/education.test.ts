import { test } from "node:test";
import assert from "node:assert/strict";
import { levelsFor, canonicalGrade, educationSystems } from "../src/education.ts";
import { matchesHomeGrade } from "../src/discovery.ts";

test("all six Zimbabwe secondary forms map to the requested UK years", () => {
  for (let form = 1; form <= 6; form++) {
    const zw = levelsFor("ZW").find(level => level.label === `Form ${form}`)!;
    const uk = levelsFor("GB").find(level => level.label === `Year ${form + 7}`)!;
    assert.equal(zw.ordinal, uk.ordinal);
    assert.equal(canonicalGrade(uk.ordinal), zw.label);
    assert.equal(matchesHomeGrade(uk.label, zw.label), true);
  }
  assert.equal(matchesHomeGrade("Year 8", "Form 5"), false);
});
test("additional education systems have distinct selectable labels and canonical levels", () => {
  for (const system of educationSystems) {
    const levels = levelsFor(system.code);
    assert.equal(new Set(levels.map(level => level.label)).size, levels.length);
    for (const level of levels) assert.ok(canonicalGrade(level.ordinal));
  }
  assert.equal(levelsFor("NG").find(level => level.label === "SSS 3")?.ordinal, 12);
});
