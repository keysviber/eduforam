import React, { useEffect, useRef, useState } from "react";
import { View, Text, TextInput, Pressable, StyleSheet } from "./Theme";
import { backend } from "./backend";
import { authErrorMessage } from "./auth-errors";
import type { Entry } from "./domain";

export function FeatureButton({
  label,
  onPress,
  disabled = false,
}: {
  label: string;
  onPress: () => void;
  disabled?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      style={[s.button, disabled && { opacity: 0.5 }]}
    >
      <Text style={s.buttonText}>{label}</Text>
    </Pressable>
  );
}
function Field({
  label,
  value,
  change,
  multiline = false,
}: {
  label: string;
  value: string;
  change: (v: string) => void;
  multiline?: boolean;
}) {
  return (
    <View>
      <Text>{label}</Text>
      <TextInput
        accessibilityLabel={label}
        value={value}
        onChangeText={change}
        multiline={multiline}
        style={s.input}
        placeholderTextColor="#526477"
      />
    </View>
  );
}
export function useTask() {
  const [busy, setBusy] = useState(false),
    [notice, setNotice] = useState("");
  const lock = useRef(false);
  async function run(fn: () => Promise<void>) {
    if (lock.current) return;
    lock.current = true;
    setBusy(true);
    setNotice("");
    try {
      await fn();
    } catch (e) {
      setNotice(authErrorMessage(e));
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }
  return { busy, notice, setNotice, run };
}
function Notice({ text }: { text: string }) {
  return text ? <Text accessibilityRole="alert">{text}</Text> : null;
}

export function ProfileSettings({ userId }: { userId?: string }) {
  const [name, setName] = useState(""),
    [first, setFirst] = useState(""),
    [last, setLast] = useState(""),
    [country, setCountry] = useState(""),
    [bio, setBio] = useState("");
  const [listed, setListed] = useState(false),
    [loaded, setLoaded] = useState(false),
    [message, setMessage] = useState("");
  const [kind, setKind] = useState<"support" | "deletion">("support"),
    [confirm, setConfirm] = useState("");
  const [requests, setRequests] = useState<
    {
      id: string;
      kind: string;
      status: string;
      message: string;
      response: string;
    }[]
  >([]);
  const task = useTask();
  async function load() {
    if (!backend || !userId) return;
    const [p, r] = await Promise.all([
      backend!
        .from("profiles")
        .select("display_name,first_name,surname,country,bio,discoverable")
        .eq("id", userId)
        .single(),
      backend!
        .from("account_requests")
        .select("id,kind,status,message,response")
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(30),
    ]);
    if (p.error || r.error) throw p.error || r.error;
    setName(p.data.display_name);
    setFirst(p.data.first_name);
    setLast(p.data.surname);
    setCountry(p.data.country);
    setBio(p.data.bio);
    setListed(p.data.discoverable);
    setRequests(r.data || []);
    setLoaded(true);
  }
  useEffect(() => {
    void task.run(load);
  }, [userId]);
  if (!backend || !userId)
    return (
      <Text>Sign in to edit your profile or contact account support.</Text>
    );
  return (
    <View style={s.stack}>
      <Text style={s.title}>Profile and support</Text>
      <Notice text={task.notice} />
      <FeatureButton
        label="Refresh profile"
        disabled={task.busy}
        onPress={() => void task.run(load)}
      />
      {loaded && (
        <View style={s.card}>
          <Field label="Display name" value={name} change={setName} />
          <Field label="First name" value={first} change={setFirst} />
          <Field label="Surname" value={last} change={setLast} />
          <Text>
            Country: {country}. Change it with your education system in
            Settings.
          </Text>
          <Field label="About me" value={bio} change={setBio} multiline />
          <FeatureButton
            label={
              listed
                ? "Educator directory: opted in"
                : "Educator directory: private"
            }
            onPress={() => setListed(!listed)}
          />
          <Text>
            Only staff-verified teachers, tutors and creators who opt in appear
            in the public directory. Only your display name and biography are
            shown.
          </Text>
          <FeatureButton
            label="Save profile"
            disabled={task.busy}
            onPress={() =>
              void task.run(async () => {
                const r = await backend!.rpc("update_my_profile", {
                  public_name: name,
                  given_name: first,
                  family_name: last,
                  home_country: country,
                  biography: bio,
                  listed,
                });
                if (r.error) throw r.error;
                task.setNotice("Profile saved.");
              })
            }
          />
        </View>
      )}
      <View style={s.card}>
        <Text style={s.title}>Account requests</Text>
        <FeatureButton
          label={
            kind === "support"
              ? "Request account deletion"
              : "Contact account support instead"
          }
          onPress={() => {
            setKind(kind === "support" ? "deletion" : "support");
            setConfirm("");
          }}
        />
        <Text>
          {kind === "deletion"
            ? "This sends a private deletion request to the account administrator. Your account remains active until the request is processed. Any records that must be retained will be explained in the response."
            : "Send a private account question to the administrator. This is not live or emergency support."}
        </Text>
        <Field
          label="Account request message"
          value={message}
          change={setMessage}
          multiline
        />
        {kind === "deletion" && (
          <Field
            label="Type DELETE to confirm request"
            value={confirm}
            change={setConfirm}
          />
        )}
        <FeatureButton
          label={
            kind === "deletion"
              ? "Submit deletion request"
              : "Send account request"
          }
          disabled={task.busy}
          onPress={() =>
            void task.run(async () => {
              if (message.trim().length < 3 || message.length > 2000)
                throw new Error(
                  "Enter a message between 3 and 2000 characters.",
                );
              if (kind === "deletion" && confirm !== "DELETE")
                throw new Error("Type DELETE to confirm your request.");
              const r = await backend!
                .from("account_requests")
                .insert({ user_id: userId, kind, message: message.trim() });
              if (r.error?.code === "23505")
                throw new Error(
                  "You already have an open deletion request. Check its status below.",
                );
              if (r.error) throw r.error;
              setMessage("");
              setConfirm("");
              await load();
              task.setNotice("Your private request has been submitted.");
            })
          }
        />
        {requests.map((r) => (
          <View key={r.id} style={s.card}>
            <Text>
              {r.kind} - {r.status}
            </Text>
            <Text>{r.message}</Text>
            {!!r.response && <Text>Administrator: {r.response}</Text>}
          </View>
        ))}
      </View>
    </View>
  );
}

export function EducatorDirectory({ userId }: { userId?: string }) {
  const [people, setPeople] = useState<
      {
        id: string;
        display_name: string;
        bio: string;
        role: string;
        followers: number;
      }[]
    >([]),
    [following, setFollowing] = useState<string[]>([]),
    [search, setSearch] = useState("");
  const task = useTask();
  async function load() {
    if (!backend) return;
    const p = await backend!.rpc("educator_directory");
    if (p.error) throw p.error;
    setPeople(p.data || []);
    if (userId) {
      const f = await backend!
        .from("educator_follows")
        .select("educator_id")
        .eq("follower_id", userId);
      if (f.error) throw f.error;
      setFollowing((f.data || []).map((x) => x.educator_id));
    }
  }
  useEffect(() => {
    void task.run(load);
  }, [userId]);
  return (
    <View style={s.stack}>
      <Text style={s.title}>Teachers and creators</Text>
      <Text>
        Discover educators verified by the platform. Following is free.
      </Text>
      <Notice text={task.notice} />
      <Field label="Search educators" value={search} change={setSearch} />
      <FeatureButton
        label="Refresh educators"
        disabled={task.busy || !backend}
        onPress={() => void task.run(load)}
      />
      {!people.length && <Text>No educators have been listed yet.</Text>}
      {people
        .filter((p) =>
          `${p.display_name} ${p.bio} ${p.role}`
            .toLowerCase()
            .includes(search.toLowerCase()),
        )
        .map((p) => (
          <View key={p.id} style={s.card}>
            <Text style={s.title}>{p.display_name}</Text>
            <Text>
              {p.role} - {p.followers} followers
            </Text>
            <Text>{p.bio}</Text>
            <FeatureButton
              disabled={task.busy || !userId || userId === p.id}
              label={following.includes(p.id) ? "Unfollow" : "Follow educator"}
              onPress={() =>
                void task.run(async () => {
                  const r = await backend!.rpc("follow_educator", {
                    educator: p.id,
                    following: !following.includes(p.id),
                  });
                  if (r.error) throw r.error;
                  await load();
                })
              }
            />
          </View>
        ))}
    </View>
  );
}

export function TransactionHistory({
  userId,
  admin = false,
}: {
  userId?: string;
  admin?: boolean;
}) {
  const [items, setItems] = useState<
    {
      id: string;
      purpose: string;
      amount_minor: number;
      currency: string;
      status: string;
      created_at: string;
    }[]
  >([]);
  const [loaded, setLoaded] = useState(false);
  const task = useTask();
  async function load() {
    if (!backend || !userId) return;
    let query = backend!
      .from("transactions")
      .select("id,purpose,amount_minor,currency,status,created_at")
      .order("created_at", { ascending: false })
      .limit(100);
    if (!admin) query = query.eq("user_id", userId);
    const r = await query;
    if (r.error) throw r.error;
    setItems(r.data || []);
    setLoaded(true);
  }
  useEffect(() => {
    void task.run(load);
  }, [userId, admin]);
  return (
    <View style={s.card}>
      <Text style={s.title}>
        {admin ? "Platform transactions" : "My transactions"}
      </Text>
      <Notice text={task.notice} />
      <FeatureButton
        label="Refresh transactions"
        disabled={task.busy || !userId || !backend}
        onPress={() => void task.run(load)}
      />
      {!userId && <Text>Sign in to see your transaction history.</Text>}
      {loaded && !items.length && <Text>No recorded transactions yet.</Text>}
      {items.map((r) => (
        <View key={r.id} style={s.card}>
          <Text>
            {r.purpose} - {r.currency} {(r.amount_minor / 100).toFixed(2)}
          </Text>
          <Text>
            {r.status} - {new Date(r.created_at).toLocaleDateString()}
          </Text>
          <Text selectable>Reference: {r.id}</Text>
        </View>
      ))}
    </View>
  );
}

export function SubmissionEditor({
  entry,
  refreshed,
}: {
  entry: Entry;
  refreshed: () => Promise<void>;
}) {
  const [editing, setEditing] = useState(false),
    [title, setTitle] = useState(entry.title),
    [body, setBody] = useState(entry.description);
  const task = useTask();
  if (
    !["pending", "rejected", "changes_requested"].includes(entry.status) ||
    !backend
  )
    return null;
  return (
    <View style={s.stack}>
      <Notice text={task.notice} />
      <FeatureButton
        label={editing ? "Cancel editing" : "Edit and resubmit"}
        disabled={task.busy}
        onPress={() => setEditing(!editing)}
      />
      {editing && (
        <>
          <Field label="Revised title" value={title} change={setTitle} />
          <Field
            label="Revised description"
            value={body}
            change={setBody}
            multiline
          />
          <FeatureButton
            label="Send for review again"
            disabled={task.busy}
            onPress={() =>
              void task.run(async () => {
                const r = await backend!.rpc("revise_submission", {
                  entry: entry.id,
                  new_title: title,
                  new_description: body,
                });
                if (r.error) throw r.error;
                await refreshed();
                setEditing(false);
                task.setNotice("Resubmitted for review.");
              })
            }
          />
        </>
      )}
    </View>
  );
}

export function ReadingProgress({
  userId,
  entryId,
  open,
}: {
  userId?: string;
  entryId: string;
  open: (page: number) => Promise<void>;
}) {
  const [page, setPage] = useState("1");
  const task = useTask();
  useEffect(() => {
    if (backend && userId)
      void task.run(async () => {
        const r = await backend!
          .from("reader_progress")
          .select("page")
          .eq("user_id", userId)
          .eq("entry_id", entryId)
          .maybeSingle();
        if (r.error) throw r.error;
        setPage(String(r.data?.page || 1));
      });
  }, [userId, entryId]);
  return (
    <View style={s.card}>
      <Text style={s.title}>Reading progress</Text>
      <Notice text={task.notice} />
      <Field label="Page number" value={page} change={setPage} />
      <Text>
        Save your page across devices. Some external PDF readers may require you
        to select the saved page manually.
      </Text>
      <FeatureButton
        label="Save page and open file"
        disabled={task.busy || !userId}
        onPress={() =>
          void task.run(async () => {
            const n = Number(page);
            if (!Number.isInteger(n) || n < 1 || n > 100000)
              throw new Error("Enter a valid page number.");
            const r = await backend!.from("reader_progress").upsert({
              user_id: userId,
              entry_id: entryId,
              page: n,
              updated_at: new Date().toISOString(),
            });
            if (r.error) throw r.error;
            await open(n);
            task.setNotice("Reading page saved.");
          })
        }
      />
    </View>
  );
}

export function AccountRequestAdministration() {
  const [items, setItems] = useState<
      {
        id: string;
        user_id: string;
        kind: string;
        message: string;
        status: string;
        response: string;
      }[]
    >([]),
    [replies, setReplies] = useState<Record<string, string>>({});
  const task = useTask();
  async function load() {
    if (!backend) return;
    const r = await backend!
      .from("account_requests")
      .select("id,user_id,kind,message,status,response")
      .in("status", ["open", "processing"])
      .order("created_at")
      .limit(100);
    if (r.error) throw r.error;
    setItems(r.data || []);
  }
  useEffect(() => {
    void task.run(load);
  }, []);
  return (
    <View style={s.card}>
      <Text style={s.title}>Account support and deletion requests</Text>
      <Text>
        Review deletion requests and perform the required account/data removal
        before reporting completion. A response here does not delete an account.
      </Text>
      <Notice text={task.notice} />
      <FeatureButton
        label="Refresh account requests"
        disabled={task.busy}
        onPress={() => void task.run(load)}
      />
      {!items.length && <Text>No open requests.</Text>}
      {items.map((r) => (
        <View key={r.id} style={s.card}>
          <Text>
            {r.kind} - {r.status}
          </Text>
          <Text selectable>{r.user_id}</Text>
          <Text>{r.message}</Text>
          <Field
            label={`Response to ${r.id}`}
            value={replies[r.id] ?? r.response}
            change={(v) => setReplies({ ...replies, [r.id]: v })}
            multiline
          />
          {["processing", "answered"].map((status) => (
            <FeatureButton
              key={status}
              disabled={task.busy}
              label={
                status === "processing" ? "Mark processing" : "Send response"
              }
              onPress={() =>
                void task.run(async () => {
                  const result = await backend!.rpc("respond_account_request", {
                    request_id: r.id,
                    reply: replies[r.id] ?? r.response,
                    next_status: status,
                  });
                  if (result.error) throw result.error;
                  await load();
                })
              }
            />
          ))}
        </View>
      ))}
    </View>
  );
}

const s = StyleSheet.create({
  stack: { gap: 12 },
  card: {
    padding: 16,
    gap: 12,
    backgroundColor: "white",
    borderRadius: 14,
    marginVertical: 8,
  },
  title: { fontSize: 20, fontWeight: "700", color: "#244d41" },
  input: {
    borderWidth: 1,
    borderColor: "#c8d6cb",
    borderRadius: 10,
    padding: 12,
    marginTop: 6,
    color: "#243e33",
  },
  button: { padding: 13, borderRadius: 10, backgroundColor: "#285840" },
  buttonText: { color: "white", fontWeight: "600" },
});
