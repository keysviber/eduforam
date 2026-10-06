// Pure interpretation of an authoritative RevenueCat subscriber response.
export function verifiedProducts(
  subscriber: any,
  products: { product_id: string; entitlement_id: string }[],
  now: number,
  allowSandbox = false,
) {
  const result: { product_id: string; expires_at: string | null }[] = [];
  for (const p of products) {
    const entitlement = subscriber.entitlements?.[p.entitlement_id];
    if (!entitlement || entitlement.product_identifier !== p.product_id)
      continue;
    const expires = entitlement.expires_date;
    if (
      expires &&
      (!Number.isFinite(Date.parse(expires)) || Date.parse(expires) <= now)
    )
      continue;
    const subscription = subscriber.subscriptions?.[p.product_id];
    const records = subscription
      ? [subscription]
      : subscriber.non_subscriptions?.[p.product_id] || [];
    if (
      !records.some(
        (r: any) =>
          r.is_sandbox === false || (allowSandbox && r.is_sandbox === true),
      )
    )
      continue;
    result.push({ product_id: p.product_id, expires_at: expires || null });
  }
  return result;
}
