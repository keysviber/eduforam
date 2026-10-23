import { test } from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const config = require("../app.config.js");
test("Android production rejects test ads and invalid/missing IDs without requiring iOS IDs", () => {
  const previous = { ...process.env };
  try {
    for (const name of Object.keys(process.env))
      if (name.includes("ADMOB") || name.startsWith("EAS_BUILD"))
        delete process.env[name];
    Object.assign(process.env, {
      EXPO_OS: "android",
      EXPO_PUBLIC_APP_ENV: "production",
      EXPO_PUBLIC_ADS_ENABLED: "true",
      EXPO_PUBLIC_ADS_TEST_MODE: "false",
      EXPO_PUBLIC_SUPABASE_URL: "https://project.supabase.co",
      EXPO_PUBLIC_SUPABASE_ANON_KEY: "sb_publishable_test_public_key",
      EXPO_PUBLIC_PRIVACY_URL: "https://education.test/privacy",
      EXPO_PUBLIC_TERMS_URL: "https://education.test/terms",
      EXPO_PUBLIC_SUPPORT_URL: "https://education.test/support",
      EXPO_PUBLIC_ACCOUNT_DELETION_URL: "https://education.test/delete",
    });
    assert.throws(() => config({ config: {} }), /ADMOB_ANDROID_APP_ID/);
    process.env.ADMOB_ANDROID_APP_ID = "ca-app-pub-1234567890123456~1234567890";
    for (const type of ["BANNER", "NATIVE", "REWARDED", "INTERSTITIAL"])
      process.env[`EXPO_PUBLIC_ADMOB_ANDROID_${type}`] =
        "ca-app-pub-1234567890123456/1234567890";
    assert.doesNotThrow(() => config({ config: {} }));
    process.env.EXPO_PUBLIC_ADS_TEST_MODE = "true";
    assert.throws(() => config({ config: {} }), /TEST_MODE/);
    process.env.EXPO_PUBLIC_ADS_TEST_MODE = "false";
    process.env.EXPO_PUBLIC_ADMOB_ANDROID_BANNER =
      "ca-app-pub-3940256099942544/6300978111";
    assert.throws(() => config({ config: {} }), /BANNER/);
  } finally {
    for (const name of Object.keys(process.env))
      if (!(name in previous)) delete process.env[name];
    Object.assign(process.env, previous);
  }
});
