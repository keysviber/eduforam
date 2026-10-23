import React, { useEffect, useState } from "react";
import { View, Text, TextInput, Pressable, StyleSheet } from "./Theme";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { backend } from "./backend";
import { useBilling } from "./Billing";
import { FeatureButton } from "./FeatureWorkflows";
import { coreEducationRelease } from "./release";
export type Plan = {
  id: string;
  name: string;
  price_minor: number;
  currency: string;
  benefits: string[];
  active: boolean;
};
export function Plans({
  notify,
  userId,
}: {
  notify: (s: string) => void;
  userId?: string;
}) {
  const billing = useBilling();
  const [plans, setPlans] = useState<Plan[]>([]),
    [products, setProducts] = useState<
      { product_id: string; plan_id: string }[]
    >([]),
    [access, setAccess] = useState<
      { plan_id: string; expires_at: string | null }[]
    >([]);
  const [prices, setPrices] = useState<Record<string, string>>({}),
    [busy, setBusy] = useState(false);
  async function load() {
    if (!backend) return;
    const [p, items] = await Promise.all([
      backend.from("plans").select("*").eq("active", true),
      backend
        .from("store_products")
        .select("product_id,plan_id")
        .eq("active", true)
        .not("plan_id", "is", null),
    ]);
    if (p.error || items.error) throw p.error || items.error;
    setPlans(p.data || []);
    setProducts(items.data || []);
    if (userId) {
      const r = await backend.rpc("my_plan_access");
      if (r.error) throw r.error;
      setAccess(r.data || []);
    }
  }
  async function act(fn: () => Promise<void>) {
    if (busy) return;
    setBusy(true);
    try {
      await fn();
    } catch (e) {
      notify(
        (e as Error).message ||
          "Could not complete purchase. Try restoring purchases.",
      );
    } finally {
      setBusy(false);
    }
  }
  useEffect(() => {
    void act(load);
  }, [userId]);
  return (
    <View style={s.card}>
      <Text style={s.title}>Premier and subscriptions</Text>
      <Text>
        Plans are managed by the platform. Final prices and renewal terms are
        shown by your app store before purchase.
      </Text>
      <FeatureButton
        label="Refresh plans"
        disabled={busy || !backend}
        onPress={() => void act(load)}
      />
      {!plans.length && <Text>No active plans have been published yet.</Text>}
      {plans.map((p) => {
        const product = products.find((x) => x.plan_id === p.id),
          entitled = access.find((x) => x.plan_id === p.id);
        return (
          <View key={p.id} style={s.card}>
            <Text style={s.title}>{p.name}</Text>
            {p.benefits.map((b) => (
              <Text key={b}>{b}</Text>
            ))}
            {entitled ? (
              <Text>
                {entitled.expires_at
                  ? "Access active until " +
                    new Date(entitled.expires_at).toLocaleDateString()
                  : "Verified access active"}
              </Text>
            ) : (
              <>
                <Text>
                  {product
                    ? prices[p.id] ||
                      "Check the current store price before buying."
                    : "Purchasing is not configured for this plan yet."}
                </Text>
                <FeatureButton
                  disabled={busy || !userId || !product}
                  label={
                    prices[p.id]
                      ? "Buy through app store - " + prices[p.id]
                      : "Check store price"
                  }
                  onPress={() =>
                    void act(async () => {
                      if (!product) return;
                      if (!prices[p.id]) {
                        const price = await billing.price(
                          product.product_id,
                          true,
                        );
                        setPrices({ ...prices, [p.id]: price });
                        return;
                      }
                      await billing.purchase(product.product_id, true);
                      await load();
                      notify("Purchase verified and access refreshed.");
                    })
                  }
                />
              </>
            )}
          </View>
        );
      })}
      <FeatureButton
        label="Restore plan purchases"
        disabled={busy || !userId}
        onPress={() =>
          void act(async () => {
            await billing.restore();
            await load();
            notify("Verified plan access refreshed.");
          })
        }
      />
      {!userId && <Text>Sign in to buy or restore a plan.</Text>}
    </View>
  );
}
export function Management({ notify }: { notify: (s: string) => void }) {
  const [tab, setTab] = useState(coreEducationRelease ? "Users" : "Plans"),
    [plans, setPlans] = useState<Plan[]>([]),
    [name, setName] = useState(""),
    [price, setPrice] = useState(""),
    [currency, setCurrency] = useState("USD"),
    [benefits, setBenefits] = useState(""),
    [id, setId] = useState<string | null>(null),
    [reason, setReason] = useState(""),
    [busy, setBusy] = useState(false),
    [feature, setFeature] = useState(""),
    [mode, setMode] = useState("free"),
    [accessPlan, setAccessPlan] = useState(""),
    [freeThrough, setFreeThrough] = useState(""),
    [viewRate, setViewRate] = useState("1"),
    [subscriberRate, setSubscriberRate] = useState("1"),
    [threshold, setThreshold] = useState("10"),
    [role, setRole] = useState("creator"),
    [audit, setAudit] = useState<any[]>([]),
    [reports, setReports] = useState<any[]>([]),
    [users, setUsers] = useState<any[]>([]);
  async function refresh() {
    if (backend) {
      const results = await Promise.all([
        backend.from("plans").select("*"),
        backend
          .from("audit_log")
          .select("*")
          .order("created_at", { ascending: false })
          .limit(50),
        backend.from("reports").select("*").eq("status", "open"),
        backend.from("profiles").select("*").limit(100),
      ]);
      for (const r of results) if (r.error) throw r.error;
      setPlans(results[0].data || []);
      setAudit(results[1].data || []);
      setReports(results[2].data || []);
      setUsers(results[3].data || []);
    } else {
      const raw = await AsyncStorage.getItem("ef-plans");
      setPlans(raw ? JSON.parse(raw) : []);
    }
  }
  useEffect(() => {
    void refresh().catch((e) => notify(e.message));
  }, []);
  async function act(action: () => Promise<void>) {
    if (busy) return;
    setBusy(true);
    try {
      if (!reason.trim())
        throw new Error("A reason is required for this administrative action.");
      await action();
      await refresh();
      notify("Saved with an audit record.");
    } catch (e) {
      notify(e instanceof Error ? e.message : "Unable to save.");
    } finally {
      setBusy(false);
    }
  }
  async function config(kind: string, data: object) {
    if (backend) {
      const { error } = await backend.rpc("configure_platform", {
        setting_kind: kind,
        setting: data,
        reason,
      });
      if (error) throw error;
    } else {
      await AsyncStorage.setItem(`ef-config-${kind}`, JSON.stringify(data));
      setAudit((v) => [
        {
          id: Date.now(),
          action: kind,
          reason,
          created_at: new Date().toISOString(),
        },
        ...v,
      ]);
    }
  }
  function Field({
    label,
    value,
    onChange,
  }: {
    label: string;
    value: string;
    onChange: (v: string) => void;
  }) {
    return (
      <View>
        <Text style={s.label}>{label}</Text>
        <TextInput
          placeholderTextColor="#526477"
          accessibilityLabel={label}
          value={value}
          onChangeText={onChange}
          style={s.input}
        />
      </View>
    );
  }
  const field = (
    label: string,
    value: string,
    onChange: (v: string) => void,
  ) => (
    <View>
      <Text style={s.label}>{label}</Text>
      <TextInput
        placeholderTextColor="#526477"
        accessibilityLabel={label}
        value={value}
        onChangeText={onChange}
        style={s.input}
      />
    </View>
  );
  const button = (label: string, action: () => void) => (
    <Pressable
      disabled={busy}
      style={[s.button, busy && { opacity: 0.5 }]}
      onPress={action}
    >
      <Text style={s.buttonText}>{label}</Text>
    </Pressable>
  );
  return (
    <View style={s.card}>
      <Text style={s.title}>Platform management</Text>
      <View style={s.tabs}>
        {[
          "Plans",
          "Feature access",
          "Earnings rules",
          "Users",
          "Reports",
          "Audit trail",
        ]
          .filter(
            (t) =>
              !coreEducationRelease ||
              ["Users", "Reports", "Audit trail", "Earnings rules"].includes(t),
          )
          .map((t) => (
            <Pressable
              key={t}
              onPress={() => setTab(t)}
              style={[s.tab, tab === t && { backgroundColor: "#dce9d9" }]}
            >
              <Text style={s.text}>{t}</Text>
            </Pressable>
          ))}
      </View>
      {field("Reason for change", reason, setReason)}
      {tab === "Plans" && (
        <>
          {plans.map((p) => (
            <View key={p.id} style={s.record}>
              <Text style={s.title}>
                {p.name} · {p.currency} {(p.price_minor / 100).toFixed(2)}
              </Text>
              <Text style={s.text}>{p.active ? "Active" : "Inactive"}</Text>
              <Text selectable>Plan ID: {p.id}</Text>
              {button("Edit plan", () => {
                setId(p.id);
                setName(p.name);
                setPrice(String(p.price_minor / 100));
                setCurrency(p.currency);
                setBenefits(p.benefits.join("\n"));
              })}
              {button(
                p.active ? "Deactivate" : "Activate",
                () =>
                  void act(async () => {
                    if (backend) {
                      const { error } = await backend.rpc("configure_plan", {
                        plan_id: p.id,
                        plan_name: p.name,
                        amount: p.price_minor,
                        plan_currency: p.currency,
                        plan_benefits: p.benefits,
                        enabled: !p.active,
                        reason,
                      });
                      if (error) throw error;
                    } else
                      await AsyncStorage.setItem(
                        "ef-plans",
                        JSON.stringify(
                          plans.map((x) =>
                            x.id === p.id ? { ...x, active: !x.active } : x,
                          ),
                        ),
                      );
                  }),
              )}
            </View>
          ))}
          {field("Plan name", name, setName)}
          {field("Price in major currency units", price, setPrice)}
          {field("Currency (USD, GBP, ZAR, NGN)", currency, setCurrency)}
          {field("Benefits (one per line)", benefits, setBenefits)}
          {button(
            id ? "Save changes" : "Create inactive plan",
            () =>
              void act(async () => {
                if (
                  !name.trim() ||
                  !Number.isFinite(Number(price)) ||
                  Number(price) < 0 ||
                  !price ||
                  !/^[A-Z]{3}$/.test(currency)
                )
                  throw new Error(
                    "Enter a plan name, valid price, and three-letter currency.",
                  );
                const p = {
                  id:
                    id ||
                    globalThis.crypto?.randomUUID?.() ||
                    `demo-${Date.now()}`,
                  name: name.trim(),
                  price_minor: Math.round(Number(price) * 100),
                  currency,
                  benefits: benefits.split("\n").filter(Boolean),
                  active: plans.find((x) => x.id === id)?.active || false,
                };
                if (backend) {
                  const { error } = await backend.rpc("configure_plan", {
                    plan_id: id,
                    plan_name: p.name,
                    amount: p.price_minor,
                    plan_currency: currency,
                    plan_benefits: p.benefits,
                    enabled: p.active,
                    reason,
                  });
                  if (error) throw error;
                } else
                  await AsyncStorage.setItem(
                    "ef-plans",
                    JSON.stringify([...plans.filter((x) => x.id !== p.id), p]),
                  );
                setId(null);
                setName("");
                setPrice("");
                setBenefits("");
              }),
          )}
        </>
      )}
      {tab === "Feature access" && (
        <>
          {["library_downloads", "video_lessons", "language_courses"].map(
            (key) => (
              <FeatureButton
                key={key}
                label={(feature === key ? "Selected: " : "") + key}
                onPress={() => setFeature(key)}
              />
            ),
          )}
          {field("Plan UUID for paid access", accessPlan, setAccessPlan)}
          {field(
            "Temporarily free until (ISO date, optional)",
            freeThrough,
            setFreeThrough,
          )}
          <View style={s.tabs}>
            {["free", "individual", "premier", "subscription"].map((m) => (
              <Pressable
                key={m}
                style={[s.tab, mode === m && { backgroundColor: "#dce9d9" }]}
                onPress={() => setMode(m)}
              >
                <Text>{m}</Text>
              </Pressable>
            ))}
          </View>
          {button(
            "Save access rule",
            () =>
              void act(async () => {
                if (!/^[a-z][a-z0-9_]{2,60}$/.test(feature))
                  throw new Error(
                    "Use a feature identifier such as library_downloads.",
                  );
                if (!backend)
                  throw new Error(
                    "Connect the backend to manage enforced access rules.",
                  );
                if (freeThrough && !Number.isFinite(Date.parse(freeThrough)))
                  throw new Error("Enter a valid date.");
                const r = await backend.rpc("save_feature_access", {
                  feature,
                  mode,
                  plan: accessPlan.trim() || null,
                  free_through: freeThrough
                    ? new Date(freeThrough).toISOString()
                    : null,
                  reason,
                });
                if (r.error) throw r.error;
              }),
          )}
          <Text style={s.text}>
            Download, video and course access is enforced by the database using
            verified purchases. Configure store products before activating paid
            access.
          </Text>
        </>
      )}
      {tab === "Earnings rules" && (
        <>
          <View style={s.tabs}>
            {["student", "teacher", "tutor", "creator"].map((r) => (
              <Pressable
                key={r}
                style={[s.tab, role === r && { backgroundColor: "#dce9d9" }]}
                onPress={() => setRole(r)}
              >
                <Text>{r}</Text>
              </Pressable>
            ))}
          </View>
          {field("Earnings per 1,000 verified views", viewRate, setViewRate)}
          {field("Earnings per subscriber", subscriberRate, setSubscriberRate)}
          {field("Minimum payout", threshold, setThreshold)}
          {field("Currency", currency, setCurrency)}
          {button(
            "Save earnings policy",
            () =>
              void act(async () => {
                if (
                  [viewRate, subscriberRate, threshold].some(
                    (n) =>
                      !n.trim() || !Number.isFinite(Number(n)) || Number(n) < 0,
                  )
                )
                  throw new Error("Rates must be non-negative numbers.");
                if (!/^[A-Z]{3}$/.test(currency))
                  throw new Error("Use a three-letter currency.");
                await config("earnings", {
                  role,
                  view_rate: Number(viewRate) / 1000,
                  active: true,
                  subscriber_rate: Number(subscriberRate),
                  minimum_payout_minor: Math.round(Number(threshold) * 100),
                  currency,
                });
              }),
          )}
          <Text style={s.text}>
            Policies do not create earnings automatically. Activity verification
            and payout processing must be deployed separately.
          </Text>
        </>
      )}
      {tab === "Users" && (
        <>
          {!backend && (
            <Text style={s.text}>
              User management is available after connecting the backend.
            </Text>
          )}
          {users.map((u) => (
            <View style={s.record} key={u.id}>
              <Text style={s.title}>{u.display_name || u.id}</Text>
              <Text style={s.text}>
                {u.role} · {u.suspended ? "Suspended" : "Active"}
              </Text>
              <View style={s.tabs}>
                {["student", "teacher", "tutor", "creator"].map((role) => (
                  <FeatureButton
                    key={role}
                    label={"Set role: " + role}
                    disabled={busy || ["owner", "admin"].includes(u.role)}
                    onPress={() =>
                      void act(async () => {
                        const r = await backend!.rpc("set_educator_role", {
                          target_user: u.id,
                          new_role: role,
                          reason,
                        });
                        if (r.error) throw r.error;
                      })
                    }
                  />
                ))}
              </View>
              {button(
                u.moderator
                  ? "Remove moderator access"
                  : "Grant moderator access",
                () =>
                  void act(async () => {
                    const { error } = await backend!.rpc("set_moderator", {
                      target_id: u.id,
                      enabled: !u.moderator,
                    });
                    if (error) throw error;
                    await refresh();
                  }),
              )}
              {button(
                u.suspended ? "Restore account" : "Suspend account",
                () =>
                  void act(() =>
                    config("user", { id: u.id, suspended: !u.suspended }),
                  ),
              )}
            </View>
          ))}
        </>
      )}
      {tab === "Reports" && (
        <>
          {reports.length === 0 && <Text style={s.text}>No open reports.</Text>}
          {reports.map((r) => (
            <View style={s.record} key={r.id}>
              <Text style={s.text}>{r.reason}</Text>
              {button(
                "Mark reviewed",
                () =>
                  void act(() =>
                    config("report", { id: r.id, status: "reviewed" }),
                  ),
              )}
            </View>
          ))}
        </>
      )}
      {tab === "Audit trail" && (
        <>
          {audit.length === 0 && (
            <Text style={s.text}>No configuration decisions recorded yet.</Text>
          )}
          {audit.map((a) => (
            <View key={a.id} style={s.record}>
              <Text style={s.title}>{a.action}</Text>
              <Text style={s.text}>{a.reason}</Text>
              <Text style={s.label}>
                {new Date(a.created_at).toLocaleString()}
              </Text>
            </View>
          ))}
        </>
      )}
    </View>
  );
}
const s = StyleSheet.create({
  card: {
    padding: 22,
    backgroundColor: "white",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#e3e8dc",
    gap: 14,
    marginVertical: 15,
  },
  title: { fontSize: 18, fontWeight: "600", color: "#304536" },
  text: { fontSize: 13, color: "#71806c", lineHeight: 22 },
  label: { fontSize: 12, color: "#4d654d", marginBottom: 6 },
  input: {
    borderWidth: 1,
    borderColor: "#d7dfd0",
    padding: 13,
    borderRadius: 7,
    color: "#2c4936",
    marginBottom: 14,
  },
  tabs: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  tab: { padding: 10, borderRadius: 6, backgroundColor: "#f1f4ed" },
  button: {
    padding: 13,
    borderRadius: 7,
    backgroundColor: "#2c5744",
    marginVertical: 5,
    alignItems: "center",
  },
  buttonText: { color: "white", fontSize: 12, fontWeight: "600" },
  price: { fontSize: 30, color: "#304536" },
  record: {
    paddingVertical: 16,
    gap: 8,
    borderBottomWidth: 1,
    borderColor: "#e6ecdf",
  },
});
