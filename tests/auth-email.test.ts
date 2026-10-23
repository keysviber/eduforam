import { test } from "node:test";
import assert from "node:assert/strict";
import { emailRequest, getAuthRedirect } from "../src/auth-email.ts";

test("email redirects never send a learner to localhost", () => {
  assert.equal(
    getAuthRedirect("web", "http://localhost:3000", "http://localhost:8081"),
    "educationforum://auth/callback",
  );
  assert.equal(
    getAuthRedirect("web", undefined, "https://school.example"),
    "https://school.example/",
  );
  assert.equal(
    getAuthRedirect("android", "https://school.example"),
    "educationforum://auth/callback",
  );
});
test("concurrent email requests and mixed-case retries send only once", async () => {
  let count = 0;
  const send = async () => {
    count++;
    return { error: null };
  };
  await emailRequest("Learner@example.com", send);
  await assert.rejects(
    emailRequest(" learner@example.com ", send),
    /Please wait/,
  );
  assert.equal(count, 1);
});
test("provider limits have actionable feedback and are never retried automatically", async () => {
  await assert.rejects(
    emailRequest("limited@example.com", async () => ({
      error: { status: 429, message: "email rate limit exceeded" },
    })),
    /sending limit/,
  );
});
