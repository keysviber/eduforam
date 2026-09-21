import React, { useEffect, useState } from "react";
import { View, Text, TextInput, Pressable, StyleSheet } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { backend } from "./backend";
export type Plan = {
  id: string;
  name: string;
  price_minor: number;
  currency: string;
  benefits: string[];
  active: boolean;
};
export function Plans({ notify }: { notify: (s: string) => void }) {
  const [plans, setPlans] = useState<Plan[]>([]);
  useEffect(() => {
    if (backend)
      backend
        .from("plans")
        .select("*")
        .eq("active", true)
        .then(({ data, error }) => {
          if (error) notify(error.message);
          else setPlans(data || []);
        });
    else
      AsyncStorage.getItem("ef-plans")
        .then((v) =>
          setPlans(v ? JSON.parse(v).filter((p: Plan) => p.active) : []),
        )
        .catch(() => notify("Could not load plans."));
  }, []);
  return (
    <View>
      {plans.map((p) => (
        <View style={s.card} key={p.id}>
          <Text style={s.title}>{p.name}</Text>
          <Text style={s.price}>
            {p.currency} {(p.price_minor / 100).toFixed(2)}
          </Text>
          {p.benefits.map((b) => (
            <Text key={b} style={s.text}>
              ✓ {b}
            </Text>
          ))}
          <Pressable
            style={s.button}
            onPress={() =>
              notify(
                "Purchases are not enabled. Store billing and verified payment processing must be connected first.",
              )
            }
          >
            <Text style={s.buttonText}>View subscription availability</Text>
          </Pressable>
        </View>
      ))}
      {plans.length === 0 && <Text style={s.text}>No active plans yet.</Text>}
    </View>
  );
}
export function Management({ notify }: { notify: (s: string) => void }) {
  const [tab, setTab] = useState("Plans"),
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
    [viewRate, setViewRate] = useState("0.001"),
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
        ].map((t) => (
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
          {field("Feature identifier", feature, setFeature)}
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
                await config("feature", {
                  feature_key: feature,
                  access_mode: mode,
                });
              }),
          )}
          <Text style={s.text}>
            Rules are stored centrally. Feature entitlement enforcement still
            requires verified subscriptions and purchase receipts.
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
          {field("Earnings per verified view", viewRate, setViewRate)}
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
                  view_rate: Number(viewRate),
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
