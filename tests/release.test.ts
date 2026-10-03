import { test } from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { parseAuthLink } from "../src/auth-links.ts";
const require = createRequire(import.meta.url);
const { validateReleaseEnvironment } = require("../scripts/release-config.cjs");

test("production rejects demo fallback, insecure URLs, and privileged keys", () => {
  assert.throws(() => validateReleaseEnvironment({}), /requires/);
  const env = {
    EXPO_PUBLIC_SUPABASE_URL: "https://project.supabase.co",
    EXPO_PUBLIC_SUPABASE_ANON_KEY: "sb_publishable_example_public_key",
    EXPO_PUBLIC_PRIVACY_URL: "https://education.test/privacy",
    EXPO_PUBLIC_TERMS_URL: "https://education.test/terms",
    EXPO_PUBLIC_SUPPORT_URL: "https://education.test/support",
    EXPO_PUBLIC_ACCOUNT_DELETION_URL: "https://education.test/delete-account",
  };
  assert.doesNotThrow(() => validateReleaseEnvironment(env));
  assert.throws(
    () =>
      validateReleaseEnvironment({
        ...env,
        EXPO_PUBLIC_SUPABASE_URL: "http://localhost",
      }),
    /HTTPS/,
  );
  const key = `header.${Buffer.from(JSON.stringify({ role: "service_role" })).toString("base64url")}.signature`;
  assert.throws(
    () =>
      validateReleaseEnvironment({
        ...env,
        EXPO_PUBLIC_SUPABASE_ANON_KEY: key,
      }),
    /never/,
  );
  assert.throws(
    () =>
      validateReleaseEnvironment({
        ...env,
        EXPO_PUBLIC_SUPABASE_ANON_KEY: "sb_secret_private",
      }),
    /never/,
  );
});
test("native auth accepts only complete callbacks for this app", () => {
  assert.equal(
    parseAuthLink("https://other.example/#access_token=a&refresh_token=b"),
    null,
  );
  assert.equal(
    parseAuthLink("educationforum://auth/callback#access_token=a"),
    null,
  );
  assert.deepEqual(
    parseAuthLink(
      "educationforum://auth/callback#access_token=a&refresh_token=b&type=recovery",
    ),
    {
      access_token: "a",
      refresh_token: "b",
      recovery: true,
    },
  );
  assert.throws(
    () => parseAuthLink("educationforum://auth/callback#error=expired"),
    /expired/,
  );
});
