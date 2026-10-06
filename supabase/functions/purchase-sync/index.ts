import { handler, json, service, user, provider } from "../_shared/http.ts";
import { verifiedProducts } from "../_shared/purchases.ts";
export async function sync(id: string) {
  const started = new Date().toISOString();
  const key = Deno.env.get("REVENUECAT_SECRET_KEY");
  if (!key) throw new Error("RevenueCat is not configured");
  const db = service();
  const products = await db
    .from("store_products")
    .select("product_id,entitlement_id")
    .eq("active", true);
  if (products.error) throw products.error;
  const response = await provider(
    `https://api.revenuecat.com/v1/subscribers/${encodeURIComponent(id)}`,
    { headers: { Authorization: `Bearer ${key}` } },
  );
  const snapshot = verifiedProducts(
    response.subscriber,
    products.data || [],
    Date.now(),
    Deno.env.get("ALLOW_SANDBOX_PURCHASES") === "true",
  );
  const r = await db.rpc("sync_purchase_access", {
    target_user: id,
    snapshot,
    checked: started,
  });
  if (r.error) throw r.error;
  return snapshot;
}
handler(async (req) => {
  const who = await user(req);
  await sync(who.id);
  return json({ verified: true });
});
