import { handler, json, service, user, provider } from "../_shared/http.ts";
handler(async (req) => {
  const who = await user(req);
  if (!["admin", "owner"].includes(who.role))
    throw new Error("Administrator permission required");
  const { request_id, reason } = await req.json();
  if (typeof reason !== "string" || reason.trim().length < 5)
    throw new Error("Explain the payout approval");
  const key = Deno.env.get("STRIPE_SECRET_KEY");
  if (!key) throw new Error("Stripe is not configured");
  const db = service();
  const r = await db.rpc("claim_payout", { request_id });
  if (r.error) throw r.error;
  const payout = r.data?.[0];
  if (!payout) throw new Error("Payout is unavailable or already transferred");
  const recipient = await db
    .from("payout_accounts")
    .select("stripe_account")
    .eq("user_id", payout.user_id)
    .single();
  if (recipient.error) throw recipient.error;
  const account = await provider(
    `https://api.stripe.com/v1/accounts/${recipient.data.stripe_account}`,
    { headers: { Authorization: `Bearer ${key}` } },
  );
  if (account.capabilities?.transfers !== "active" || !account.payouts_enabled)
    throw new Error("Recipient must complete payout onboarding");
  // Same request always uses the same provider key. A timeout keeps funds reserved for retry/reconciliation.
  const transfer = await provider("https://api.stripe.com/v1/transfers", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/x-www-form-urlencoded",
      "Idempotency-Key": `creator-payout-${payout.id}`,
    },
    body: new URLSearchParams({
      amount: String(payout.amount_minor),
      currency: payout.currency.toLowerCase(),
      destination: recipient.data.stripe_account,
      "metadata[payout_id]": payout.id,
    }),
  });
  const updated = await db
    .from("payout_requests")
    .update({ status: "transferred", provider_reference: transfer.id })
    .eq("id", payout.id);
  if (updated.error) throw updated.error;
  const audit = await db
    .from("audit_log")
    .insert({
      actor_id: who.id,
      entity_id: payout.id,
      action: "payout.transferred",
      reason: reason.trim(),
      details: { provider_reference: transfer.id },
    });
  if (audit.error) throw audit.error;
  return json({ status: "transferred", reference: transfer.id });
});
