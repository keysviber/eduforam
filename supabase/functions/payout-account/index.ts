import { handler, json, service, user, provider } from "../_shared/http.ts";
handler(async (req) => {
  const who = await user(req);
  const db = service();
  const key = Deno.env.get("STRIPE_SECRET_KEY");
  const country = Deno.env.get("STRIPE_CONNECT_COUNTRY");
  const origin = Deno.env.get("PAYOUT_RETURN_URL");
  if (!key || !country || !origin || !origin.startsWith("https://"))
    throw new Error("Payout provider configuration is incomplete");
  const existing = await db
    .from("payout_accounts")
    .select("stripe_account")
    .eq("user_id", who.id)
    .maybeSingle();
  if (existing.error) throw existing.error;
  let account = existing.data?.stripe_account;
  if (!account) {
    const created = await provider("https://api.stripe.com/v1/accounts", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/x-www-form-urlencoded",
        "Idempotency-Key": `creator-account-${who.id}`,
      },
      body: new URLSearchParams({
        "controller[stripe_dashboard][type]": "express",
        "controller[fees][payer]": "application",
        "controller[losses][payments]": "application",
        country,
        "capabilities[transfers][requested]": "true",
        "metadata[user_id]": who.id,
      }),
    });
    account = created.id;
    const r = await db
      .from("payout_accounts")
      .upsert(
        { user_id: who.id, stripe_account: account },
        { onConflict: "user_id" },
      );
    if (r.error) throw r.error;
  }
  const link = await provider("https://api.stripe.com/v1/account_links", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      account: account!,
      refresh_url: origin,
      return_url: origin,
      type: "account_onboarding",
    }),
  });
  return json({ url: link.url });
});
