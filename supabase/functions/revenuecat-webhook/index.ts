import {
  handler,
  json,
  requireSecret,
  service,
  provider,
} from "../_shared/http.ts";
import { verifiedProducts } from "../_shared/purchases.ts";
handler(async (req) => {
  requireSecret(req, "REVENUECAT_WEBHOOK_SECRET");
  const { event } = await req.json();
  if (
    event?.environment === "SANDBOX" &&
    Deno.env.get("ALLOW_SANDBOX_PURCHASES") !== "true"
  )
    return json({ ignored: "sandbox" });
  const ids = new Set([
    event?.app_user_id,
    ...(event?.transferred_from || []),
    ...(event?.transferred_to || []),
  ]);
  const db = service();
  const products = await db
    .from("store_products")
    .select("product_id,entitlement_id")
    .eq("active", true);
  if (products.error) throw products.error;
  for (const id of ids) {
    if (typeof id !== "string" || !/^[0-9a-f-]{36}$/i.test(id)) continue;
    const exists = await db
      .from("profiles")
      .select("id")
      .eq("id", id)
      .maybeSingle();
    if (exists.error) throw exists.error;
    if (!exists.data) continue;
    const checked = new Date().toISOString();
    const data = await provider(
      `https://api.revenuecat.com/v1/subscribers/${encodeURIComponent(id)}`,
      {
        headers: {
          Authorization: `Bearer ${Deno.env.get("REVENUECAT_SECRET_KEY")}`,
        },
      },
    );
    const snapshot = verifiedProducts(
      data.subscriber,
      products.data || [],
      Date.now(),
      Deno.env.get("ALLOW_SANDBOX_PURCHASES") === "true",
    );
    const r = await db.rpc("sync_purchase_access", {
      target_user: id,
      snapshot,
      checked,
    });
    if (r.error) throw r.error;
  }
  return json({ received: true });
});
