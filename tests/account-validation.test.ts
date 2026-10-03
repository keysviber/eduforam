import { test } from "node:test";
import assert from "node:assert/strict";
import { validateAccountForm } from "../src/account-validation.ts";
const form = {
  email: " student@example.com ",
  password: "a-good-password",
  confirmation: "a-good-password",
  signup: true,
  grade: "Form 4",
};
test("signup requires email, matching passwords and a grade", () => {
  assert.equal(validateAccountForm(form), "student@example.com");
  assert.throws(
    () => validateAccountForm({ ...form, email: "invalid" }),
    /email address/,
  );
  assert.throws(
    () => validateAccountForm({ ...form, password: "short" }),
    /8 characters/,
  );
  assert.throws(
    () => validateAccountForm({ ...form, confirmation: "different" }),
    /do not match/,
  );
  assert.throws(() => validateAccountForm({ ...form, grade: null }), /grade/);
});
test("login does not require signup fields", () => {
  assert.equal(
    validateAccountForm({
      ...form,
      signup: false,
      confirmation: "",
      grade: null,
    }),
    "student@example.com",
  );
  assert.throws(
    () => validateAccountForm({ ...form, signup: false, password: "" }),
    /password/,
  );
});
