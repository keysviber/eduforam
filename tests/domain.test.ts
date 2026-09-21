import { test } from "node:test";
import assert from "node:assert/strict";
import {
  canPublish,
  validateSubmission,
  calculateEarnings,
} from "../src/domain.ts";
test("only approved content can be public", () => {
  for (const status of [
    "pending",
    "rejected",
    "changes_requested",
    "removed",
  ] as const)
    assert.equal(canPublish(status), false);
  assert.equal(canPublish("approved"), true);
});
test("submissions require meaningful title and details", () => {
  assert.throws(() => validateSubmission("a", "short"));
  assert.throws(() => validateSubmission("Good title", "short"));
  assert.doesNotThrow(() =>
    validateSubmission(
      "Good title",
      "A useful description with sufficient detail.",
    ),
  );
});
test("earnings follow configurable rates and reject malformed activity", () => {
  assert.equal(calculateEarnings(1000, 5, 0.001, 2), 11);
  assert.equal(calculateEarnings(1000, 5, 0.002, 3), 17);
  assert.throws(() => calculateEarnings(-1, 2, 1, 1));
  assert.throws(() => calculateEarnings(Infinity, 2, 1, 1));
});
