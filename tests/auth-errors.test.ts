import { test } from "node:test";
import assert from "node:assert/strict";
import { authErrorMessage, validateNewPassword } from "../src/auth-errors.ts";

test("login failures explain the next action without exposing account existence", () => {
  assert.match(
    authErrorMessage({ code: "invalid_credentials" }),
    /email or password is incorrect/,
  );
  assert.match(
    authErrorMessage({ code: "email_not_confirmed" }),
    /Resend confirmation/,
  );
  assert.match(authErrorMessage({ message: "Failed to fetch" }), /connection/);
  assert.match(
    authErrorMessage({ code: "email_address_not_authorized" }),
    /email service needs to be configured/,
  );
  assert.match(authErrorMessage({ status: 429 }), /try later/);
});
test("recovery requires a strong matching password", () => {
  assert.throws(() => validateNewPassword("short", "short"), /8 characters/);
  assert.throws(
    () => validateNewPassword("new-password", "other-password"),
    /do not match/,
  );
  assert.doesNotThrow(() =>
    validateNewPassword("new-password", "new-password"),
  );
});
