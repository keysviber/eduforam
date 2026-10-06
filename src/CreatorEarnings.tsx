import React, { useEffect, useState } from "react";
import { View, Text, TextInput, Pressable, Linking } from "react-native";
import { backend } from "./backend";
const box = {
  padding: 16,
  gap: 12,
  backgroundColor: "white",
  borderRadius: 16,
  marginVertical: 8,
};
export function CreatorEarnings({ userId }: { userId?: string }) {
  const [balances, setBalances] = useState<any[]>([]);
  const [payouts, setPayouts] = useState<any[]>([]);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  async function load() {
    if (!backend || !userId) return;
    const summary = await backend.rpc("creator_summary");
    if (summary.error) throw summary.error;
    setBalances(summary.data || []);
    const p = await backend
      .from("payout_requests")
      .select("id,amount_minor,currency,status")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(30);
    if (p.error) throw p.error;
    setPayouts(p.data || []);
  }
  async function act(fn: () => Promise<void>) {
    if (busy) return;
    setBusy(true);
    setNotice("");
    try {
      await fn();
    } catch (e) {
      setNotice(
        (e as { message?: string }).message || "Unable to complete. Retry.",
      );
    } finally {
      setBusy(false);
    }
  }
  useEffect(() => {
    setBalances([]);
    setPayouts([]);
    void act(load);
  }, [userId]);
  return (
    <View style={box}>
      <Text style={{ fontWeight: "700", fontSize: 20 }}>Creator earnings</Text>
      <Text>
        Qualified usage is reviewed before it becomes an approved balance.
        Transfers to your payout provider are shown separately from bank
        deposits.
      </Text>
      {!userId && <Text>Sign in to view your earnings.</Text>}
      <Text accessibilityRole="alert">{notice}</Text>
      <Pressable
        disabled={busy || !userId}
        accessibilityRole="button"
        onPress={() => void act(load)}
      >
        <Text>Refresh earnings</Text>
      </Pressable>
      {balances.map((b) => (
        <View key={b.currency} style={{ gap: 8 }}>
          <Text>
            {b.currency}: pending {Number(b.pending).toFixed(4)} · approved{" "}
            {Number(b.earned).toFixed(4)} · available{" "}
            {Number(b.available).toFixed(2)}
          </Text>
          <Pressable
            disabled={busy}
            accessibilityRole="button"
            onPress={() =>
              void act(async () => {
                const r = await backend!.rpc("request_creator_payout", {
                  payout_currency: b.currency,
                });
                if (r.error) throw r.error;
                await load();
                setNotice("Payout requested for administrator review.");
              })
            }
          >
            <Text>Request {b.currency} payout</Text>
          </Pressable>
        </View>
      ))}
      <Pressable
        disabled={busy || !userId}
        accessibilityRole="button"
        onPress={() =>
          void act(async () => {
            const r = await backend!.functions.invoke("payout-account");
            if (r.error || !r.data?.url)
              throw new Error(
                "Payout onboarding is unavailable. Check provider setup with the administrator.",
              );
            await Linking.openURL(r.data.url);
          })
        }
      >
        <Text>Set up / continue payout account</Text>
      </Pressable>
      {payouts.map((p) => (
        <Text key={p.id}>
          {p.currency} {(Number(p.amount_minor) / 100).toFixed(2)} · {p.status}
        </Text>
      ))}
    </View>
  );
}
export function ServiceAdministration() {
  const [usage, setUsage] = useState<any[]>([]);
  const [payouts, setPayouts] = useState<any[]>([]);
  const [reason, setReason] = useState("");
  const [product, setProduct] = useState("");
  const [entitlement, setEntitlement] = useState("");
  const [classroom, setClassroom] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  async function load() {
    if (!backend) return;
    const u = await backend
      .from("content_usage")
      .select("id,entry_id,viewer_id,seconds,rate,currency")
      .eq("status", "qualified")
      .order("started_at")
      .limit(50);
    if (u.error) throw u.error;
    setUsage(u.data || []);
    const p = await backend
      .from("payout_requests")
      .select("*")
      .in("status", ["requested", "processing"])
      .order("created_at")
      .limit(50);
    if (p.error) throw p.error;
    setPayouts(p.data || []);
  }
  async function act(fn: () => Promise<void>) {
    if (busy) return;
    setBusy(true);
    setNotice("");
    try {
      await fn();
      await load();
    } catch (e) {
      setNotice(
        (e as { message?: string }).message || "Service action failed. Retry.",
      );
    } finally {
      setBusy(false);
    }
  }
  useEffect(() => {
    void act(load);
  }, []);
  const button = (title: string, fn: () => Promise<void>) => (
    <Pressable
      disabled={busy}
      accessibilityRole="button"
      onPress={() => void act(fn)}
    >
      <Text style={{ color: "#5141a6" }}>{title}</Text>
    </Pressable>
  );
  return (
    <View style={box}>
      <Text style={{ fontSize: 22, fontWeight: "700" }}>
        Billing & creator operations
      </Text>
      <Text accessibilityRole="alert">{notice}</Text>
      {button("Refresh operations", load)}
      <TextInput
        accessibilityLabel="Service action reason"
        placeholder="Reason for review / payout"
        placeholderTextColor="#526477"
        value={reason}
        onChangeText={setReason}
      />
      <Text style={{ fontWeight: "700" }}>
        Qualified usage awaiting review (first 50)
      </Text>
      {usage.map((u) => (
        <View key={u.id} style={box}>
          <Text selectable>
            Content {u.entry_id} · viewer {u.viewer_id}
          </Text>
          <Text>
            {u.seconds}s · {u.currency} {u.rate}
          </Text>
          {[true, false].map((approve) => (
            <React.Fragment key={String(approve)}>
              {button(
                approve ? "Approve verified usage" : "Reject usage",
                async () => {
                  const r = await backend!.rpc("review_usage", {
                    usage_id: u.id,
                    approve,
                    reason,
                  });
                  if (r.error) throw r.error;
                },
              )}
            </React.Fragment>
          ))}
        </View>
      ))}
      <Text style={{ fontWeight: "700" }}>Payout requests</Text>
      {payouts.map((p) => (
        <View key={p.id} style={box}>
          <Text selectable>{p.user_id}</Text>
          <Text>
            {p.currency} {(p.amount_minor / 100).toFixed(2)} · {p.status}
          </Text>
          {button("Approve / retry transfer", async () => {
            const r = await backend!.functions.invoke("payout-transfer", {
              body: { request_id: p.id, reason },
            });
            if (r.error || r.data?.error)
              throw new Error(
                "Transfer not confirmed. Balance stays reserved; check the provider and retry the same request.",
              );
            setNotice(
              "Transferred to creator's payout account. Bank settlement is separate.",
            );
          })}
        </View>
      ))}
      <Text style={{ fontWeight: "700" }}>Map a configured store product</Text>
      <Text>
        Use the same non-consumable product ID on both stores. Classroom prices
        at checkout come from the store. Attach all products to the remove_ads
        entitlement in RevenueCat.
      </Text>
      {[
        ["Product ID", product, setProduct],
        ["RevenueCat entitlement ID", entitlement, setEntitlement],
        ["Classroom UUID (blank for remove ads)", classroom, setClassroom],
      ].map(([label, value, setter]) => (
        <TextInput
          key={label as string}
          accessibilityLabel={label as string}
          placeholder={label as string}
          placeholderTextColor="#526477"
          value={value as string}
          onChangeText={setter as (v: string) => void}
        />
      ))}
      {button("Save product mapping", async () => {
        const r = await backend!.rpc("save_store_product", {
          product: product.trim(),
          entitlement: entitlement.trim(),
          room: classroom.trim() || null,
          reason,
        });
        if (r.error) throw r.error;
        setNotice(
          "Product mapping saved. Verify the store and RevenueCat configuration before selling.",
        );
      })}
    </View>
  );
}
