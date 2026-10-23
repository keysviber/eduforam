import React, { useEffect, useRef, useState } from "react";
import { View, Text, TextInput, StyleSheet } from "./Theme";
import { backend } from "./backend";
import { FeatureButton } from "./FeatureWorkflows";
import type { Entry } from "./domain";
type Agreement = {
  id: string;
  entry_id: string;
  student_id: string;
  stage: string;
  amount_minor: number;
  currency: string;
  conditions: string;
};
export function FundingWorkflows({
  userId,
  admin,
  entries,
}: {
  userId?: string;
  admin: boolean;
  entries: Entry[];
}) {
  const [cases, setCases] = useState<Agreement[]>([]),
    [messages, setMessages] = useState<
      { id: string; agreement_id: string; body: string; created_at: string }[]
    >([]),
    [drafts, setDrafts] = useState<Record<string, string>>({});
  const [entry, setEntry] = useState(""),
    [stage, setStage] = useState("review"),
    [amount, setAmount] = useState(""),
    [currency, setCurrency] = useState("USD"),
    [terms, setTerms] = useState(""),
    [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false),
    [notice, setNotice] = useState("");
  const lock = useRef(false);
  async function load() {
    if (!backend || !userId) return;
    const [c, m] = await Promise.all([
      backend
        .from("funding_agreements")
        .select("id,entry_id,student_id,stage,amount_minor,currency,conditions")
        .order("created_at", { ascending: false }),
      backend
        .from("funding_messages")
        .select("id,agreement_id,body,created_at")
        .order("created_at")
        .limit(200),
    ]);
    if (c.error || m.error) throw c.error || m.error;
    setCases(c.data || []);
    setMessages(m.data || []);
  }
  async function run(fn: () => Promise<void>) {
    if (lock.current) return;
    lock.current = true;
    setBusy(true);
    setNotice("");
    try {
      await fn();
    } catch (e) {
      setNotice((e as Error).message || "Unable to complete funding action.");
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }
  useEffect(() => {
    void run(load);
  }, [userId]);
  const field = (label: string, value: string, set: (v: string) => void) => (
    <View>
      <Text>{label}</Text>
      <TextInput
        style={s.input}
        accessibilityLabel={label}
        value={value}
        onChangeText={set}
        multiline
      />
    </View>
  );
  return (
    <View style={s.stack}>
      <Text style={s.title}>My support cases</Text>
      <Text>
        Discuss approved assistance and project proposals privately with
        administrators. Case amounts describe proposed support; they do not mean
        money has been paid. Donation checkout and disbursement require a
        connected payment provider.
      </Text>
      {!!notice && <Text accessibilityRole="alert">{notice}</Text>}
      <FeatureButton
        label="Refresh support cases"
        disabled={busy || !userId || !backend}
        onPress={() => void run(load)}
      />
      {!userId && <Text>Sign in to view your private cases.</Text>}
      {userId && !cases.length && (
        <Text>
          No funding cases yet. Submit an assistance request or project idea for
          review.
        </Text>
      )}
      {cases.map((c) => (
        <View key={c.id} style={s.card}>
          <Text style={s.title}>
            {entries.find((e) => e.id === c.entry_id)?.title ||
              "Private support case"}
          </Text>
          <Text>
            {c.stage} - proposed {c.currency}{" "}
            {(c.amount_minor / 100).toFixed(2)}
          </Text>
          <Text>{c.conditions}</Text>
          {messages
            .filter((m) => m.agreement_id === c.id)
            .map((m) => (
              <View key={m.id}>
                <Text>{m.body}</Text>
                <Text>{new Date(m.created_at).toLocaleString()}</Text>
              </View>
            ))}
          {!["completed", "suspended"].includes(c.stage) && (
            <>
              {field(`Case update ${c.id}`, drafts[c.id] || "", (v) =>
                setDrafts({ ...drafts, [c.id]: v }),
              )}
              <FeatureButton
                label="Send private update"
                disabled={busy}
                onPress={() =>
                  void run(async () => {
                    const body = (drafts[c.id] || "").trim();
                    if (body.length < 3 || body.length > 4000)
                      throw new Error(
                        "Enter an update between 3 and 4000 characters.",
                      );
                    const r = await backend!
                      .from("funding_messages")
                      .insert({ agreement_id: c.id, author_id: userId, body });
                    if (r.error) throw r.error;
                    setDrafts({ ...drafts, [c.id]: "" });
                    await load();
                    setNotice("Private update sent.");
                  })
                }
              />
            </>
          )}
          {admin && (
            <FeatureButton
              label="Edit case terms"
              onPress={() => {
                setEntry(c.entry_id);
                setStage(c.stage);
                setAmount(String(c.amount_minor / 100));
                setCurrency(c.currency);
                setTerms(c.conditions);
              }}
            />
          )}
        </View>
      ))}
      {admin && (
        <View style={s.card}>
          <Text style={s.title}>Manage support case</Text>
          {entries
            .filter(
              (e) =>
                e.status === "approved" &&
                ["assistance", "idea"].includes(e.kind),
            )
            .map((e) => (
              <FeatureButton
                key={e.id}
                label={(entry === e.id ? "Selected: " : "") + e.title}
                onPress={() => setEntry(e.id)}
              />
            ))}
          {[
            "review",
            "negotiation",
            "agreement",
            "progress",
            "completed",
            "suspended",
          ].map((x) => (
            <FeatureButton
              key={x}
              label={(stage === x ? "Selected: " : "") + x}
              onPress={() => setStage(x)}
            />
          ))}
          {field("Proposed funding amount", amount, setAmount)}
          {field("Funding currency", currency, setCurrency)}
          {field("Case terms", terms, setTerms)}
          {field("Funding decision reason", reason, setReason)}
          <FeatureButton
            label="Save case and notify learner"
            disabled={busy}
            onPress={() =>
              void run(async () => {
                const value = Number(amount);
                if (
                  !entry ||
                  !Number.isFinite(value) ||
                  value <= 0 ||
                  !Number.isSafeInteger(Math.round(value * 100))
                )
                  throw new Error(
                    "Select an approved application and enter a valid amount.",
                  );
                const r = await backend!.rpc("manage_funding", {
                  entry,
                  new_stage: stage,
                  amount: Math.round(value * 100),
                  unit_currency: currency.toUpperCase(),
                  terms,
                  reason,
                });
                if (r.error) throw r.error;
                await load();
                setNotice("Case updated. No money was transferred.");
              })
            }
          />
        </View>
      )}
    </View>
  );
}
const s = StyleSheet.create({
  stack: { gap: 12 },
  card: {
    padding: 18,
    gap: 12,
    backgroundColor: "white",
    borderRadius: 14,
    marginVertical: 8,
  },
  title: { fontSize: 22, fontWeight: "700", color: "#244d41" },
  input: {
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#c8d6cb",
    marginTop: 6,
  },
});
