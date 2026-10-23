import React, { useEffect, useRef, useState } from "react";
import { View, Text, TextInput } from "./Theme";
import { backend } from "./backend";
import { FeatureButton, useTask } from "./FeatureWorkflows";
import { Avatar } from "./IdentitySettings";
import { SelectField } from "./FormControls";
type Person = {
  id: string;
  username: string;
  display_name: string;
  avatar_path: string | null;
};
type Message = {
  id: string;
  body: string;
  created_at: string;
  sender_id?: string;
  recipient_id?: string;
  user_id?: string;
};
export function Chat({
  userId,
  languageBoard = false,
}: {
  userId?: string;
  languageBoard?: boolean;
}) {
  const task = useTask();
  const generation = useRef(0);
  const [search, setSearch] = useState(""),
    [people, setPeople] = useState<Person[]>([]),
    [selected, setSelected] = useState<Person | null>(null),
    [messages, setMessages] = useState<Message[]>([]),
    [names, setNames] = useState<Record<string, Person>>({}),
    [draft, setDraft] = useState(""),
    [languages, setLanguages] = useState<{ id: string; name: string }[]>([]),
    [language, setLanguage] = useState(""),
    [blocked, setBlocked] = useState<string[]>([]),
    [report, setReport] = useState("");
  async function load() {
    if (!backend || !userId) return;
    const version = generation.current;
    const b = await backend.from("user_blocks").select("blocked_id");
    if (version !== generation.current) return;
    if (b.error) throw b.error;
    setBlocked((b.data || []).map((x) => x.blocked_id));
    let q = languageBoard
      ? backend
          .from("language_messages")
          .select("id,body,created_at,user_id")
          .eq("language_id", language)
      : backend
          .from("direct_messages")
          .select("id,body,created_at,sender_id,recipient_id");
    if (languageBoard && !language) return;
    if (!languageBoard && selected)
      q = q.or(
        `and(sender_id.eq.${userId},recipient_id.eq.${selected.id}),and(sender_id.eq.${selected.id},recipient_id.eq.${userId})`,
      );
    const r = await q.order("created_at", { ascending: false }).limit(100);
    if (version !== generation.current) return;
    if (r.error) throw r.error;
    setMessages((r.data || []).reverse());
    const ids = [
      ...new Set(
        (r.data || []).flatMap((m: any) =>
          [m.user_id, m.sender_id, m.recipient_id].filter(Boolean),
        ),
      ),
    ];
    if (ids.length) {
      const p = await backend.rpc("public_people", { ids });
      if (version !== generation.current) return;
      if (p.error) throw p.error;
      setNames(
        Object.fromEntries((p.data || []).map((x: Person) => [x.id, x])),
      );
    }
  }
  useEffect(() => {
    if (!backend || !userId) return;
    void task.run(async () => {
      if (languageBoard) {
        const r = await backend!
          .from("languages")
          .select("id,name")
          .eq("active", true);
        if (r.error) throw r.error;
        setLanguages(r.data || []);
        if (!language && r.data?.length) setLanguage(r.data[0].id);
      }
    });
  }, [userId, languageBoard]);
  useEffect(() => {
    const version = ++generation.current;
    setMessages([]);
    setNames({});
    setDraft("");
    setReport("");
    const refresh = () =>
      void load().catch(() => {
        if (version === generation.current)
          task.setNotice(
            "Messages could not refresh. Check your connection and retry.",
          );
      });
    refresh();
    const timer = setInterval(refresh, 10000);
    return () => {
      generation.current++;
      clearInterval(timer);
    };
  }, [userId, selected?.id, language, languageBoard]);
  if (!userId || !backend) return <Text>Sign in to join conversations.</Text>;
  const visible = messages.filter(
    (m) =>
      !blocked.includes(m.user_id || m.sender_id || "") &&
      (languageBoard ||
        (!!selected &&
          (m.sender_id === selected.id || m.recipient_id === selected.id))),
  );
  return (
    <View style={{ gap: 12 }}>
      <Text style={{ fontSize: 26, fontWeight: "700" }}>
        {languageBoard ? "Language practice board" : "Direct messages"}
      </Text>
      <Text>
        {languageBoard
          ? "Practise in your chosen language. Posts are visible to other signed-in learners. Do not post private information."
          : "Private one-to-one conversations. You can block a user or report an individual message for review."}
      </Text>
      <Text accessibilityRole="alert">{task.notice}</Text>
      {languageBoard ? (
        <SelectField
          label="Practice language"
          value={language}
          options={languages.map((l) => ({ value: l.id, label: l.name }))}
          onChange={setLanguage}
        />
      ) : (
        <>
          <TextInput
            accessibilityLabel="Find username"
            placeholder="Find a username"
            value={search}
            onChangeText={setSearch}
            autoCapitalize="none"
            style={{ padding: 12, borderWidth: 1, borderColor: "#b5c9bd" }}
          />
          <FeatureButton
            label="Find people"
            disabled={task.busy}
            onPress={() =>
              void task.run(async () => {
                const r = await backend!.rpc("find_people", { term: search });
                if (r.error) throw r.error;
                setPeople(
                  (r.data || []).filter((p: Person) => p.id !== userId),
                );
              })
            }
          />
          {people.map((p) => (
            <View
              key={p.id}
              style={{ flexDirection: "row", alignItems: "center", gap: 10 }}
            >
              <Avatar path={p.avatar_path} size={40} />
              <FeatureButton
                label={`Message ☆${p.username}`}
                onPress={() => {
                  setSelected(p);
                  setPeople([]);
                  setMessages([]);
                }}
              />
            </View>
          ))}
          {selected ? (
            <>
              <Text>Conversation with ☆{selected.username}</Text>
              <FeatureButton
                label="Back to inbox"
                onPress={() => {
                  setSelected(null);
                  setMessages([]);
                }}
              />
              <FeatureButton
                label={
                  blocked.includes(selected.id) ? "Unblock user" : "Block user"
                }
                onPress={() =>
                  void task.run(async () => {
                    const r = blocked.includes(selected.id)
                      ? await backend!
                          .from("user_blocks")
                          .delete()
                          .eq("user_id", userId)
                          .eq("blocked_id", selected.id)
                      : await backend!
                          .from("user_blocks")
                          .insert({ user_id: userId, blocked_id: selected.id });
                    if (r.error) throw r.error;
                    await load();
                  })
                }
              />
            </>
          ) : (
            <>
              {[
                ...new Set(
                  messages.map((m) =>
                    m.sender_id === userId ? m.recipient_id : m.sender_id,
                  ),
                ),
              ]
                .filter(Boolean)
                .map(
                  (id) =>
                    names[id!] && (
                      <FeatureButton
                        key={id}
                        label={`Open ☆${names[id!].username}`}
                        onPress={() => setSelected(names[id!])}
                      />
                    ),
                )}
            </>
          )}
        </>
      )}
      <FeatureButton
        label="Refresh messages"
        disabled={task.busy}
        onPress={() => void task.run(load)}
      />
      {(languageBoard || selected) && (
        <>
          {visible.map((m) => (
            <View
              key={m.id}
              style={{
                padding: 12,
                borderRadius: 12,
                backgroundColor:
                  (m.user_id || m.sender_id) === userId ? "#e0eee2" : "white",
                gap: 6,
              }}
            >
              <Text style={{ fontWeight: "700" }}>
                ☆{names[m.user_id || m.sender_id || ""]?.username || "learner"}
              </Text>
              <Text>{m.body}</Text>
              <Text>{new Date(m.created_at).toLocaleString()}</Text>
              {(m.user_id || m.sender_id) !== userId && (
                <FeatureButton
                  label="Report message"
                  onPress={() => setReport(m.id)}
                />
              )}
            </View>
          ))}
          {report && (
            <ReportMessage
              id={report}
              languageBoard={languageBoard}
              userId={userId}
              done={() => setReport("")}
            />
          )}
          <TextInput
            accessibilityLabel="Message"
            placeholder={
              languageBoard
                ? "Write in the language you are learning"
                : "Write a message"
            }
            value={draft}
            onChangeText={setDraft}
            multiline
            maxLength={2000}
            style={{ padding: 14, borderWidth: 1, borderColor: "#b5c9bd" }}
          />
          <FeatureButton
            label="Send message"
            disabled={
              task.busy ||
              (!languageBoard && !!selected && blocked.includes(selected.id))
            }
            onPress={() =>
              void task.run(async () => {
                if (!draft.trim()) throw new Error("Write a message first.");
                const version = generation.current;
                const r = languageBoard
                  ? await backend!.from("language_messages").insert({
                      user_id: userId,
                      language_id: language,
                      body: draft.trim(),
                    })
                  : await backend!.from("direct_messages").insert({
                      sender_id: userId,
                      recipient_id: selected!.id,
                      body: draft.trim(),
                    });
                if (r.error) throw r.error;
                if (version !== generation.current) return;
                setDraft("");
                await load();
              })
            }
          />
        </>
      )}
    </View>
  );
}
function ReportMessage({
  id,
  userId,
  languageBoard,
  done,
}: {
  id: string;
  userId: string;
  languageBoard: boolean;
  done: () => void;
}) {
  const task = useTask(),
    [reason, setReason] = useState("");
  return (
    <View>
      <TextInput
        accessibilityLabel="Message report reason"
        placeholder="Explain the report"
        value={reason}
        onChangeText={setReason}
      />
      <Text>{task.notice}</Text>
      <FeatureButton
        label="Submit message report"
        disabled={task.busy}
        onPress={() =>
          void task.run(async () => {
            if (reason.trim().length < 5)
              throw new Error("Explain why you are reporting this message.");
            const r = await backend!.from("chat_reports").insert({
              reporter_id: userId,
              reason: reason.trim(),
              [languageBoard ? "language_message" : "direct_message"]: id,
            });
            if (r.error) throw r.error;
            done();
          })
        }
      />
      <FeatureButton label="Cancel report" onPress={done} />
    </View>
  );
}
export function ChatModeration() {
  const task = useTask(),
    [items, setItems] = useState<any[]>([]);
  async function load() {
    const r = await backend!.rpc("reported_messages");
    if (r.error) throw r.error;
    setItems(r.data || []);
  }
  useEffect(() => {
    void task.run(load);
  }, []);
  return (
    <View style={{ gap: 12 }}>
      <Text style={{ fontSize: 22 }}>Reported messages</Text>
      <Text>{task.notice}</Text>
      <FeatureButton
        label="Refresh message reports"
        onPress={() => void task.run(load)}
      />
      {items.map((r) => (
        <View key={r.report_id}>
          <Text>{r.reason}</Text>
          <Text>{r.body}</Text>
          <Text>{r.resolved ? "Reviewed" : "Open"}</Text>
          {!r.resolved && (
            <FeatureButton
              label="Mark report reviewed"
              onPress={() =>
                void task.run(async () => {
                  const result = await backend!
                    .from("chat_reports")
                    .update({ resolved: true })
                    .eq("id", r.report_id);
                  if (result.error) throw result.error;
                  await load();
                })
              }
            />
          )}
        </View>
      ))}
    </View>
  );
}
