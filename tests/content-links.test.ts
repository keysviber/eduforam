import { test } from "node:test";
import assert from "node:assert/strict";
import { contentLink, parseContentLink } from "../src/content-links.ts";

test("classroom invitations and video shares round-trip without manual codes", () => {
  for (const [kind, id] of [
    ["join", "abcdef0123456789abcdef0123456789"],
    ["video", "aaaabbbb-4444-4444-8444-444444444444"],
  ] as const) assert.deepEqual(parseContentLink(contentLink(kind, id)), { kind, id });
});
test("malformed or non-link shared content cannot open a reader or classroom", () => {
  for (const value of ["not a link", "javascript:alert(1)", "educationforum://open?join=bad", `educationforum://open?video=${"-".repeat(36)}`])
    assert.equal(parseContentLink(value), null);
});
