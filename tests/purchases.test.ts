import { test } from "node:test";
import assert from "node:assert/strict";
import { verifiedProducts } from "../supabase/functions/_shared/purchases.ts";
const products = [
  { product_id: "remove_ads", entitlement_id: "remove_ads" },
  { product_id: "class_1", entitlement_id: "classroom_1" },
];
const now = Date.parse("2026-10-03T00:00:00Z");
test("only authoritative matching active store entitlements grant access", () => {
  const subscriber = {
    entitlements: {
      remove_ads: { product_identifier: "remove_ads", expires_date: null },
    },
    non_subscriptions: { remove_ads: [{ is_sandbox: false }] },
  };
  assert.deepEqual(verifiedProducts(subscriber, products, now), [
    { product_id: "remove_ads", expires_at: null },
  ]);
  assert.deepEqual(
    verifiedProducts({ ...subscriber, entitlements: {} }, products, now),
    [],
  );
  assert.deepEqual(
    verifiedProducts(
      {
        ...subscriber,
        entitlements: {
          remove_ads: { product_identifier: "unknown", expires_date: null },
        },
      },
      products,
      now,
    ),
    [],
  );
});
test("sandbox, expired and malformed entitlement expiry fail closed", () => {
  const base = {
    entitlements: {
      remove_ads: { product_identifier: "remove_ads", expires_date: null },
    },
    non_subscriptions: { remove_ads: [{ is_sandbox: true }] },
  };
  assert.deepEqual(verifiedProducts(base, products, now), []);
  assert.equal(verifiedProducts(base, products, now, true).length, 1);
  for (const expires_date of ["2026-10-02T00:00:00Z", "invalid"]) {
    assert.deepEqual(
      verifiedProducts(
        {
          ...base,
          entitlements: {
            remove_ads: { product_identifier: "remove_ads", expires_date },
          },
        },
        products,
        now,
        true,
      ),
      [],
    );
  }
});
