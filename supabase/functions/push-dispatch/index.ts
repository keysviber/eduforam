import {
  handler,
  json,
  requireSecret,
  service,
  provider,
} from "../_shared/http.ts";
handler(async (req) => {
  requireSecret(req, "PUSH_WORKER_SECRET");
  const db = service();
  const jobs = await db.rpc("claim_push_jobs");
  if (jobs.error) throw jobs.error;
  const headers = {
    "Content-Type": "application/json",
    ...(Deno.env.get("EXPO_ACCESS_TOKEN")
      ? { Authorization: `Bearer ${Deno.env.get("EXPO_ACCESS_TOKEN")}` }
      : {}),
  };
  let processed = 0;
  for (const j of jobs.data || []) {
    try {
      const device = await db
        .from("push_devices")
        .select("token")
        .eq("token", j.token)
        .eq("user_id", j.user_id)
        .maybeSingle();
      if (device.error) throw device.error;
      if (!device.data) {
        const r = await db
          .from("push_jobs")
          .update({ status: "failed", last_error: "Device reassigned" })
          .eq("id", j.id);
        if (r.error) throw r.error;
        continue;
      }
      let result: any;
      if (j.ticket_id) {
        const receipt = await provider(
          "https://exp.host/--/api/v2/push/getReceipts",
          {
            method: "POST",
            headers,
            body: JSON.stringify({ ids: [j.ticket_id] }),
          },
        );
        result = receipt.data?.[j.ticket_id];
        if (!result) continue;
      } else {
        const sent = await provider("https://exp.host/--/api/v2/push/send", {
          method: "POST",
          headers,
          body: JSON.stringify({
            to: j.token,
            title: "Education Forum",
            body: "You have a new update. Open the app to view it.",
            sound: "default",
            channelId: "updates",
            data: { screen: "Notifications" },
          }),
        });
        result = sent.data;
      }
      if (result?.details?.error === "DeviceNotRegistered") {
        const r = await db
          .from("push_devices")
          .delete()
          .eq("token", j.token)
          .eq("user_id", j.user_id);
        if (r.error) throw r.error;
        continue;
      }
      const update =
        result?.status === "ok"
          ? {
              status: j.ticket_id ? "delivered" : "receipt",
              ticket_id: j.ticket_id || result.id,
              next_attempt: new Date(Date.now() + 60000).toISOString(),
              last_error: null,
            }
          : {
              status: j.attempts >= 8 ? "failed" : "pending",
              last_error: result?.details?.error || "Push rejected",
              next_attempt: new Date(
                Date.now() + Math.min(3600000, 2 ** j.attempts * 30000),
              ).toISOString(),
            };
      const r = await db.from("push_jobs").update(update).eq("id", j.id);
      if (r.error) throw r.error;
      processed++;
    } catch {
      await db
        .from("push_jobs")
        .update({
          status:
            j.attempts >= 8 ? "failed" : j.ticket_id ? "receipt" : "pending",
          last_error: "Provider unavailable",
          next_attempt: new Date(Date.now() + 300000).toISOString(),
        })
        .eq("id", j.id);
    }
  }
  return json({ processed });
});
